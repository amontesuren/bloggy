// Parser básico para DICOM RT Plan
export function parseRTPlan(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  const decoder = new TextDecoder('iso-8859-1')
  
  let offset = 128 // Skip preamble
  
  // Verificar DICM
  const dicm = decoder.decode(new Uint8Array(arrayBuffer, offset, 4))
  if (dicm !== 'DICM') {
    throw new Error('No es un archivo DICOM válido')
  }
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
  let inBeamSequence = false
  let inControlPointSequence = false

  try {
    while (offset < arrayBuffer.byteLength - 8) {
      const group = view.getUint16(offset, true).toString(16).padStart(4, '0')
      const element = view.getUint16(offset + 2, true).toString(16).padStart(4, '0')
      const tag = (group + element).toUpperCase()
      
      let vr = ''
      let length = 0
      
      // Leer VR y longitud
      if (group !== '0002' && parseInt(group, 16) % 2 === 1) {
        // Implicit VR
        length = view.getUint32(offset + 4, true)
        offset += 8
      } else {
        // Explicit VR
        vr = decoder.decode(new Uint8Array(arrayBuffer, offset + 4, 2))
        
        if (['OB', 'OW', 'OF', 'SQ', 'UN', 'UT'].includes(vr)) {
          offset += 2 // Skip reserved
          length = view.getUint32(offset + 6, true)
          offset += 10
        } else {
          length = view.getUint16(offset + 6, true)
          offset += 8
        }
      }

      if (length === 0xFFFFFFFF) {
        // Sequence start
        if (tag === '300A00B0') inBeamSequence = true
        if (tag === '300A0111') inControlPointSequence = true
        offset += 0
        continue
      }

      // Leer valor según el tag
      if (tag === '00100010') { // Patient Name
        plan.patientName = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '00100020') { // Patient ID
        plan.patientID = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A0002') { // RT Plan Label
        plan.planLabel = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A0003') { // RT Plan Name
        if (!plan.planLabel) {
          plan.planLabel = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
        }
      } else if (tag === '300A0004') { // RT Plan Description
        plan.planDescription = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 200))).trim()
      } else if (tag === '300A0006') { // RT Plan Date
        plan.planDate = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A0007') { // RT Plan Time
        plan.planTime = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A0009') { // Treatment Sites
        plan.treatmentSites = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A000A') { // RT Plan Intent
        plan.planIntent = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A0070') { // Number of Fractions
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        plan.numberOfFractions = parseInt(val) || 0
      } else if (tag === '300A0026') { // Target Prescription Dose
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        plan.prescribedDose = parseFloat(val) || 0
      } else if (tag === '300A0080') { // Number of Beams
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        plan.numberOfBeams = parseInt(val) || 0
      } else if (tag === '300A00B2') { // Machine Name
        plan.machine = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A00C0') { // Beam Number
        const beamNum = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentBeam = { 
          number: parseInt(beamNum) || 0, 
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
      } else if (tag === '300A00C2' && currentBeam) { // Beam Name
        currentBeam.name = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 100))).trim()
      } else if (tag === '300A00C3' && currentBeam) { // Beam Description
        currentBeam.description = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 200))).trim()
      } else if (tag === '300A00C4' && currentBeam) { // Beam Type
        currentBeam.type = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 50))).trim()
        // Detectar si es arco
        if (currentBeam.type.includes('ARC') || currentBeam.type.includes('VMAT')) {
          currentBeam.isArc = true
        }
      } else if (tag === '300A00C6' && currentBeam) { // Radiation Type
        currentBeam.radiationType = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 50))).trim()
      } else if (tag === '300A00C7' && currentBeam) { // Treatment Delivery Type
        currentBeam.technique = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 50))).trim()
      } else if (tag === '300A0114' && currentBeam) { // Nominal Beam Energy
        currentBeam.energy = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 50))).trim()
      } else if (tag === '300A0115' && currentBeam) { // Dose Rate Set
        currentBeam.doseRate = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 50))).trim()
      } else if (tag === '300A0110' && currentBeam) { // Number of Control Points
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentBeam.numControlPoints = parseInt(val) || 0
      } else if (tag === '300A0112' && currentBeam) { // Control Point Index
        const idx = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentControlPoint = {
          index: parseInt(idx) || 0,
          gantryAngle: null,
          collimatorAngle: null,
          couchAngle: null,
          mu: null,
          jawX: null,
          jawY: null
        }
        currentBeam.controlPoints.push(currentControlPoint)
      } else if (tag === '300A011E' && currentControlPoint) { // Gantry Angle
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentControlPoint.gantryAngle = parseFloat(val)
        if (currentBeam && currentBeam.gantryAngle === null) {
          currentBeam.gantryAngle = currentControlPoint.gantryAngle
        }
      } else if (tag === '300A011F' && currentBeam) { // Gantry Rotation Direction
        currentBeam.gantryRotationDirection = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
      } else if (tag === '300A0120' && currentControlPoint) { // Beam Limiting Device Angle (Collimator)
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentControlPoint.collimatorAngle = parseFloat(val)
        if (currentBeam && currentBeam.collimatorAngle === null) {
          currentBeam.collimatorAngle = currentControlPoint.collimatorAngle
        }
      } else if (tag === '300A0122' && currentControlPoint) { // Patient Support Angle (Couch)
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentControlPoint.couchAngle = parseFloat(val)
        if (currentBeam && currentBeam.couchAngle === null) {
          currentBeam.couchAngle = currentControlPoint.couchAngle
        }
      } else if (tag === '300A0134' && currentControlPoint) { // Cumulative Meterset Weight
        const val = decoder.decode(new Uint8Array(arrayBuffer, offset, Math.min(length, 20))).trim()
        currentControlPoint.mu = parseFloat(val)
      } else if (tag === '300A011A') { // Beam Limiting Device Position (Jaws)
        const positions = []
        let pos = offset
        while (pos < offset + length && positions.length < 4) {
          const val = decoder.decode(new Uint8Array(arrayBuffer, pos, 16)).trim()
          const num = parseFloat(val)
          if (!isNaN(num)) positions.push(num)
          pos += 16
        }
        if (positions.length >= 2) {
          const jawPos = { x1: positions[0], x2: positions[1] }
          if (positions.length >= 4) {
            jawPos.y1 = positions[2]
            jawPos.y2 = positions[3]
          }
          if (currentControlPoint) {
            currentControlPoint.jawX = [jawPos.x1, jawPos.x2]
            currentControlPoint.jawY = jawPos.y1 !== undefined ? [jawPos.y1, jawPos.y2] : null
          }
          if (currentBeam && !currentBeam.jawX) {
            currentBeam.jawX = [jawPos.x1, jawPos.x2]
            currentBeam.jawY = jawPos.y1 !== undefined ? [jawPos.y1, jawPos.y2] : null
          }
        }
      }

      offset += length
    }

    // Post-procesamiento: detectar ángulos de inicio/fin para arcos
    plan.beams.forEach(beam => {
      if (beam.isArc && beam.controlPoints.length >= 2) {
        beam.arcStartAngle = beam.controlPoints[0].gantryAngle
        beam.arcStopAngle = beam.controlPoints[beam.controlPoints.length - 1].gantryAngle
      }
      // Calcular MU total del último control point
      if (beam.controlPoints.length > 0) {
        const lastCP = beam.controlPoints[beam.controlPoints.length - 1]
        if (lastCP.mu !== null) {
          beam.mu = lastCP.mu
        }
      }
    })

  } catch (err) {
    console.error('Error parsing RT Plan:', err)
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
