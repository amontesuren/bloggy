import { useState, useRef } from 'react'
import { parseRTPlan, formatRTPlanData } from '../utils/rtPlanParser'
import '../styles/rtplan.css'

function RTPlanCompare() {
  const [leftPlan, setLeftPlan] = useState(null)
  const [rightPlan, setRightPlan] = useState(null)
  const [leftFile, setLeftFile] = useState('')
  const [rightFile, setRightFile] = useState('')
  const [loading, setLoading] = useState({ left: false, right: false })
  const [error, setError] = useState({ left: '', right: '' })

  const leftInputRef = useRef()
  const rightInputRef = useRef()

  const handleFileLoad = (file, side) => {
    if (!file) return

    setLoading({ ...loading, [side]: true })
    setError({ ...error, [side]: '' })

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const plan = parseRTPlan(e.target.result)
        const formatted = formatRTPlanData(plan)
        
        if (side === 'left') {
          setLeftPlan(formatted)
          setLeftFile(file.name)
        } else {
          setRightPlan(formatted)
          setRightFile(file.name)
        }
        setLoading({ ...loading, [side]: false })
      } catch (err) {
        setError({ ...error, [side]: 'Error al parsear el archivo: ' + err.message })
        setLoading({ ...loading, [side]: false })
      }
    }
    reader.onerror = () => {
      setError({ ...error, [side]: 'Error al leer el archivo' })
      setLoading({ ...loading, [side]: false })
    }
    reader.readAsArrayBuffer(file)
  }

  const clearPlan = (side) => {
    if (side === 'left') {
      setLeftPlan(null)
      setLeftFile('')
      if (leftInputRef.current) leftInputRef.current.value = ''
    } else {
      setRightPlan(null)
      setRightFile('')
      if (rightInputRef.current) rightInputRef.current.value = ''
    }
  }

  return (
    <div className="page-body" style={{ maxWidth: '100%', padding: '24px' }}>
      <div className="page-header" style={{ maxWidth: '1400px', margin: '0 auto 24px' }}>
        <div className="page-icon"><i className="bi bi-file-earmark-diff"></i></div>
        <h1 className="page-title">Comparador de RT Plans</h1>
        <p className="page-subtitle">Compara dos planes de radioterapia DICOM lado a lado</p>
      </div>

      <div className="rtplan-container">
        {/* Left Panel */}
        <div className="rtplan-panel">
          <div className="rtplan-panel-header">
            <h3>Plan A</h3>
            {leftPlan && (
              <button onClick={() => clearPlan('left')} className="btn-clear">
                <i className="bi bi-x-circle"></i>
              </button>
            )}
          </div>

          {!leftPlan ? (
            <DropZone
              inputRef={leftInputRef}
              onFileSelect={(file) => handleFileLoad(file, 'left')}
              loading={loading.left}
              error={error.left}
              label="Arrastra RT Plan A aquí"
            />
          ) : (
            <PlanView plan={leftPlan} fileName={leftFile} />
          )}
        </div>

        {/* Right Panel */}
        <div className="rtplan-panel">
          <div className="rtplan-panel-header">
            <h3>Plan B</h3>
            {rightPlan && (
              <button onClick={() => clearPlan('right')} className="btn-clear">
                <i className="bi bi-x-circle"></i>
              </button>
            )}
          </div>

          {!rightPlan ? (
            <DropZone
              inputRef={rightInputRef}
              onFileSelect={(file) => handleFileLoad(file, 'right')}
              loading={loading.right}
              error={error.right}
              label="Arrastra RT Plan B aquí"
            />
          ) : (
            <PlanView plan={rightPlan} fileName={rightFile} />
          )}
        </div>
      </div>

      {leftPlan && rightPlan && (
        <ComparisonSummary leftPlan={leftPlan} rightPlan={rightPlan} />
      )}
    </div>
  )
}

