// Parser VERBOSE para debugging de DICOM RT Plan
export function parseRTPlan(arrayBuffer) {
  console.log('=== INICIO PARSING RT PLAN ===')
  console.log('Tamaño del archivo:', arrayBuffer.byteLength, 'bytes')
  
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder('iso-8859-1')
  
  // Verificar preamble (primeros 128 bytes)
  console.log('Verificando preamble (primeros 128 bytes)...')
  let offset = 128
  
  // Verificar DICM
  const dicmBytes = new Uint8Array(arrayBuffer, offset, 4)
  const dicm = decoder.decode(dicmBytes)
  console.log('Bytes DICM:', Array.from(dicmBytes).map(b => b.toString(16).padStart(2, '0')).join(' '))
  console.log('Firma DICM:', dicm)
  
  if (dicm !== 'DICM') {
    console.error('❌ No es un archivo DICOM válido (falta firma DICM)')
    throw new Error('No es un archivo DICOM válido (falta firma DICM)')
  }
  console.log('✓ Firma DICM válida')
  offset += 4

  const plan = {
    patientName: '',
    patientID: '',
    planLabel: '',
    planDate: '',
    planTime: '',
    planDescription: '',
    numberOfFractions: 0,
    prescribedDose: 0,
    targetPrescriptionDose: 0,
    beams: [],
    machine: '',
    planGeometry: '',
    planIntent: '',
    treatmentSites: '',
    numberOfBeams: 0
  }

  let currentBeam = null
  let currentControlPoint = null
  let tagsFound = 0
  let tagsProcessed = 0
  const maxTagsToLog = 50 // Limitar logs para no saturar

  console.log('\n=== COMENZANDO LECTURA DE TAGS ===\n')

  try {
    while (offset < arrayBuffer.byteLength - 8) {
      if (offset + 8 > arrayBuffer.byteLength) {
        console.log('⚠️ Llegamos al final del archivo')
        break
      }
      
      const group = view.getUint16(offset, true)
      const element = view.getUint16(offset + 2, true)
      const tag = group.toString(16).padStart(4, '0').toUpperCase() + 
                  element.toString(16).padStart(4, '0').toUpperCase()
      
      tagsProcessed++
      
      // Log detallado solo para los primeros tags o tags importantes
      const isImportantTag = tag.startsWith('300A') || tag.startsWith('0010')
      const shouldLog = tagsProcessed <= maxTagsToLog || isImportantTag
      
      if (shouldLog) {
        console.log(`\n--- Tag #${tagsProcessed}: ${tag} (offset: ${offset}) ---`)
      }
      
      let vr = ''
      let length = 0
      let valueOffset = offset + 8
      
      // Leer posible VR
      const possibleVRBytes = new Uint8Array(arrayBuffer, offset + 4, 2)
      const possibleVR = decoder.decode(possibleVRBytes)
      const isExplicitVR = /^[A-Z]{2}$/.test(possibleVR)
      
      if (shouldLog) {
        console.log('  Posible VR:', possibleVR, '(bytes:', 
          Array.from(possibleVRBytes).map(b => b.toString(16).padStart(2, '0')).join(' ') + ')')
        console.log('  Es Explicit VR:', isExplicitVR)
      }
      
      if (isExplicitVR) {
        vr = possibleVR
        
        // VRs con longitud de 32 bits
        if (['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'].includes(vr)) {
          length = view.getUint32(offset + 8, true)
          valueOffset = offset + 12
          if (shouldLog) console.log('  VR largo (32-bit length):', vr, 'length:', length)
        } else {
          length = view.getUint16(offset + 6, true)
          valueOffset = offset + 8
          if (shouldLog) console.log('  VR corto (16-bit length):', vr, 'length:', length)
        }
      } else {
        // Implicit VR
        length = view.getUint32(offset + 4, true)
        valueOffset = offset + 8
        if (shouldLog) console.log('  Implicit VR, length:', length)
      }

      // Manejar secuencias (undefined length)
      if (length === 0xFFFFFFFF) {
        if (shouldLog) console.log('  ⚠️ Secuencia con longitud indefinida, saltando...')
        offset = valueOffset
        continue
      }

      // Validar longitud
      if (length < 0 || length > arrayBuffer.byteLength || valueOffset + length > arrayBuffer.byteLength) {
        if (shouldLog) console.log('  ⚠️ Longitud inválida, saltando...')
        offset = valueOffset
        continue
      }

      // Extraer valor (limitar a 1000 bytes para el log)
      const valueBytes = new Uint8Array(arrayBuffer, valueOffset, Math.min(length, 1000))
      const value = decoder.decode(valueBytes).trim()
      
      if (shouldLog && length > 0 && length < 200) {
        console.log('  Valor:', value)
      } else if (shouldLog && length > 0) {
        console.log('  Valor (primeros 50 chars):', value.substring(0, 50) + '...')
      }

      // Parsear tags importantes
      let tagParsed = false
      
      switch(tag) {
        case '00100010': // Patient Name
          plan.patientName = value
          tagsFound++
          tagParsed = true
          console.log('  ✓ PATIENT NAME:', value)
          break
        case '00100020': // Patient ID
          plan.patientID = value
          tagsFound++
          tagParsed = true
          console.log('  ✓ PATIENT ID:', value)
          break
        case '300A0002': // RT Plan Label
          plan.planLabel = value
          tagsFound++
          tagParsed = true
          console.log('  ✓ RT PLAN LABEL:', value)
          break
        case '300A0003': // RT Plan Name
          if (!plan.planLabel) plan.planLabel = value
          tagParsed = true
          console.log('  ✓ RT PLAN NAME:', value)
          break
        case '300A0004': // RT Plan Description
          plan.planDescription = value
          tagParsed = true
          console.log('  ✓ RT PLAN DESCRIPTION:', value)
          break
        case '300A0006': // RT Plan Date
          plan.planDate = value
          tagParsed = true
          console.log('  ✓ RT PLAN DATE:', value)
          break
        case '300A0007': // RT Plan Time
          plan.planTime = value
          tagParsed = true
          console.log('  ✓ RT PLAN TIME:', value)
          break
        case '300A0009': // Treatment Sites
          plan.treatmentSites = value
          tagParsed = true
          console.log('  ✓ TREATMENT SITES:', value)
          break
        case '300A000A': // RT Plan Intent
          plan.planIntent = value
          tagParsed = true
          console.log('  ✓ RT PLAN INTENT:', value)
          break
        case '300A0070': // Number of Fractions
          plan.numberOfFractions = parseInt(value) || 0
          tagParsed = true
          console.log('  ✓ NUMBER OF FRACTIONS:', plan.numberOfFractions)
          break
        case '300A0026': // Target Prescription Dose
          plan.prescribedDose = parseFloat(value) || 0
          tagParsed = true
          console.log('  ✓ PRESCRIBED DOSE:', plan.prescribedDose)
          break
        case '300A0080': // Number of Beams
          plan.numberOfBeams = parseInt(value) || 0
          tagParsed = true
          console.log('  ✓ NUMBER OF BEAMS:', plan.numberOfBeams)
          break
        case '300A00B2': // Machine Name
          plan.machine = value
          tagParsed = true
          console.log('  ✓ MACHINE NAME:', value)
          break
        case '300A00C0': // Beam Number
          currentBeam = {
            number: parseInt(value) || 0,
            name: '',
            type: '',
            technique: '',
            radiationType: '',
            energy: '',
            gantryAngle: null,
            gantryRotationDirection: '',
            collimatorAngle: null,
            couchAngle: null,
            mu: 0,
            doseRate: '',
            numControlPoints: 0,
            controlPoints: [],
            jawX: null,
            jawY: null,
            isArc: false,
            arcStartAngle: null,
            arcStopAngle: null
          }
          plan.beams.push(currentBeam)
          tagParsed = true
          console.log('  ✓ NEW BEAM #:', currentBeam.number)
          break
        case '300A00C2': // Beam Name
          if (currentBeam) {
            currentBeam.name = value
            tagParsed = true
            console.log('  ✓ BEAM NAME:', value)
          }
          break
        case '300A00C4': // Beam Type
          if (currentBeam) {
            currentBeam.type = value
            if (value.includes('ARC') || value.includes('VMAT')) {
              currentBeam.isArc = true
            }
            tagParsed = true
            console.log('  ✓ BEAM TYPE:', value, currentBeam.isArc ? '(ARC)' : '')
          }
          break
        case '300A00C6': // Radiation Type
          if (currentBeam) {
            currentBeam.radiationType = value
            tagParsed = true
            console.log('  ✓ RADIATION TYPE:', value)
          }
          break
        case '300A0114': // Nominal Beam Energy
          if (currentBeam) {
            currentBeam.energy = value
            tagParsed = true
            console.log('  ✓ BEAM ENERGY:', value)
          }
          break
        case '300A0110': // Number of Control Points
          if (currentBeam) {
            currentBeam.numControlPoints = parseInt(value) || 0
            tagParsed = true
            console.log('  ✓ NUM CONTROL POINTS:', currentBeam.numControlPoints)
          }
          break
        case '300A0112': // Control Point Index
          if (currentBeam) {
            currentControlPoint = {
              index: parseInt(value) || 0,
              gantryAngle: null,
              collimatorAngle: null,
              couchAngle: null,
              mu: null,
              jawX: null,
              jawY: null
            }
            currentBeam.controlPoints.push(currentControlPoint)
            tagParsed = true
            if (currentControlPoint.index < 3 || currentControlPoint.index === currentBeam.numControlPoints - 1) {
              console.log('  ✓ CONTROL POINT INDEX:', currentControlPoint.index)
            }
          }
          break
        case '300A011E': // Gantry Angle
          const gantryAngle = parseFloat(value)
          if (!isNaN(gantryAngle)) {
            if (currentControlPoint) {
              currentControlPoint.gantryAngle = gantryAngle
              tagParsed = true
              if (currentControlPoint.index < 3 || currentControlPoint.index === currentBeam?.numControlPoints - 1) {
                console.log('  ✓ GANTRY ANGLE:', gantryAngle)
              }
            }
            if (currentBeam && currentBeam.gantryAngle === null) {
              currentBeam.gantryAngle = gantryAngle
            }
          }
          break
        case '300A0120': // Beam Limiting Device Angle
          const collAngle = parseFloat(value)
          if (!isNaN(collAngle)) {
            if (currentControlPoint) {
              currentControlPoint.collimatorAngle = collAngle
              tagParsed = true
            }
            if (currentBeam && currentBeam.collimatorAngle === null) {
              currentBeam.collimatorAngle = collAngle
            }
          }
          break
        case '300A0122': // Patient Support Angle
          const couchAngle = parseFloat(value)
          if (!isNaN(couchAngle)) {
            if (currentControlPoint) {
              currentControlPoint.couchAngle = couchAngle
              tagParsed = true
            }
            if (currentBeam && currentBeam.couchAngle === null) {
              currentBeam.couchAngle = couchAngle
            }
          }
          break
        case '300A0134': // Cumulative Meterset Weight
          const mu = parseFloat(value)
          if (!isNaN(mu) && currentControlPoint) {
            currentControlPoint.mu = mu
            tagParsed = true
          }
          break
      }

      if (shouldLog && !tagParsed && isImportantTag) {
        console.log('  (Tag no procesado)')
      }

      offset = valueOffset + length
    }

    console.log('\n=== RESUMEN DE PARSING ===')
    console.log('Tags procesados:', tagsProcessed)
    console.log('Tags importantes encontrados:', tagsFound)
    console.log('Haces encontrados:', plan.beams.length)
    
    if (plan.beams.length > 0) {
      console.log('\nDetalles de haces:')
      plan.beams.forEach((beam, idx) => {
        console.log(`  Haz ${idx + 1}:`, {
          number: beam.number,
          name: beam.name,
          type: beam.type,
          controlPoints: beam.controlPoints.length
        })
      })
    }

    // Post-procesamiento
    plan.beams.forEach(beam => {
      if (beam.isArc && beam.controlPoints.length >= 2) {
        beam.arcStartAngle = beam.controlPoints[0].gantryAngle
        beam.arcStopAngle = beam.controlPoints[beam.controlPoints.length - 1].gantryAngle
      }
      if (beam.controlPoints.length > 0) {
        const lastCP = beam.controlPoints[beam.controlPoints.length - 1]
        if (lastCP.mu !== null) {
          beam.mu = lastCP.mu
        }
      }
    })

    if (tagsFound === 0) {
      console.error('❌ No se encontraron tags DICOM válidos')
      throw new Error('No se encontraron tags DICOM válidos. Verifica que sea un archivo RT Plan.')
    }

    console.log('\n✓ Parsing completado exitosamente')
    console.log('=== FIN PARSING RT PLAN ===\n')

  } catch (err) {
    console.error('❌ Error durante el parsing:', err)
    console.error('Stack:', err.stack)
    throw err
  }

  return plan
}

