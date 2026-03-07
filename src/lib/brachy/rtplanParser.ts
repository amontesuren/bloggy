// Parser de DICOM RT Plan para braquiterapia HDR
// Extrae información relevante para cálculo TG-43

import { ParsedRTPlan, Channel, Dwell, Point } from './types'

export function parseRTPlanBrachy(arrayBuffer: ArrayBuffer): ParsedRTPlan {
  console.log('=== INICIO PARSING RT PLAN BRACHY ===')
  console.log('Tamaño del archivo:', arrayBuffer.byteLength, 'bytes')
  
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder('iso-8859-1')
  
  // Verificar preamble y DICM
  let offset = 128
  const dicmBytes = new Uint8Array(arrayBuffer, offset, 4)
  const dicm = decoder.decode(dicmBytes)
  
  if (dicm !== 'DICM') {
    throw new Error('No es un archivo DICOM válido')
  }
  
  offset += 4
  
  const plan: ParsedRTPlan = {
    refAirKermaRate: 0,
    halfLife: 73.83, // Ir-192 por defecto
    points: [],
    channels: []
  }
  
  let currentChannel: Partial<Channel> | null = null
  let currentDwells: Dwell[] = []
  let controlPoints: any[] = []
  
  try {
    while (offset < arrayBuffer.byteLength - 8) {
      const group = view.getUint16(offset, true)
      const element = view.getUint16(offset + 2, true)
      const tag = group.toString(16).padStart(4, '0').toUpperCase() + 
                  element.toString(16).padStart(4, '0').toUpperCase()
      
      let vr = ''
      let length = 0
      let valueOffset = offset + 8
      
      // Leer VR
      const possibleVRBytes = new Uint8Array(arrayBuffer, offset + 4, 2)
      const possibleVR = decoder.decode(possibleVRBytes)
      const isExplicitVR = /^[A-Z]{2}$/.test(possibleVR)
      
      if (isExplicitVR) {
        vr = possibleVR
        if (['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'].includes(vr)) {
          length = view.getUint32(offset + 8, true)
          valueOffset = offset + 12
        } else {
          length = view.getUint16(offset + 6, true)
          valueOffset = offset + 8
        }
      } else {
        length = view.getUint32(offset + 4, true)
        valueOffset = offset + 8
      }
      
      // Manejar secuencias
      if (vr === 'SQ' || length === 0xFFFFFFFF) {
        offset = valueOffset
        continue
      }
      
      if (length < 0 || length > arrayBuffer.byteLength || valueOffset + length > arrayBuffer.byteLength) {
        offset = valueOffset
        continue
      }
      
      // Saltar tags privados y datos binarios grandes
      if (group > 0x0008 && group % 2 === 1) {
        offset = valueOffset + length
        continue
      }
      
      if (['OB', 'OW', 'OF', 'OD', 'OL'].includes(vr) && length > 100) {
        offset = valueOffset + length
        continue
      }
      
      const valueBytes = new Uint8Array(arrayBuffer, valueOffset, Math.min(length, 1000))
      const value = decoder.decode(valueBytes).trim()
      
      // Parsear tags importantes
      switch(tag) {
        case '00100010': // Patient Name
          console.log('Patient Name:', value)
          break
          
        case '300A0002': // RT Plan Label
          console.log('RT Plan Label:', value)
          break
          
        case '300A0206': // Treatment Machine Name
          plan.treatmentModel = value
          console.log('Treatment Machine:', value)
          break
          
        case '300A0210': // Source Isotope Name
          plan.sourceIsotope = value
          console.log('Source Isotope:', value)
          break
          
        case '300A0212': // Source Isotope Half Life
          plan.halfLife = parseFloat(value)
          console.log('Half Life:', plan.halfLife, 'days')
          break
          
        case '300A022C': // Reference Air Kerma Rate
          plan.refAirKermaRate = parseFloat(value)
          console.log('Reference Air Kerma Rate:', plan.refAirKermaRate, 'U')
          break
          
        case '300A0230': // Channel Total Time
          if (currentChannel) {
            currentChannel.totalTime = parseFloat(value)
            console.log('Channel Total Time:', currentChannel.totalTime, 's')
          }
          break
          
        case '300A0280': // Channel Number
          // Nuevo canal
          if (currentChannel && currentChannel.totalTime) {
            plan.channels.push({
              totalTime: currentChannel.totalTime,
              numberOfDwells: currentDwells.length,
              dwells: currentDwells
            })
          }
          currentChannel = {}
          currentDwells = []
          controlPoints = []
          console.log('Nuevo canal:', value)
          break
          
        case '300A02D0': // Control Point Index
          // Nuevo control point
          const cpIndex = parseInt(value)
          if (!controlPoints[cpIndex]) {
            controlPoints[cpIndex] = { index: cpIndex }
          }
          break
          
        case '300A02D4': // Control Point 3D Position
          // Coordenadas del dwell
          const coords = value.split('\\').map(v => parseFloat(v.trim()))
          if (coords.length === 3 && controlPoints.length > 0) {
            const lastCP = controlPoints[controlPoints.length - 1]
            if (lastCP) {
              lastCP.coords = coords as [number, number, number]
            }
          }
          break
          
        case '300A02D6': // Cumulative Time Weight
          const timeWeight = parseFloat(value)
          if (controlPoints.length > 0) {
            const lastCP = controlPoints[controlPoints.length - 1]
            if (lastCP) {
              lastCP.timeWeight = timeWeight
            }
          }
          break
      }
      
      offset = valueOffset + length
    }
    
    // Añadir último canal
    if (currentChannel && currentChannel.totalTime) {
      // Calcular dwells desde control points
      const totalTime = currentChannel.totalTime
      const numberOfDwells = Math.floor(controlPoints.length / 2)
      
      for (let i = 0; i < controlPoints.length; i += 2) {
        const cp1 = controlPoints[i]
        const cp2 = controlPoints[i + 1]
        
        if (cp1 && cp2 && cp1.coords) {
          const weight = (cp2.timeWeight || 0) - (cp1.timeWeight || 0)
          const dwellTime = (totalTime / numberOfDwells) * weight
          
          currentDwells.push({
            coords: cp1.coords,
            dwellTime,
            timeWeight: weight
          })
        }
      }
      
      plan.channels.push({
        totalTime,
        numberOfDwells: currentDwells.length,
        dwells: currentDwells
      })
    }
    
    console.log('\n=== RESUMEN PARSING BRACHY ===')
    console.log('Canales encontrados:', plan.channels.length)
    console.log('Total dwells:', plan.channels.reduce((sum, ch) => sum + ch.dwells.length, 0))
    console.log('Reference Air Kerma Rate:', plan.refAirKermaRate, 'U')
    console.log('Half Life:', plan.halfLife, 'days')
    
  } catch (err) {
    console.error('Error durante el parsing:', err)
    throw err
  }
  
  return plan
}
