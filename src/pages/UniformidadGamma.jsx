import { useState, useRef, useEffect } from 'react'
import { parseDICOM } from '../utils/dicomParser'
import { calculateNEMA } from '../utils/nemaAlgorithms'
import { renderCanvas } from '../utils/canvasRenderer'

const LIMITS = { IUufov: 5.0, IUcfov: 3.5, DUufov: 3.0, DUcfov: 2.5 }

function UniformidadGamma() {
  const [parsedDICOM, setParsedDICOM] = useState(null)
  const [fileName, setFileName] = useState('')
  const [frame, setFrame] = useState(0)
  const [targetSize, setTargetSize] = useState(78)
  const [status, setStatus] = useState('Carga un archivo DICOM de flood intrínseco para comenzar')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  const fileInputRef = useRef()
  const canvasOrigRef = useRef()
  const canvasUFOVRef = useRef()
  const canvasCFOVRef = useRef()

  const handleFileSelect = (file) => {
    if (!file) return
    setStatus('Leyendo archivo DICOM…')
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = parseDICOM(e.target.result)
        setParsedDICOM(parsed)
        setFileName(file.name)
        setFrame(0)
        setStatus('DICOM cargado correctamente. Ajusta las opciones y pulsa Calcular.')
        setLoading(false)
        setResults(null)
      } catch (err) {
        setStatus('Error al parsear el DICOM: ' + err.message)
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setStatus('Error al leer el archivo.')
      setLoading(false)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleCalculate = () => {
    if (!parsedDICOM) return

    setStatus('Calculando uniformidad NEMA…')
    setLoading(true)

    setTimeout(() => {
      try {
        const rawData = parsedDICOM.frames[frame]
        const res = calculateNEMA(rawData, parsedDICOM.rows, parsedDICOM.cols, targetSize)

        // Render images
        renderCanvas(canvasOrigRef.current, rawData, null, parsedDICOM.rows, parsedDICOM.cols)
        renderCanvas(canvasUFOVRef.current, res.data, res.ufovMask, res.rows, res.cols)
        renderCanvas(canvasCFOVRef.current, res.data, res.cfovMask, res.rows, res.cols)

        setResults(res)
        setStatus(`Cálculo completado · ${res.rows} × ${res.cols} px tras remuestreo.`)
        setLoading(false)
      } catch (err) {
        setStatus('Error durante el cálculo: ' + err.message)
        setLoading(false)
        console.error(err)
      }
    }, 50)
  }

  const DUufov = results ? Math.max(results.DUvertUfov, results.DUhorizUfov) : 0
  const DUcfov = results ? Math.max(results.DUvertCfov, results.DUhorizCfov) : 0

  const getBadge = (value, limit) => {
    const ok = value <= limit
    return {
      text: ok ? '✓ Conforme' : '✗ No conforme',
      className: ok ? 'bg-ok' : 'bg-fail'
    }
  }

  const tableRows = results ? [
    { param: 'Uniformidad Integral (IU)', region: 'UFOV', val: results.IUufov, limit: LIMITS.IUufov },
    { param: 'Uniformidad Integral (IU)', region: 'CFOV (75 %)', val: results.IUcfov, limit: LIMITS.IUcfov },
    { param: 'Uniformidad Diferencial — vertical', region: 'UFOV', val: results.DUvertUfov, limit: LIMITS.DUufov },
    { param: 'Uniformidad Diferencial — horizontal', region: 'UFOV', val: results.DUhorizUfov, limit: LIMITS.DUufov },
    { param: 'Uniformidad Diferencial — vertical', region: 'CFOV (75 %)', val: results.DUvertCfov, limit: LIMITS.DUcfov },
    { param: 'Uniformidad Diferencial — horizontal', region: 'CFOV (75 %)', val: results.DUhorizCfov, limit: LIMITS.DUcfov }
  ] : []

  return (
    <div className="page-body" style={{ maxWidth: '980px' }}>
      <div className="page-header">
        <div className="page-icon"><i className="bi bi-grid-1x2-fill"></i></div>
        <h1 className="page-title">Uniformidad Intrínseca NEMA</h1>
        <p className="page-subtitle">Prueba NEMA NU 1 — Uniformidad Integral y Diferencial de gammacámara · Flood intrínseco</p>
      </div>

      <div className="calc-card" style={{ marginBottom: '20px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dcm,.dicom,application/dicom"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e.target.files[0])}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.style.borderColor = 'var(--accent-blue)'
            e.currentTarget.style.background = 'rgba(136,192,208,0.05)'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'transparent'
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'transparent'
            handleFileSelect(e.dataTransfer.files[0])
          }}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '12px',
            padding: '44px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background 0.2s'
          }}
        >
          <div style={{ fontSize: '2.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            <i className="bi bi-file-medical"></i>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
            Arrastra el archivo DICOM aquí
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            o haz clic para seleccionar &nbsp;·&nbsp; Flood intrínseco (.dcm)
          </div>
        </div>

        {parsedDICOM && (
          <div style={{
            display: 'block',
            marginTop: '14px',
            padding: '10px 16px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            <i className="bi bi-file-earmark-check" style={{ color: 'var(--accent-green)', marginRight: '6px' }}></i>
            {fileName} · {parsedDICOM.rows} × {parsedDICOM.cols} px · {parsedDICOM.numFrames} frame{parsedDICOM.numFrames > 1 ? 's' : ''}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          marginTop: '18px'
        }}>
          <div>
            <label className="field-label">Frame DICOM</label>
            <select
              className="dark-select"
              value={frame}
              onChange={(e) => setFrame(parseInt(e.target.value))}
              disabled={!parsedDICOM || parsedDICOM.numFrames <= 1}
            >
              {parsedDICOM && Array.from({ length: parsedDICOM.numFrames }, (_, i) => (
                <option key={i} value={i}>Frame {i + 1}</option>
              ))}
              {!parsedDICOM && <option value="0">Frame 1</option>}
            </select>
          </div>
          <div>
            <label className="field-label">Resolución análisis</label>
            <select
              className="dark-select"
              value={targetSize}
              onChange={(e) => setTargetSize(parseInt(e.target.value))}
            >
              <option value="64">64 × 64 px</option>
              <option value="78">78 × 78 px</option>
              <option value="128">128 × 128 px</option>
              <option value="0">Sin remuestreo</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={!parsedDICOM || loading}
          style={{
            width: '100%',
            marginTop: '18px',
            padding: '12px',
            background: 'var(--accent-blue)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: parsedDICOM && !loading ? 'pointer' : 'not-allowed',
            opacity: parsedDICOM && !loading ? 1 : 0.35,
            transition: 'opacity 0.15s'
          }}
        >
          <i className="bi bi-play-fill"></i>&nbsp; Calcular Uniformidad NEMA
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '12px',
          padding: '9px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          minHeight: '38px'
        }}>
          {loading ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent-blue)',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite'
              }}></span>
              <span>{status}</span>
            </>
          ) : (
            <>
              <i className="bi bi-info-circle"></i>
              <span>{status}</span>
            </>
          )}
        </div>
      </div>

      {results && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <MetricCard
              label="IU — UFOV"
              value={results.IUufov}
              limit={LIMITS.IUufov}
            />
            <MetricCard
              label="IU — CFOV"
              value={results.IUcfov}
              limit={LIMITS.IUcfov}
            />
            <MetricCard
              label="DU — UFOV"
              value={DUufov}
              limit={LIMITS.DUufov}
            />
            <MetricCard
              label="DU — CFOV"
              value={DUcfov}
              limit={LIMITS.DUcfov}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <ImagePanel
              label="Imagen original"
              canvasRef={canvasOrigRef}
              subtitle={`${parsedDICOM.rows} × ${parsedDICOM.cols} px · frame ${frame + 1}`}
            />
            <ImagePanel
              label="UFOV"
              canvasRef={canvasUFOVRef}
              subtitle="Campo de visión útil completo"
            />
            <ImagePanel
              label="CFOV (75 %)"
              canvasRef={canvasCFOVRef}
              subtitle="75 % central del UFOV"
            />
          </div>

          <div className="calc-card">
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-muted)',
              marginBottom: '16px'
            }}>
              Resultados detallados
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr>
                  {['Parámetro', 'Región', 'Valor', 'Límite ref.', 'Estado'].map(h => (
                    <th key={h} style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10.5px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '10px 16px',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border)'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, idx) => {
                  const badge = getBadge(row.val, row.limit)
                  return (
                    <tr key={idx}>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--border-sub)',
                        color: 'var(--text-secondary)'
                      }}>{row.param}</td>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--border-sub)',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                      }}>{row.region}</td>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--border-sub)',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>{row.val.toFixed(2)} %</td>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--border-sub)',
                        color: 'var(--text-muted)'
                      }}>≤ {row.limit.toFixed(1)} %</td>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--border-sub)'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          minWidth: '80px',
                          textAlign: 'center',
                          background: badge.className === 'bg-ok' ? 'rgba(163,190,140,0.15)' : 'rgba(191,97,106,0.15)',
                          color: badge.className === 'bg-ok' ? 'var(--accent-green)' : 'var(--accent-red)',
                          border: badge.className === 'bg-ok' ? '1px solid rgba(163,190,140,0.3)' : '1px solid rgba(191,97,106,0.3)'
                        }}>
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{
              marginTop: '16px',
              padding: '11px 16px',
              background: 'rgba(136,192,208,0.06)',
              borderLeft: '3px solid var(--accent-blue)',
              borderRadius: '0 8px 8px 0',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.6
            }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Referencias NEMA NU 1-2012:</strong>
              {' '}Límites típicos de aceptación clínica:
              IU UFOV ≤ 5,0 % &nbsp;·&nbsp; IU CFOV ≤ 3,5 % &nbsp;·&nbsp; DU UFOV ≤ 3,0 % &nbsp;·&nbsp; DU CFOV ≤ 2,5 %.
              Los píxeles en azul oscuro en las imágenes corresponden a la región enmascarada (excluida del análisis).
              Verificar con los criterios del fabricante y el protocolo local de control de calidad.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function MetricCard({ label, value, limit }) {
  const badge = value <= limit ? { text: '✓ Conforme', className: 'bg-ok' } : { text: '✗ No conforme', className: 'bg-fail' }
  
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '18px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
        color: 'var(--text-muted)',
        marginBottom: '8px'
      }}>{label}</div>
      <div style={{
        fontSize: '2rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-primary)'
      }}>{value.toFixed(2)}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>%</div>
      <div style={{
        display: 'inline-block',
        marginTop: '8px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 600,
        background: badge.className === 'bg-ok' ? 'rgba(163,190,140,0.15)' : 'rgba(191,97,106,0.15)',
        color: badge.className === 'bg-ok' ? 'var(--accent-green)' : 'var(--accent-red)',
        border: badge.className === 'bg-ok' ? '1px solid rgba(163,190,140,0.3)' : '1px solid rgba(191,97,106,0.3)'
      }}>
        {badge.text}
      </div>
    </div>
  )
}

function ImagePanel({ label, canvasRef, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '14px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '10.5px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        color: 'var(--text-muted)',
        marginBottom: '10px'
      }}>
        <i className={`bi ${label.includes('original') ? 'bi-image' : label.includes('UFOV') ? 'bi-bounding-box' : 'bi-bounding-box-circles'}`}></i>
        &nbsp; {label}
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
          imageRendering: 'pixelated',
          borderRadius: '6px',
          display: 'block'
        }}
      />
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginTop: '6px'
      }}>{subtitle}</div>
    </div>
  )
}

export default UniformidadGamma
