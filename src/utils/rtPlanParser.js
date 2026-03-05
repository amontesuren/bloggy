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
  let currentBeamLimitingDevice = null // Para rastrear el tipo de dispositivo actual
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

      // Manejar secuencias (undefined length o VR=SQ)
      if (vr === 'SQ') {
        if (shouldLog) console.log('  📦 SECUENCIA detectada, continuando lectura dentro...')
        
        // Para secuencias importantes, loguear
        if (tag === '300A00B0') {
          console.log('  📦 BEAM SEQUENCE - los haces están aquí')
        } else if (tag === '300A0070') {
          console.log('  📦 FRACTION GROUP SEQUENCE - buscando número de fracciones dentro...')
        } else if (tag === '300A0111') {
          console.log('  📦📦📦 CONTROL POINT SEQUENCE - puntos de control dentro')
        } else if (tag === '300A011A') {
          console.log('  📦📦📦📦 BEAM LIMITING DEVICE POSITION SEQUENCE - mordazas y MLC dentro')
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
        } else if (tag === '300A00B6') {
          console.log('  📦📦📦 BEAM LIMITING DEVICE SEQUENCE - MORDAZAS Y MLC DENTRO')
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
          console.log('  Beam actual:', currentBeam ? 'Beam #' + currentBeam.number : 'ninguno')
        }
        
        // NO saltar la secuencia, continuar leyendo dentro
        offset = valueOffset
        continue
      }
      
      if (length === 0xFFFFFFFF) {
        if (shouldLog) console.log('  ⚠️ Longitud indefinida, continuando...')
        offset = valueOffset
        continue
      }

      // Validar longitud
      if (length < 0 || length > arrayBuffer.byteLength || valueOffset + length > arrayBuffer.byteLength) {
        if (shouldLog) console.log('  ⚠️ Longitud inválida, saltando...')
        offset = valueOffset
        continue
      }
      
      // Saltar tags privados (grupo impar > 0x0008)
      if (group > 0x0008 && group % 2 === 1) {
        if (shouldLog) console.log('  ⚠️ Tag privado (grupo impar), saltando...')
        offset = valueOffset + length
        continue
      }
      
      // Saltar datos binarios grandes (OB, OW, etc.)
      if (['OB', 'OW', 'OF', 'OD', 'OL'].includes(vr) && length > 100) {
        if (shouldLog) console.log('  ⚠️ Datos binarios grandes, saltando...')
        offset = valueOffset + length
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
      
      // Detectar items de secuencia
      if (tag === 'FFFEE000') {
        if (shouldLog) console.log('  📌 ITEM de secuencia (length:', length, ')')
        // Los datos del item están dentro, continuar leyendo
        offset = valueOffset
        continue
      }
      
      // Detectar fin de item o secuencia
      if (tag === 'FFFEE00D' || tag === 'FFFEE0DD') {
        if (shouldLog) console.log('  🔚 Fin de item/secuencia')
        offset = valueOffset
        continue
      }
      
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
        case '300A0070': // Fraction Group Sequence (es una secuencia, no el número)
          // Este es el contenedor, el número real está en 300A0078 o 300A0071
          console.log('  📦 FRACTION GROUP SEQUENCE - buscando número de fracciones dentro...')
          break
        case '300A0071': // Fraction Group Number
          console.log('  🔍 Tag 300A0071 detectado, valor:', value)
          const fractions1 = parseInt(value)
          if (!isNaN(fractions1) && fractions1 > 0 && fractions1 < 100) {
            if (plan.numberOfFractions === 0) {
              plan.numberOfFractions = fractions1
              tagParsed = true
              console.log('  ✓ NUMBER OF FRACTIONS (300A0071):', plan.numberOfFractions)
            }
          }
          break
        case '300A0078': // Number of Fractions Planned
          console.log('  🔍 Tag 300A0078 detectado, valor:', value)
          const fractions2 = parseInt(value)
          if (!isNaN(fractions2) && fractions2 > 0) {
            plan.numberOfFractions = fractions2
            tagParsed = true
            console.log('  ✓✓✓ NUMBER OF FRACTIONS PLANNED (300A0078):', plan.numberOfFractions)
          }
          break
        case '300A0079': // Number of Fraction Pattern Digits per Week
          console.log('  🔍 Tag 300A0079 detectado, valor:', value)
          const fractions3 = parseInt(value)
          if (!isNaN(fractions3) && fractions3 > 0 && fractions3 < 100) {
            if (plan.numberOfFractions === 0) {
              plan.numberOfFractions = fractions3
              tagParsed = true
              console.log('  ✓ NUMBER OF FRACTIONS (300A0079):', plan.numberOfFractions)
            }
          }
          break
        case '300A0080': // Number of Beams
          plan.numberOfBeams = parseInt(value) || 0
          tagParsed = true
          console.log('  ✓ NUMBER OF BEAMS:', plan.numberOfBeams)
          break
        case '300A0086': // Number of Fractions (Referenced Beam Number)
          console.log('  🔍 Tag 300A0086 detectado, valor:', value)
          const fractions4 = parseInt(value)
          if (!isNaN(fractions4) && fractions4 > 0 && fractions4 < 100) {
            if (plan.numberOfFractions === 0) {
              plan.numberOfFractions = fractions4
              tagParsed = true
              console.log('  ✓ NUMBER OF FRACTIONS (300A0086):', plan.numberOfFractions)
            }
          }
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
              jawY: null,
              mlcPositions: null // Para guardar posiciones de MLC
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
        case '300A011F': // Gantry Rotation Direction
          if (currentBeam) {
            currentBeam.gantryRotationDirection = value
            if (value && value !== 'NONE' && value !== '') {
              currentBeam.isArc = true
              console.log('  ✓✓✓ GANTRY ROTATION DIRECTION:', value, '(VMAT detectado)')
            }
            tagParsed = true
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
        case '300A011A': // Beam Limiting Device Position (Jaws)
          console.log('  🔧 TAG 300A011A DETECTADO - Procesando posiciones de mordazas...')
          console.log('  Valor raw:', value)
          console.log('  Longitud:', length)
          
          // Las posiciones vienen como múltiples valores DS (Decimal String)
          // Típicamente: X1, X2, Y1, Y2 o ASYMX, ASYMY, MLCX, MLCY
          const positions = []
          
          // Intentar parsear como múltiples valores separados por backslash
          const parts = value.split('\\')
          console.log('  Partes separadas por \\:', parts)
          
          parts.forEach(part => {
            const num = parseFloat(part.trim())
            if (!isNaN(num)) positions.push(num)
          })
          
          console.log('  ✓ Posiciones numéricas encontradas:', positions)
          
          if (positions.length >= 2) {
            const jawData = {
              x1: positions[0],
              x2: positions[1],
              y1: positions.length >= 4 ? positions[2] : null,
              y2: positions.length >= 4 ? positions[3] : null
            }
            
            console.log('  Jaw data procesado:', jawData)
            
            if (currentControlPoint) {
              currentControlPoint.jawX = [jawData.x1, jawData.x2]
              if (jawData.y1 !== null) {
                currentControlPoint.jawY = [jawData.y1, jawData.y2]
              }
              tagParsed = true
              console.log('  ✓✓✓ Mordazas asignadas a CP:', currentControlPoint.jawX, currentControlPoint.jawY)
            }
            
            if (currentBeam && !currentBeam.jawX) {
              currentBeam.jawX = [jawData.x1, jawData.x2]
              if (jawData.y1 !== null) {
                currentBeam.jawY = [jawData.y1, jawData.y2]
              }
              console.log('  ✓✓✓ Mordazas asignadas a Beam:', currentBeam.jawX, currentBeam.jawY)
            }
          } else {
            console.log('  ⚠️ No se pudieron extraer suficientes posiciones')
          }
          break
        case '300A011A': // Beam Limiting Device Position Sequence
          console.log('  🔧🔧🔧 TAG 300A011A DETECTADO - Beam Limiting Device Position Sequence')
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
          console.log('  Este es un contenedor de secuencia, dentro están ASYMX, ASYMY, MLCX')
          // Este tag es una secuencia, las posiciones reales están en 300A011C dentro de esta secuencia
          break
        case '300A00B6': // Beam Limiting Device Sequence
          console.log('  🔧🔧🔧 TAG 300A00B6 DETECTADO - Beam Limiting Device Sequence')
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
          console.log('  Beam actual:', currentBeam ? 'Beam #' + currentBeam.number : 'ninguno')
          // Este es el contenedor principal, dentro están los tipos y posiciones
          break
        case '300A00B4': // Beam Limiting Device Type
          console.log('  🔧🔧🔧 Tipo de dispositivo limitador:', value)
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
          currentBeamLimitingDevice = value // Guardar el tipo actual
          // Guardar el tipo para saber si es X, Y, ASYMX, ASYMY, MLCX, MLCY
          if (currentBeam) {
            if (!currentBeam.jawTypes) currentBeam.jawTypes = []
            currentBeam.jawTypes.push(value)
          }
          if (currentControlPoint) {
            if (!currentControlPoint.currentJawType) {
              currentControlPoint.currentJawType = value
            }
          }
          tagParsed = true
          break
        case '300A011C': // Leaf/Jaw Positions
          console.log('  🔧 TAG 300A011C DETECTADO - Posiciones de hojas/mordazas')
          console.log('  Tipo de dispositivo actual:', currentBeamLimitingDevice)
          console.log('  Control Point actual:', currentControlPoint ? 'CP #' + currentControlPoint.index : 'ninguno')
          console.log('  Valor raw (primeros 100 chars):', value.substring(0, 100))
          console.log('  Longitud:', length)
          
          // Las posiciones vienen como múltiples valores DS (Decimal String)
          const leafPositions = []
          
          // Intentar parsear como múltiples valores separados por backslash
          const leafParts = value.split('\\')
          console.log('  Número de valores:', leafParts.length)
          
          leafParts.forEach(part => {
            const num = parseFloat(part.trim())
            if (!isNaN(num)) leafPositions.push(num)
          })
          
          console.log('  ✓ Posiciones numéricas encontradas:', leafPositions.length, 'valores')
          if (leafPositions.length <= 10) {
            console.log('  Valores:', leafPositions)
          } else {
            console.log('  Primeros 10 valores:', leafPositions.slice(0, 10))
          }
          
          const deviceType = currentBeamLimitingDevice || 'UNKNOWN'
          
          // Detectar tipo de dispositivo y asignar posiciones
          if (deviceType === 'ASYMX' && leafPositions.length === 2) {
            console.log('  → ASYMX detectado (mordazas X)')
            if (currentControlPoint) {
              currentControlPoint.jawX = leafPositions
              console.log('  ✓✓✓ Mordazas X asignadas a CP #' + currentControlPoint.index + ':', currentControlPoint.jawX)
            }
            if (currentBeam && !currentBeam.jawX) {
              currentBeam.jawX = leafPositions
              console.log('  ✓✓✓ Mordazas X asignadas a Beam:', currentBeam.jawX)
            }
            tagParsed = true
          } else if (deviceType === 'ASYMY' && leafPositions.length === 2) {
            console.log('  → ASYMY detectado (mordazas Y)')
            if (currentControlPoint) {
              currentControlPoint.jawY = leafPositions
              console.log('  ✓✓✓ Mordazas Y asignadas a CP #' + currentControlPoint.index + ':', currentControlPoint.jawY)
            }
            if (currentBeam && !currentBeam.jawY) {
              currentBeam.jawY = leafPositions
              console.log('  ✓✓✓ Mordazas Y asignadas a Beam:', currentBeam.jawY)
            }
            tagParsed = true
          } else if (deviceType === 'MLCX' && leafPositions.length > 10) {
            console.log('  → MLCX detectado (MLC con', leafPositions.length, 'posiciones)')
            if (currentControlPoint) {
              if (!currentControlPoint.mlcPositions) {
                currentControlPoint.mlcPositions = {}
              }
              currentControlPoint.mlcPositions[deviceType] = leafPositions
              
              if (currentControlPoint.index < 3) {
                console.log('  ✓✓✓ Posiciones MLC guardadas en CP #' + currentControlPoint.index + ':', leafPositions.length, 'hojas')
              }
            }
            tagParsed = true
          } else if (leafPositions.length === 2) {
            console.log('  → Interpretando como MORDAZAS (2 posiciones, tipo:', deviceType + ')')
            
            if (currentControlPoint) {
              if (deviceType.includes('X') || deviceType === 'X') {
                currentControlPoint.jawX = leafPositions
                console.log('  ✓✓✓ Mordazas X asignadas a CP #' + currentControlPoint.index + ':', currentControlPoint.jawX)
              } else if (deviceType.includes('Y') || deviceType === 'Y') {
                currentControlPoint.jawY = leafPositions
                console.log('  ✓✓✓ Mordazas Y asignadas a CP #' + currentControlPoint.index + ':', currentControlPoint.jawY)
              }
              tagParsed = true
            }
          } else if (leafPositions.length > 4) {
            console.log('  → Interpretando como MLC (' + leafPositions.length + ' posiciones, tipo:', deviceType + ')')
            
            if (currentControlPoint) {
              if (!currentControlPoint.mlcPositions) {
                currentControlPoint.mlcPositions = {}
              }
              currentControlPoint.mlcPositions[deviceType] = leafPositions
              
              if (currentControlPoint.index < 3) {
                console.log('  ✓✓✓ Posiciones MLC guardadas en CP #' + currentControlPoint.index + ':', leafPositions.length, 'hojas')
              }
              tagParsed = true
            }
          } else {
            console.log('  ⚠️ Número de posiciones inesperado:', leafPositions.length, 'para dispositivo:', deviceType)
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
          controlPoints: beam.controlPoints.length,
          jawX: beam.jawX,
          jawY: beam.jawY,
          jawTypes: beam.jawTypes
        })
        
        // Mostrar mordazas del primer control point
        if (beam.controlPoints.length > 0) {
          const firstCP = beam.controlPoints[0]
          console.log(`    CP #0 - jawX: ${firstCP.jawX}, jawY: ${firstCP.jawY}, mlcPositions: ${firstCP.mlcPositions ? Object.keys(firstCP.mlcPositions).join(', ') : 'ninguno'}`)
          
          // Mostrar detalles de cada dispositivo MLC
          if (firstCP.mlcPositions) {
            Object.entries(firstCP.mlcPositions).forEach(([deviceType, positions]) => {
              console.log(`      Dispositivo "${deviceType}": ${positions.length} posiciones`)
            })
          }
        }
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
        
        // Copiar mordazas del primer control point al beam si no las tiene
        const firstCP = beam.controlPoints[0]
        if (!beam.jawX && firstCP.jawX) {
          beam.jawX = firstCP.jawX
          console.log('  ✓ Copiando Jaw X del primer CP al beam:', beam.jawX)
        }
        if (!beam.jawY && firstCP.jawY) {
          beam.jawY = firstCP.jawY
          console.log('  ✓ Copiando Jaw Y del primer CP al beam:', beam.jawY)
        }
        
        // ESTRATEGIA ALTERNATIVA: Si no hay mordazas pero sí hay MLC, 
        // las primeras posiciones del MLC podrían ser las mordazas
        if (!beam.jawX && !beam.jawY && firstCP.mlcPositions) {
          console.log('  ⚠️ No se encontraron mordazas, buscando en posiciones MLC...')
          
          // Buscar dispositivos que podrían ser mordazas (ASYMX, ASYMY, X, Y)
          Object.entries(firstCP.mlcPositions).forEach(([deviceType, positions]) => {
            console.log('    Revisando dispositivo:', deviceType, 'con', positions.length, 'posiciones')
            
            // Si el dispositivo tiene exactamente 2 posiciones, son mordazas
            if (positions.length === 2) {
              if (deviceType.includes('X') || deviceType === 'ASYMX' || deviceType === 'X') {
                beam.jawX = positions
                console.log('    ✓✓✓ Mordazas X extraídas de MLC:', beam.jawX)
              } else if (deviceType.includes('Y') || deviceType === 'ASYMY' || deviceType === 'Y') {
                beam.jawY = positions
                console.log('    ✓✓✓ Mordazas Y extraídas de MLC:', beam.jawY)
              }
            }
            
            // ESTRATEGIA VARIAN: Si tiene 120 posiciones (60 pares de hojas MLC),
            // las primeras 4 posiciones son las mordazas X1, X2, Y1, Y2
            // Solo vienen en el primer control point, luego están fijas
            if (positions.length === 120 && !beam.jawX && !beam.jawY) {
              console.log('    → Detectado formato Varian (120 posiciones)')
              const first4 = positions.slice(0, 4)
              console.log('    Primeras 4 posiciones (mordazas):', first4)
              
              // Extraer mordazas de las primeras 4 posiciones
              beam.jawX = [first4[0], first4[1]]
              beam.jawY = [first4[2], first4[3]]
              console.log('    ✓✓✓ Mordazas extraídas del CP #0:')
              console.log('      Jaw X:', beam.jawX)
              console.log('      Jaw Y:', beam.jawY)
              
              // Copiar a todos los control points (porque están fijas)
              beam.controlPoints.forEach(cp => {
                if (!cp.jawX) cp.jawX = beam.jawX
                if (!cp.jawY) cp.jawY = beam.jawY
              })
              console.log('    ✓ Mordazas copiadas a todos los', beam.controlPoints.length, 'control points')
              
              // Guardar las posiciones MLC sin las primeras 4 (solo las hojas reales)
              const mlcOnly = positions.slice(4)
              firstCP.mlcPositions[deviceType] = mlcOnly
              console.log('    ✓ MLC limpiado: ahora tiene', mlcOnly.length, 'posiciones (sin mordazas)')
            }
          })
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
  // Detectar VMAT por múltiples criterios
  if (beam.isArc || beam.type?.includes('ARC') || beam.type?.includes('VMAT')) {
    return 'VMAT'
  }
  
  // Si tiene dirección de rotación de gantry, es arco
  if (beam.gantryRotationDirection && beam.gantryRotationDirection !== 'NONE') {
    return 'VMAT'
  }
  
  // Si tiene muchos puntos de control (>10) y ángulos de gantry diferentes, probablemente VMAT
  if (beam.numControlPoints > 10 && beam.controlPoints?.length > 10) {
    const uniqueAngles = new Set(beam.controlPoints.map(cp => cp.gantryAngle).filter(a => a !== null))
    if (uniqueAngles.size > 5) {
      return 'VMAT'
    }
  }
  
  // Si tiene ángulos de inicio y fin de arco
  if (beam.arcStartAngle !== null && beam.arcStopAngle !== null) {
    return 'VMAT'
  }
  
  // IMRT si tiene múltiples puntos de control pero no es arco
  if (beam.numControlPoints > 2 || beam.controlPoints?.length > 2) {
    return 'IMRT'
  }
  
  // 3DCRT si es estático
  if (beam.type?.includes('STATIC')) {
    return '3DCRT'
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
