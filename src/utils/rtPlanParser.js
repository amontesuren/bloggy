// Parser DICOM RT Plan — versión corregida
// Cambios principales:
//   1. Tag 300A00B4 → 300A00B8 (RT Beam Limiting Device Type)
//   2. Eliminado case duplicado 300A011A (es SQ, se maneja antes del switch)
//   3. Añadido tag 300A0086 (Beam Meterset) para MU reales
//   4. Eliminada estrategia incorrecta de extraer jaws de MLC[0:4]
//   5. Reset de currentBeamLimitingDevice en cada item de secuencia

export function parseRTPlan(arrayBuffer) {
  console.log('=== INICIO PARSING RT PLAN ===')
  console.log('Tamaño del archivo:', arrayBuffer.byteLength, 'bytes')
  
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder('iso-8859-1')
  
  // Verificar preamble (primeros 128 bytes)
  let offset = 128
  
  // Verificar DICM
  const dicmBytes = new Uint8Array(arrayBuffer, offset, 4)
  const dicm = decoder.decode(dicmBytes)
  
  if (dicm !== 'DICM') {
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
    numberOfBeams: 0,
    isoCenter: ''
  }

  let currentBeam = null
  let currentControlPoint = null
  let currentBeamLimitingDevice = null
  
  // FIX #3 (parcial): Para almacenar MU reales por beam (desde Fraction Group)
  const beamMetersets = {} // beamNumber -> meterset value
  let tagsFound = 0
  let tagsProcessed = 0
  const maxTagsToLog = 50

  console.log('\n=== COMENZANDO LECTURA DE TAGS ===\n')

  try {
    while (offset < arrayBuffer.byteLength - 8) {
      if (offset + 8 > arrayBuffer.byteLength) break
      
      const group = view.getUint16(offset, true)
      const element = view.getUint16(offset + 2, true)
      const tag = group.toString(16).padStart(4, '0').toUpperCase() + 
                  element.toString(16).padStart(4, '0').toUpperCase()
      
      tagsProcessed++
      
      const isImportantTag = tag.startsWith('300A') || tag.startsWith('300C') || tag.startsWith('0010')
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
      if (vr === 'SQ') {
        if (shouldLog) {
          console.log('  📦 SECUENCIA:', tag)
        }
        offset = valueOffset
        continue
      }
      
      if (length === 0xFFFFFFFF) {
        offset = valueOffset
        continue
      }

      if (length < 0 || length > arrayBuffer.byteLength || valueOffset + length > arrayBuffer.byteLength) {
        offset = valueOffset
        continue
      }
      
      // Saltar tags privados
      if (group > 0x0008 && group % 2 === 1) {
        offset = valueOffset + length
        continue
      }
      
      // Saltar datos binarios grandes
      if (['OB', 'OW', 'OF', 'OD', 'OL'].includes(vr) && length > 100) {
        offset = valueOffset + length
        continue
      }

      const valueBytes = new Uint8Array(arrayBuffer, valueOffset, Math.min(length, 1000))
      const value = decoder.decode(valueBytes).trim()

      // ── Items de secuencia ──
      if (tag === 'FFFEE000') {
        // FIX #5: Reset del tipo de dispositivo al entrar en un nuevo item de secuencia
        // Así no arrastramos el tipo de un item anterior
        currentBeamLimitingDevice = null
        offset = valueOffset
        continue
      }
      
      if (tag === 'FFFEE00D' || tag === 'FFFEE0DD') {
        offset = valueOffset
        continue
      }
      
      // ── Tags importantes ──
      switch(tag) {
        case '00100010': // Patient Name
          plan.patientName = value
          tagsFound++
          console.log('  ✓ PATIENT NAME:', value)
          break
        case '00100020': // Patient ID
          plan.patientID = value
          tagsFound++
          console.log('  ✓ PATIENT ID:', value)
          break
        case '300A0002': // RT Plan Label
          plan.planLabel = value
          tagsFound++
          console.log('  ✓ RT PLAN LABEL:', value)
          break
        case '300A0003': // RT Plan Name
          if (!plan.planLabel) plan.planLabel = value
          console.log('  ✓ RT PLAN NAME:', value)
          break
        case '300A0004': // RT Plan Description
          plan.planDescription = value
          console.log('  ✓ RT PLAN DESCRIPTION:', value)
          break
        case '300A0006': // RT Plan Date
          plan.planDate = value
          break
        case '300A0007': // RT Plan Time
          plan.planTime = value
          break
        case '300A0009': // Treatment Sites
          plan.treatmentSites = value
          break
        case '300A000A': // RT Plan Intent
          plan.planIntent = value
          break
        case '300A000C': // RT Plan Geometry
          plan.planGeometry = value
          break
        case '300A0018': { // Dose Reference Point Coordinates (isocenter, mm)
          if (!plan.isoCenter) {
            const coords = value.split('\\').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
            if (coords.length === 3) {
              plan.isoCenter = `(${coords[0].toFixed(1)}, ${coords[1].toFixed(1)}, ${coords[2].toFixed(1)}) mm`
              console.log('  ✓ ISOCENTER:', plan.isoCenter)
            }
          }
          break
        }
        case '300A0026': { // Target Prescription Dose (Gy)
          const dose = parseFloat(value)
          if (!isNaN(dose) && dose > 0) {
            plan.targetPrescriptionDose = dose
            if (!plan.prescribedDose) plan.prescribedDose = dose
            console.log('  ✓ TARGET PRESCRIPTION DOSE:', dose, 'Gy')
          }
          break
        }
        case '300A0078': // Number of Fractions Planned
          {
            const nfx = parseInt(value)
            if (!isNaN(nfx) && nfx > 0) {
              plan.numberOfFractions = nfx
              console.log('  ✓ NUMBER OF FRACTIONS PLANNED:', nfx)
            }
          }
          break
        case '300A0080': // Number of Beams
          plan.numberOfBeams = parseInt(value) || 0
          console.log('  ✓ NUMBER OF BEAMS:', plan.numberOfBeams)
          break

        // ────────────────────────────────────────────
        // FIX #3: Beam Meterset (MU reales) — dentro de Fraction Group Sequence
        // Tag (300A,0086) = Beam Meterset
        // ────────────────────────────────────────────
        case '300A0086': {
          const meterset = parseFloat(value)
          console.log('  🔍 BEAM METERSET (300A0086):', meterset)
          // Necesitamos saber a qué beam pertenece.
          // El tag (300C,0006) Referenced Beam Number viene justo antes en el mismo item.
          // Lo almacenamos temporalmente y lo asociamos en post-procesamiento.
          // Por ahora guardamos en un array temporal.
          if (!isNaN(meterset) && meterset > 0) {
            if (!plan._pendingMetersets) plan._pendingMetersets = []
            plan._pendingMetersets.push(meterset)
            console.log('  ✓ BEAM METERSET guardado:', meterset, 'MU')
          }
          break
        }
        case '300C0006': { // Referenced Beam Number (en Fraction Group)
          const refBeamNum = parseInt(value)
          console.log('  🔍 REFERENCED BEAM NUMBER:', refBeamNum)
          if (!isNaN(refBeamNum)) {
            if (!plan._pendingRefBeamNum) plan._pendingRefBeamNum = []
            plan._pendingRefBeamNum.push(refBeamNum)
          }
          break
        }

        // ────────────────────────────────────────────
        // Beam Sequence items
        // ────────────────────────────────────────────
        case '300A00B2': // Machine Name
          plan.machine = value
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
          currentControlPoint = null // Reset al empezar un nuevo beam
          console.log('  ✓ NEW BEAM #:', currentBeam.number)
          break
        case '300A00C2': // Beam Name
          if (currentBeam) {
            currentBeam.name = value
            console.log('  ✓ BEAM NAME:', value)
          }
          break
        case '300A00CE': // Treatment Delivery Type
          if (currentBeam) {
            currentBeam.technique = value
          }
          break
        case '300A00C4': // Beam Type
          if (currentBeam) {
            currentBeam.type = value
            if (value.includes('ARC') || value.includes('VMAT')) {
              currentBeam.isArc = true
            }
            console.log('  ✓ BEAM TYPE:', value)
          }
          break
        case '300A00C6': // Radiation Type
          if (currentBeam) {
            currentBeam.radiationType = value
          }
          break
        case '300A00D0': // Number of Wedges
          if (currentBeam) {
            currentBeam.numWedges = parseInt(value) || 0
          }
          break
        case '300A00F0': // Number of Blocks
          if (currentBeam) {
            currentBeam.numBlocks = parseInt(value) || 0
          }
          break
        case '300A0115': // Dose Rate Set
          if (currentBeam) {
            currentBeam.doseRate = value
            console.log('  ✓ DOSE RATE:', value)
          }
          break
        case '300A0114': // Nominal Beam Energy
          if (currentBeam) {
            currentBeam.energy = value
          }
          break
        case '300A0110': // Number of Control Points
          if (currentBeam) {
            currentBeam.numControlPoints = parseInt(value) || 0
            console.log('  ✓ NUM CONTROL POINTS:', currentBeam.numControlPoints)
          }
          break

        // ────────────────────────────────────────────
        // Control Point items
        // ────────────────────────────────────────────
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
              mlcPositions: null
            }
            currentBeam.controlPoints.push(currentControlPoint)
            // Reset del tipo de dispositivo al entrar en un nuevo CP
            currentBeamLimitingDevice = null
          }
          break
        case '300A011E': // Gantry Angle
          {
            const ga = parseFloat(value)
            if (!isNaN(ga)) {
              if (currentControlPoint) currentControlPoint.gantryAngle = ga
              if (currentBeam && currentBeam.gantryAngle === null) currentBeam.gantryAngle = ga
            }
          }
          break
        case '300A011F': // Gantry Rotation Direction
          if (currentBeam) {
            currentBeam.gantryRotationDirection = value
            if (value && value !== 'NONE' && value !== '') {
              currentBeam.isArc = true
            }
          }
          break
        case '300A0120': // Beam Limiting Device Angle (Collimator)
          {
            const ca = parseFloat(value)
            if (!isNaN(ca)) {
              if (currentControlPoint) currentControlPoint.collimatorAngle = ca
              if (currentBeam && currentBeam.collimatorAngle === null) currentBeam.collimatorAngle = ca
            }
          }
          break
        case '300A0122': // Patient Support Angle (Couch)
          {
            const pa = parseFloat(value)
            if (!isNaN(pa)) {
              if (currentControlPoint) currentControlPoint.couchAngle = pa
              if (currentBeam && currentBeam.couchAngle === null) currentBeam.couchAngle = pa
            }
          }
          break
        case '300A0134': // Cumulative Meterset Weight
          {
            const mw = parseFloat(value)
            if (!isNaN(mw) && currentControlPoint) {
              currentControlPoint.mu = mw
            }
          }
          break

        // ────────────────────────────────────────────
        // FIX #1: Tag corregido 300A00B8 (era 300A00B4)
        // RT Beam Limiting Device Type: ASYMX, ASYMY, MLCX, MLCY, X, Y
        // ────────────────────────────────────────────
        case '300A00B8': // RT Beam Limiting Device Type ← CORREGIDO
          currentBeamLimitingDevice = value
          console.log('  ✓ BEAM LIMITING DEVICE TYPE:', value)
          break

        // ────────────────────────────────────────────
        // FIX #2: 300A011C (Leaf/Jaw Positions) — lógica limpia
        // Usa currentBeamLimitingDevice para saber qué es
        // ────────────────────────────────────────────
        case '300A011C': { // Leaf/Jaw Positions
          const leafParts = value.split('\\')
          const positions = []
          leafParts.forEach(part => {
            const num = parseFloat(part.trim())
            if (!isNaN(num)) positions.push(num)
          })
          
          const devType = currentBeamLimitingDevice || 'UNKNOWN'
          console.log('  🔧 LEAF/JAW POSITIONS — Device:', devType, '— N:', positions.length)
          
          if (positions.length === 0) break
          
          // Mordazas X (ASYMX o X) — siempre 2 posiciones
          if ((devType === 'ASYMX' || devType === 'X') && positions.length === 2) {
            if (currentControlPoint) {
              currentControlPoint.jawX = positions
              console.log('    ✓ Jaw X → CP #' + currentControlPoint.index + ':', positions)
            }
            if (currentBeam && !currentBeam.jawX) {
              currentBeam.jawX = positions
            }
          }
          // Mordazas Y (ASYMY o Y) — siempre 2 posiciones
          else if ((devType === 'ASYMY' || devType === 'Y') && positions.length === 2) {
            if (currentControlPoint) {
              currentControlPoint.jawY = positions
              console.log('    ✓ Jaw Y → CP #' + currentControlPoint.index + ':', positions)
            }
            if (currentBeam && !currentBeam.jawY) {
              currentBeam.jawY = positions
            }
          }
          // MLC (MLCX, MLCY, o cualquier otro con muchas hojas)
          else if (positions.length > 2) {
            if (currentControlPoint) {
              if (!currentControlPoint.mlcPositions) currentControlPoint.mlcPositions = {}
              currentControlPoint.mlcPositions[devType] = positions
              if (currentControlPoint.index < 3) {
                console.log('    ✓ MLC (' + devType + ') → CP #' + currentControlPoint.index + ':', positions.length, 'hojas')
              }
            }
          }
          // Fallback: 2 posiciones sin tipo conocido
          else if (positions.length === 2 && devType === 'UNKNOWN') {
            console.log('    ⚠️ 2 posiciones sin tipo conocido — no se asignan')
          }
          break
        }

        // NOTE: Eliminado el case duplicado '300A011A' — es una SQ,
        // se maneja en el bloque de secuencias antes del switch.
        // Las posiciones reales vienen de '300A011C' (arriba).
      }

      offset = valueOffset + length
    }

    // ── Post-procesamiento ──
    console.log('\n=== POST-PROCESAMIENTO ===')

    // Asociar Beam Metersets (MU reales) a cada beam
    if (plan._pendingRefBeamNum && plan._pendingMetersets) {
      const refs = plan._pendingRefBeamNum
      const mets = plan._pendingMetersets
      for (let i = 0; i < Math.min(refs.length, mets.length); i++) {
        const beam = plan.beams.find(b => b.number === refs[i])
        if (beam) {
          beam.mu = mets[i]
          console.log('  ✓ Beam #' + beam.number + ' → MU:', mets[i])
        }
      }
      delete plan._pendingRefBeamNum
      delete plan._pendingMetersets
    }

    plan.beams.forEach(beam => {
      // Arcos: ángulo inicio/fin
      if (beam.isArc && beam.controlPoints.length >= 2) {
        beam.arcStartAngle = beam.controlPoints[0].gantryAngle
        beam.arcStopAngle = beam.controlPoints[beam.controlPoints.length - 1].gantryAngle
      }
      
      // Copiar mordazas del primer CP si el beam no las tiene
      if (beam.controlPoints.length > 0) {
        const firstCP = beam.controlPoints[0]
        if (!beam.jawX && firstCP.jawX) beam.jawX = firstCP.jawX
        if (!beam.jawY && firstCP.jawY) beam.jawY = firstCP.jawY
      }
      
      // Propagar mordazas del CP#0 a CPs que no las tienen
      // (en DICOM, si un CP no incluye jaw positions, hereda del CP anterior)
      let lastJawX = null
      let lastJawY = null
      beam.controlPoints.forEach(cp => {
        if (cp.jawX) lastJawX = cp.jawX
        else if (lastJawX) cp.jawX = lastJawX
        
        if (cp.jawY) lastJawY = cp.jawY
        else if (lastJawY) cp.jawY = lastJawY
      })
    })

    console.log('\n=== RESUMEN ===')
    console.log('Tags procesados:', tagsProcessed)
    console.log('Haces:', plan.beams.length)
    plan.beams.forEach((beam, idx) => {
      console.log(`  Beam #${beam.number} "${beam.name}": ${beam.type}, ` +
        `CPs: ${beam.controlPoints.length}, ` +
        `JawX: ${beam.jawX}, JawY: ${beam.jawY}, ` +
        `MU: ${beam.mu}`)
    })

    if (tagsFound === 0) {
      throw new Error('No se encontraron tags DICOM válidos. Verifica que sea un archivo RT Plan.')
    }

  } catch (err) {
    console.error('❌ Error durante el parsing:', err)
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
      { label: 'Número de Haces', value: plan.numberOfBeams || plan.beams.length },
      { label: 'Isocéntro', value: plan.isoCenter || 'N/A' }
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
      // FIX #4: MU reales (ya no se multiplica cumulative weight × 100)
      mu: beam.mu ? beam.mu.toFixed(2) : 'N/A',
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
  if (beam.isArc || beam.type?.includes('ARC') || beam.type?.includes('VMAT')) return 'VMAT'
  if (beam.gantryRotationDirection && beam.gantryRotationDirection !== 'NONE') return 'VMAT'
  
  if (beam.numControlPoints > 10 && beam.controlPoints?.length > 10) {
    const uniqueAngles = new Set(beam.controlPoints.map(cp => cp.gantryAngle).filter(a => a !== null))
    if (uniqueAngles.size > 5) return 'VMAT'
  }
  
  if (beam.arcStartAngle !== null && beam.arcStopAngle !== null) return 'VMAT'
  if (beam.numControlPoints > 2 || beam.controlPoints?.length > 2) return 'IMRT'
  if (beam.type?.includes('STATIC')) return '3DCRT'
  
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