export function formatRTPlanData(plan) {
  return {
    general: [
      { label: 'Paciente', value: plan.patientName || 'N/A' },
      { label: 'ID Paciente', value: plan.patientID || 'N/A' },
      { label: 'Nombre del Plan', value: plan.planLabel || 'N/A' },
      { label: 'Descripción', value: plan.planDescription || 'N/A' },
      { label: 'Fecha', value: formatDate(plan.planDate) },
      { label: 'Hora', value: formatTime(plan.planTime) },
      { label: 'Intención', value: plan.planIntent || 'N/A' },
      { label: 'Sitio de Tratamiento', value: plan.treatmentSites || 'N/A' },
      { label: 'Número de Fracciones', value: plan.numberOfFractions || 'N/A' },
      { label: 'Dosis Prescrita', value: plan.prescribedDose ? `${plan.prescribedDose.toFixed(2)} Gy` : 'N/A' },
      { label: 'Máquina', value: plan.machine || 'N/A' },
      { label: 'Número de Haces', value: plan.numberOfBeams || plan.beams.length }
    ],
    beams: plan.beams.map(beam => ({
      number: beam.number,
      name: beam.name || `Haz ${beam.number}`,
      type: beam.type || 'N/A',
      technique: beam.technique || detectTechnique(beam),
      radiationType: beam.radiationType || 'N/A',
      energy: beam.energy || 'N/A',
      doseRate: beam.doseRate || 'N/A',
      isArc: beam.isArc,
      gantryAngle: beam.gantryAngle !== null ? beam.gantryAngle.toFixed(1) : 'N/A',
      gantryRotationDirection: beam.gantryRotationDirection || 'N/A',
      arcStartAngle: beam.arcStartAngle !== null ? beam.arcStartAngle.toFixed(1) : null,
      arcStopAngle: beam.arcStopAngle !== null ? beam.arcStopAngle.toFixed(1) : null,
      collimatorAngle: beam.collimatorAngle !== null ? beam.collimatorAngle.toFixed(1) : 'N/A',
      couchAngle: beam.couchAngle !== null ? beam.couchAngle.toFixed(1) : 'N/A',
      mu: beam.mu ? (beam.mu * 100).toFixed(2) : 'N/A',
      numControlPoints: beam.numControlPoints || beam.controlPoints.length,
      controlPoints: beam.controlPoints,
      jawX: beam.jawX ? `[${beam.jawX[0].toFixed(1)}, ${beam.jawX[1].toFixed(1)}]` : 'N/A',
      jawY: beam.jawY ? `[${beam.jawY[0].toFixed(1)}, ${beam.jawY[1].toFixed(1)}]` : 'N/A',
      numWedges: beam.numWedges || 0,
      numBlocks: beam.numBlocks || 0
    }))
  }
}

function detectTechnique(beam) {
  if (beam.isArc || beam.type?.includes('ARC')) {
    return 'VMAT'
  }
  if (beam.type?.includes('STATIC')) {
    return '3DCRT'
  }
  if (beam.numControlPoints > 2) {
    return 'IMRT'
  }
  return 'N/A'
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return 'N/A'
  return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.length < 6) return 'N/A'
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`
}