function DropZone({ inputRef, onFileSelect, loading, error, label }) {
  return (
    <div className="rtplan-dropzone-container">
      <input
        ref={inputRef}
        type="file"
        accept=".dcm,.dicom,application/dicom"
        style={{ display: 'none' }}
        onChange={(e) => onFileSelect(e.target.files[0])}
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.style.borderColor = 'var(--accent-color)'
          e.currentTarget.style.background = 'rgba(102, 126, 234, 0.05)'
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.background = 'transparent'
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.background = 'transparent'
          onFileSelect(e.dataTransfer.files[0])
        }}
        className="rtplan-dropzone"
      >
        {loading ? (
          <>
            <div className="spinner"></div>
            <p>Cargando...</p>
          </>
        ) : (
          <>
            <i className="bi bi-file-earmark-medical" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}></i>
            <p style={{ fontWeight: 600, marginTop: '12px' }}>{label}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>o haz clic para seleccionar</p>
          </>
        )}
      </div>

      {error && (
        <div className="rtplan-error">
          <i className="bi bi-exclamation-triangle"></i> {error}
        </div>
      )}
    </div>
  )
}

function PlanView({ plan, fileName }) {
  return (
    <div className="rtplan-view">
      <div className="rtplan-filename">
        <i className="bi bi-file-earmark-check"></i> {fileName}
      </div>

      <div className="rtplan-section">
        <h4>Información General</h4>
        <table className="rtplan-table">
          <tbody>
            {plan.general.map((item, idx) => (
              <tr key={idx}>
                <td className="rtplan-label">{item.label}</td>
                <td className="rtplan-value">{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rtplan-section">
        <h4>Haces ({plan.beams.length})</h4>
        {plan.beams.map((beam, idx) => (
          <div key={idx} className="beam-card">
            <div className="beam-header">
              <span className="beam-number">#{beam.number}</span>
              <span className="beam-name">{beam.name}</span>
              {beam.isArc && <span className="beam-badge arc">VMAT</span>}
              {!beam.isArc && beam.technique === '3DCRT' && <span className="beam-badge crt">3DCRT</span>}
              {beam.technique === 'IMRT' && <span className="beam-badge imrt">IMRT</span>}
            </div>
            
            <div className="beam-grid">
              <div className="beam-item">
                <span className="beam-item-label">Técnica</span>
                <span className="beam-item-value">{beam.technique}</span>
              </div>
              <div className="beam-item">
                <span className="beam-item-label">Tipo</span>
                <span className="beam-item-value">{beam.type}</span>
              </div>
              <div className="beam-item">
                <span className="beam-item-label">Radiación</span>
                <span className="beam-item-value">{beam.radiationType}</span>
              </div>
              <div className="beam-item">
                <span className="beam-item-label">Energía</span>
                <span className="beam-item-value">{beam.energy}</span>
              </div>
              <div className="beam-item">
                <span className="beam-item-label">Tasa de Dosis</span>
                <span className="beam-item-value">{beam.doseRate}</span>
              </div>
              <div className="beam-item">
                <span className="beam-item-label">Unidades Monitor</span>
                <span className="beam-item-value">{beam.mu} MU</span>
              </div>
            </div>

            {beam.isArc && (
              <div className="arc-info">
                <h5><i className="bi bi-arrow-repeat"></i> Información de Arco</h5>
                <div className="beam-grid">
                  <div className="beam-item">
                    <span className="beam-item-label">Ángulo Inicio</span>
                    <span className="beam-item-value">{beam.arcStartAngle}°</span>
                  </div>
                  <div className="beam-item">
                    <span className="beam-item-label">Ángulo Fin</span>
                    <span className="beam-item-value">{beam.arcStopAngle}°</span>
                  </div>
                  <div className="beam-item">
                    <span className="beam-item-label">Dirección Rotación</span>
                    <span className="beam-item-value">{beam.gantryRotationDirection}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="beam-angles">
              <h5><i className="bi bi-compass"></i> Ángulos</h5>
              <div className="beam-grid">
                <div className="beam-item">
                  <span className="beam-item-label">Gantry</span>
                  <span className="beam-item-value">{beam.gantryAngle}°</span>
                </div>
                <div className="beam-item">
                  <span className="beam-item-label">Colimador</span>
                  <span className="beam-item-value">{beam.collimatorAngle}°</span>
                </div>
                <div className="beam-item">
                  <span className="beam-item-label">Mesa</span>
                  <span className="beam-item-value">{beam.couchAngle}°</span>
                </div>
              </div>
            </div>

            <div className="beam-jaws">
              <h5><i className="bi bi-bounding-box"></i> Mordazas</h5>
              <div className="beam-grid">
                <div className="beam-item">
                  <span className="beam-item-label">Mordazas X</span>
                  <span className="beam-item-value">{beam.jawX} mm</span>
                </div>
                <div className="beam-item">
                  <span className="beam-item-label">Mordazas Y</span>
                  <span className="beam-item-value">{beam.jawY} mm</span>
                </div>
              </div>
            </div>

            <div className="beam-control-points">
              <h5><i className="bi bi-list-ol"></i> Puntos de Control ({beam.numControlPoints})</h5>
              {beam.controlPoints && beam.controlPoints.length > 0 && (
                <div className="control-points-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Gantry</th>
                        <th>Colimador</th>
                        <th>Mesa</th>
                        <th>MU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beam.controlPoints.map((cp, cpIdx) => (
                        <tr key={cpIdx}>
                          <td>{cp.index}</td>
                          <td>{cp.gantryAngle !== null ? cp.gantryAngle.toFixed(1) + '°' : '-'}</td>
                          <td>{cp.collimatorAngle !== null ? cp.collimatorAngle.toFixed(1) + '°' : '-'}</td>
                          <td>{cp.couchAngle !== null ? cp.couchAngle.toFixed(1) + '°' : '-'}</td>
                          <td>{cp.mu !== null ? (cp.mu * 100).toFixed(2) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {(beam.numWedges > 0 || beam.numBlocks > 0) && (
              <div className="beam-accessories">
                <h5><i className="bi bi-tools"></i> Accesorios</h5>
                <div className="beam-grid">
                  {beam.numWedges > 0 && (
                    <div className="beam-item">
                      <span className="beam-item-label">Cuñas</span>
                      <span className="beam-item-value">{beam.numWedges}</span>
                    </div>
                  )}
                  {beam.numBlocks > 0 && (
                    <div className="beam-item">
                      <span className="beam-item-label">Bloques</span>
                      <span className="beam-item-value">{beam.numBlocks}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparisonSummary({ leftPlan, rightPlan }) {
  const differences = []
  const beamComparisons = []

  // Comparar información general
  leftPlan.general.forEach((item, idx) => {
    const rightItem = rightPlan.general[idx]
    if (item.value !== rightItem.value) {
      differences.push({
        type: 'general',
        field: item.label,
        left: item.value,
        right: rightItem.value
      })
    }
  })

  // Comparar número de haces
  if (leftPlan.beams.length !== rightPlan.beams.length) {
    differences.push({
      type: 'beams',
      field: 'Número de haces',
      left: leftPlan.beams.length,
      right: rightPlan.beams.length
    })
  }

  // Comparar cada haz
  const maxBeams = Math.max(leftPlan.beams.length, rightPlan.beams.length)
  for (let i = 0; i < maxBeams; i++) {
    const leftBeam = leftPlan.beams[i]
    const rightBeam = rightPlan.beams[i]
    
    if (!leftBeam || !rightBeam) {
      beamComparisons.push({
        beamNumber: leftBeam?.number || rightBeam?.number,
        missing: !leftBeam ? 'left' : 'right',
        differences: []
      })
      continue
    }

    const beamDiffs = []
    
    // Comparar propiedades del haz
    const propsToCompare = [
      { key: 'name', label: 'Nombre' },
      { key: 'technique', label: 'Técnica' },
      { key: 'type', label: 'Tipo' },
      { key: 'radiationType', label: 'Radiación' },
      { key: 'energy', label: 'Energía' },
      { key: 'gantryAngle', label: 'Ángulo Gantry' },
      { key: 'collimatorAngle', label: 'Ángulo Colimador' },
      { key: 'couchAngle', label: 'Ángulo Mesa' },
      { key: 'mu', label: 'Unidades Monitor' },
      { key: 'numControlPoints', label: 'Puntos de Control' },
      { key: 'jawX', label: 'Mordazas X' },
      { key: 'jawY', label: 'Mordazas Y' }
    ]

    propsToCompare.forEach(prop => {
      if (leftBeam[prop.key] !== rightBeam[prop.key]) {
        beamDiffs.push({
          field: prop.label,
          left: leftBeam[prop.key],
          right: rightBeam[prop.key]
        })
      }
    })

    // Comparar ángulos de arco si aplica
    if (leftBeam.isArc || rightBeam.isArc) {
      if (leftBeam.arcStartAngle !== rightBeam.arcStartAngle) {
        beamDiffs.push({
          field: 'Ángulo Inicio Arco',
          left: leftBeam.arcStartAngle || 'N/A',
          right: rightBeam.arcStartAngle || 'N/A'
        })
      }
      if (leftBeam.arcStopAngle !== rightBeam.arcStopAngle) {
        beamDiffs.push({
          field: 'Ángulo Fin Arco',
          left: leftBeam.arcStopAngle || 'N/A',
          right: rightBeam.arcStopAngle || 'N/A'
        })
      }
      if (leftBeam.gantryRotationDirection !== rightBeam.gantryRotationDirection) {
        beamDiffs.push({
          field: 'Dirección Rotación',
          left: leftBeam.gantryRotationDirection || 'N/A',
          right: rightBeam.gantryRotationDirection || 'N/A'
        })
      }
    }

    // Comparar puntos de control
    const cpDiffs = compareControlPoints(leftBeam.controlPoints, rightBeam.controlPoints)
    
    if (beamDiffs.length > 0 || cpDiffs.length > 0) {
      beamComparisons.push({
        beamNumber: leftBeam.number,
        beamName: leftBeam.name,
        differences: beamDiffs,
        controlPointDiffs: cpDiffs
      })
    }
  }

  return (
    <div className="comparison-summary">
      <h3>
        <i className="bi bi-clipboard-data"></i> Resumen de Diferencias
      </h3>
      
      {differences.length === 0 && beamComparisons.length === 0 ? (
        <p className="no-differences">✓ Los planes son idénticos en todos los campos comparados</p>
      ) : (
        <>
          {differences.length > 0 && (
            <div className="comparison-section">
              <h4>Información General</h4>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Plan A</th>
                    <th>Plan B</th>
                  </tr>
                </thead>
                <tbody>
                  {differences.map((diff, idx) => (
                    <tr key={idx}>
                      <td>{diff.field}</td>
                      <td className="diff-value">{diff.left}</td>
                      <td className="diff-value">{diff.right}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {beamComparisons.length > 0 && (
            <div className="comparison-section">
              <h4>Diferencias en Haces</h4>
              {beamComparisons.map((beam, idx) => (
                <div key={idx} className="beam-comparison">
                  <div className="beam-comparison-header">
                    <span className="beam-number">#{beam.beamNumber}</span>
                    <span className="beam-name">{beam.beamName}</span>
                    {beam.missing && (
                      <span className="beam-missing">
                        Falta en Plan {beam.missing === 'left' ? 'A' : 'B'}
                      </span>
                    )}
                  </div>

                  {beam.differences && beam.differences.length > 0 && (
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Parámetro</th>
                          <th>Plan A</th>
                          <th>Plan B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beam.differences.map((diff, diffIdx) => (
                          <tr key={diffIdx}>
                            <td>{diff.field}</td>
                            <td className="diff-value">{diff.left}</td>
                            <td className="diff-value">{diff.right}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {beam.controlPointDiffs && beam.controlPointDiffs.length > 0 && (
                    <div className="control-point-comparison">
                      <h5>
                        <i className="bi bi-list-ol"></i> 
                        Diferencias en Puntos de Control ({beam.controlPointDiffs.length})
                      </h5>
                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th>CP #</th>
                            <th>Campo</th>
                            <th>Plan A</th>
                            <th>Plan B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {beam.controlPointDiffs.map((cpDiff, cpIdx) => (
                            <tr key={cpIdx}>
                              <td>{cpDiff.index}</td>
                              <td>{cpDiff.field}</td>
                              <td className="diff-value">{cpDiff.left}</td>
                              <td className="diff-value">{cpDiff.right}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function compareControlPoints(leftCPs, rightCPs) {
  const differences = []
  
  if (!leftCPs || !rightCPs) return differences
  
  const maxCPs = Math.max(leftCPs.length, rightCPs.length)
  
  for (let i = 0; i < maxCPs; i++) {
    const leftCP = leftCPs[i]
    const rightCP = rightCPs[i]
    
    if (!leftCP || !rightCP) {
      differences.push({
        index: i,
        field: 'Existencia',
        left: leftCP ? 'Existe' : 'No existe',
        right: rightCP ? 'Existe' : 'No existe'
      })
      continue
    }

    // Comparar ángulo gantry
    if (leftCP.gantryAngle !== null && rightCP.gantryAngle !== null) {
      const diff = Math.abs(leftCP.gantryAngle - rightCP.gantryAngle)
      if (diff > 0.1) { // Tolerancia de 0.1 grados
        differences.push({
          index: i,
          field: 'Gantry',
          left: leftCP.gantryAngle.toFixed(1) + '°',
          right: rightCP.gantryAngle.toFixed(1) + '°'
        })
      }
    }

    // Comparar ángulo colimador
    if (leftCP.collimatorAngle !== null && rightCP.collimatorAngle !== null) {
      const diff = Math.abs(leftCP.collimatorAngle - rightCP.collimatorAngle)
      if (diff > 0.1) {
        differences.push({
          index: i,
          field: 'Colimador',
          left: leftCP.collimatorAngle.toFixed(1) + '°',
          right: rightCP.collimatorAngle.toFixed(1) + '°'
        })
      }
    }

    // Comparar ángulo mesa
    if (leftCP.couchAngle !== null && rightCP.couchAngle !== null) {
      const diff = Math.abs(leftCP.couchAngle - rightCP.couchAngle)
      if (diff > 0.1) {
        differences.push({
          index: i,
          field: 'Mesa',
          left: leftCP.couchAngle.toFixed(1) + '°',
          right: rightCP.couchAngle.toFixed(1) + '°'
        })
      }
    }

    // Comparar MU
    if (leftCP.mu !== null && rightCP.mu !== null) {
      const diff = Math.abs(leftCP.mu - rightCP.mu)
      if (diff > 0.001) { // Tolerancia de 0.001
        differences.push({
          index: i,
          field: 'MU',
          left: (leftCP.mu * 100).toFixed(2),
          right: (rightCP.mu * 100).toFixed(2)
        })
      }
    }

    // Comparar mordazas X
    if (leftCP.jawX && rightCP.jawX) {
      if (Math.abs(leftCP.jawX[0] - rightCP.jawX[0]) > 0.1 || 
          Math.abs(leftCP.jawX[1] - rightCP.jawX[1]) > 0.1) {
        differences.push({
          index: i,
          field: 'Jaw X',
          left: `[${leftCP.jawX[0].toFixed(1)}, ${leftCP.jawX[1].toFixed(1)}]`,
          right: `[${rightCP.jawX[0].toFixed(1)}, ${rightCP.jawX[1].toFixed(1)}]`
        })
      }
    }

    // Comparar mordazas Y
    if (leftCP.jawY && rightCP.jawY) {
      if (Math.abs(leftCP.jawY[0] - rightCP.jawY[0]) > 0.1 || 
          Math.abs(leftCP.jawY[1] - rightCP.jawY[1]) > 0.1) {
        differences.push({
          index: i,
          field: 'Jaw Y',
          left: `[${leftCP.jawY[0].toFixed(1)}, ${leftCP.jawY[1].toFixed(1)}]`,
          right: `[${rightCP.jawY[0].toFixed(1)}, ${rightCP.jawY[1].toFixed(1)}]`
        })
      }
    }
  }
  
  return differences
}

export default RTPlanCompare
