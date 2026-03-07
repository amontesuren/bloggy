import { useState, useRef } from 'react'
import { parseRTPlanBrachy } from '../lib/brachy/rtplanParser'
import { makeSourceTrain, calculateTotalDose } from '../lib/brachy/tg43'
import { IR192_CONSTANTS } from '../lib/brachy/sourceData'
import '../styles/tg43.css'

function Tg43Calculator() {
  const [plan, setPlan] = useState(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [calculationPoints, setCalculationPoints] = useState([])
  const [results, setResults] = useState(null)
  
  const fileInputRef = useRef()

  const handleFileLoad = (file) => {
    if (!file) return

    setLoading(true)
    setError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsedPlan = parseRTPlanBrachy(e.target.result)
        setPlan(parsedPlan)
        setFileName(file.name)
        setLoading(false)
        
        // Inicializar con un punto de ejemplo
        setCalculationPoints([
          { name: 'Punto A', x: 0, y: 0, z: 20, prescribedDose: null }
        ])
      } catch (err) {
        setError('Error al parsear el archivo: ' + err.message)
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setError('Error al leer el archivo')
      setLoading(false)
    }
    reader.readAsArrayBuffer(file)
  }

  const addCalculationPoint = () => {
    setCalculationPoints([
      ...calculationPoints,
      { name: `Punto ${calculationPoints.length + 1}`, x: 0, y: 0, z: 0, prescribedDose: null }
    ])
  }

  const updatePoint = (index, field, value) => {
    const updated = [...calculationPoints]
    updated[index][field] = field === 'name' ? value : parseFloat(value) || 0
    setCalculationPoints(updated)
  }

  const removePoint = (index) => {
    setCalculationPoints(calculationPoints.filter((_, i) => i !== index))
  }

  const calculateDoses = () => {
    if (!plan || calculationPoints.length === 0) return

    try {
      // Crear source train desde todos los dwells
      const allDwells = []
      plan.channels.forEach(channel => {
        allDwells.push(...channel.dwells)
      })

      const sources = makeSourceTrain(
        allDwells,
        plan.refAirKermaRate,
        IR192_CONSTANTS.doseRateConstant,
        IR192_CONSTANTS.activeLength,
        plan.halfLife
      )

      console.log('Sources creadas:', sources.length)
      console.log('Calculando dosis en', calculationPoints.length, 'puntos...')

      // Calcular dosis en cada punto
      const calculatedResults = calculationPoints.map(point => {
        // Convertir coordenadas de mm a cm
        const pointCm = {
          x: point.x / 10,
          y: point.y / 10,
          z: point.z / 10
        }

        const dose = calculateTotalDose(sources, pointCm)
        
        return {
          name: point.name,
          coords: [point.x, point.y, point.z],
          prescribedDose: point.prescribedDose,
          calculatedDose: dose,
          difference: point.prescribedDose ? ((dose - point.prescribedDose) / point.prescribedDose * 100) : null
        }
      })

      setResults(calculatedResults)
      console.log('Resultados:', calculatedResults)
    } catch (err) {
      setError('Error al calcular dosis: ' + err.message)
      console.error(err)
    }
  }

  const clearPlan = () => {
    setPlan(null)
    setFileName('')
    setCalculationPoints([])
    setResults(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page-body" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <div className="page-header">
        <div className="page-icon"><i className="bi bi-radioactive"></i></div>
        <h1 className="page-title">Calculador TG-43</h1>
        <p className="page-subtitle">Verificación de dosis en braquiterapia HDR (Ir-192)</p>
      </div>

      {/* Upload Section */}
      {!plan ? (
        <div className="tg43-upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,.dicom,application/dicom"
            style={{ display: 'none' }}
            onChange={(e) => handleFileLoad(e.target.files[0])}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
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
              handleFileLoad(e.dataTransfer.files[0])
            }}
            className="tg43-dropzone"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                <p>Cargando RT Plan...</p>
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-medical" style={{ fontSize: '3rem', color: 'var(--text-muted)' }}></i>
                <p style={{ fontWeight: 600, marginTop: '12px' }}>Arrastra RT Plan de Braquiterapia aquí</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>o haz clic para seleccionar</p>
              </>
            )}
          </div>

          {error && (
            <div className="tg43-error">
              <i className="bi bi-exclamation-triangle"></i> {error}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Plan Info */}
          <div className="tg43-plan-info">
            <div className="tg43-plan-header">
              <div>
                <i className="bi bi-file-earmark-check"></i> {fileName}
              </div>
              <button onClick={clearPlan} className="btn-clear">
                <i className="bi bi-x-circle"></i>
              </button>
            </div>
            
            <div className="tg43-info-grid">
              <div className="tg43-info-item">
                <span className="tg43-info-label">Isótopo</span>
                <span className="tg43-info-value">{plan.sourceIsotope || 'Ir-192'}</span>
              </div>
              <div className="tg43-info-item">
                <span className="tg43-info-label">Vida Media</span>
                <span className="tg43-info-value">{plan.halfLife.toFixed(2)} días</span>
              </div>
              <div className="tg43-info-item">
                <span className="tg43-info-label">Ref. Air Kerma Rate</span>
                <span className="tg43-info-value">{plan.refAirKermaRate.toFixed(3)} U</span>
              </div>
              <div className="tg43-info-item">
                <span className="tg43-info-label">Máquina</span>
                <span className="tg43-info-value">{plan.treatmentModel || 'N/A'}</span>
              </div>
              <div className="tg43-info-item">
                <span className="tg43-info-label">Canales</span>
                <span className="tg43-info-value">{plan.channels.length}</span>
              </div>
              <div className="tg43-info-item">
                <span className="tg43-info-label">Total Dwells</span>
                <span className="tg43-info-value">
                  {plan.channels.reduce((sum, ch) => sum + ch.dwells.length, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Calculation Points */}
          <div className="tg43-section">
            <div className="tg43-section-header">
              <h3><i className="bi bi-geo-alt"></i> Puntos de Cálculo</h3>
              <button onClick={addCalculationPoint} className="btn-add">
                <i className="bi bi-plus-circle"></i> Añadir Punto
              </button>
            </div>

            <div className="tg43-points-list">
              {calculationPoints.map((point, idx) => (
                <div key={idx} className="tg43-point-card">
                  <div className="tg43-point-header">
                    <input
                      type="text"
                      value={point.name}
                      onChange={(e) => updatePoint(idx, 'name', e.target.value)}
                      className="dark-input tg43-point-name"
                      placeholder="Nombre del punto"
                    />
                    <button onClick={() => removePoint(idx)} className="btn-remove">
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                  
                  <div className="tg43-point-coords">
                    <div className="tg43-coord-input">
                      <label>X (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={point.x}
                        onChange={(e) => updatePoint(idx, 'x', e.target.value)}
                        className="dark-input"
                      />
                    </div>
                    <div className="tg43-coord-input">
                      <label>Y (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={point.y}
                        onChange={(e) => updatePoint(idx, 'y', e.target.value)}
                        className="dark-input"
                      />
                    </div>
                    <div className="tg43-coord-input">
                      <label>Z (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={point.z}
                        onChange={(e) => updatePoint(idx, 'z', e.target.value)}
                        className="dark-input"
                      />
                    </div>
                    <div className="tg43-coord-input">
                      <label>Dosis Prescrita (Gy)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={point.prescribedDose || ''}
                        onChange={(e) => updatePoint(idx, 'prescribedDose', e.target.value)}
                        className="dark-input"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={calculateDoses} className="btn-calculate">
              <i className="bi bi-calculator"></i> Calcular Dosis
            </button>
          </div>

          {/* Results */}
          {results && (
            <div className="tg43-section">
              <h3><i className="bi bi-clipboard-data"></i> Resultados</h3>
              
              <div className="tg43-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>Punto</th>
                      <th>Coordenadas (mm)</th>
                      <th>Dosis Calculada (Gy)</th>
                      <th>Dosis Prescrita (Gy)</th>
                      <th>Diferencia (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr key={idx}>
                        <td className="tg43-result-name">{result.name}</td>
                        <td className="tg43-result-coords">
                          [{result.coords[0].toFixed(1)}, {result.coords[1].toFixed(1)}, {result.coords[2].toFixed(1)}]
                        </td>
                        <td className="tg43-result-dose">{result.calculatedDose.toFixed(3)}</td>
                        <td className="tg43-result-prescribed">
                          {result.prescribedDose ? result.prescribedDose.toFixed(3) : '-'}
                        </td>
                        <td className={`tg43-result-diff ${
                          result.difference !== null 
                            ? Math.abs(result.difference) < 3 ? 'good' : Math.abs(result.difference) < 5 ? 'warning' : 'bad'
                            : ''
                        }`}>
                          {result.difference !== null ? `${result.difference > 0 ? '+' : ''}${result.difference.toFixed(2)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="tg43-info-box">
                <i className="bi bi-info-circle"></i>
                <div>
                  <strong>Nota:</strong> Los cálculos se basan en el formalismo TG-43 (AAPM 2004) 
                  con datos tabulados para Ir-192. Las coordenadas deben estar en el sistema de referencia del plan.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="tg43-error">
              <i className="bi bi-exclamation-triangle"></i> {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Tg43Calculator
