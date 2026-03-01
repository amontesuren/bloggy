import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const TREATMENTS = {
  dotatate: { name: "Lu-DOTA-TATE", cycles_default: 4, tef1: 25.0, tef2: 55.0 },
  psma: { name: "Lu-PSMA-617", cycles_default: 6, tef1: 22.0, tef2: 42.0 }
}

const LN2 = 0.69314718

const groups = [
  { name: "Pareja (Embarazada)", lim: 1.0, fn: 2.33, fr: 0.06 },
  { name: "Pareja (< 60 años)", lim: 3.0, fn: 2.33, fr: 0.25 },
  { name: "Pareja (> 60 años)", lim: 5.0, fn: 2.33, fr: 0.25 },
  { name: "Niños (< 2 años)", lim: 1.0, fn: 2.28, fr: 0.06 },
  { name: "Niños (2–5 años)", lim: 1.0, fn: 1.38, fr: 0.09 },
  { name: "Niños (5–11 años)", lim: 1.0, fn: 0.69, fr: 0.09 },
  { name: "Niños (> 11 años)", lim: 1.0, fn: 0.43, fr: 0.06 },
  { name: "Trabajo General", lim: 0.3, fn: 0.33, fr: 0.0001 },
  { name: "Trabajo Niños", lim: 0.3, fn: 0.91, fr: 0.0001 }
]

const LIMITS = { IUufov: 5.0, IUcfov: 3.5, DUufov: 3.0, DUcfov: 2.5 }

function RestricionesLu177() {
  const [treatment, setTreatment] = useState('dotatate')
  const [cycles, setCycles] = useState(4)
  const [scenario, setScenario] = useState('24')
  const [rate, setRate] = useState(20)
  const [showDebug, setShowDebug] = useState(false)
  const [results, setResults] = useState([])
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  useEffect(() => {
    setCycles(TREATMENTS[treatment].cycles_default)
  }, [treatment])

  useEffect(() => {
    calcular()
  }, [treatment, cycles, scenario, rate, showDebug])

  const calcular = () => {
    const params = TREATMENTS[treatment]
    const H_dot = parseFloat(rate) || 0
    const C = parseFloat(cycles) || 1
    const tau = scenario === '6' ? 18.0 : 0.0
    const T1 = params.tef1
    const T2 = params.tef2

    const newResults = groups.map(g => {
      const RD_c_uSv = (g.lim / C) * 1000.0
      let tf = 0, debugStr = ''

      try {
        const term_limit = LN2 * RD_c_uSv
        if (scenario === '24') {
          const num = H_dot * T2 * (g.fn - g.fr)
          const den = term_limit - (g.fr * H_dot * T2)
          debugStr = `Ec.5: Num=${Math.round(num)} Den=${Math.round(den)}`
          if (den <= 0) tf = 999
          else {
            const arg = num / den
            tf = arg <= 0 ? 0 : (T2 / LN2) * Math.log(arg)
          }
        } else {
          const exp_tau = Math.exp(-(LN2 * tau) / T1)
          const num = H_dot * T2 * (g.fn - g.fr) * exp_tau
          const eff_time_restr = T1 + (exp_tau * (T2 - T1))
          const den = term_limit - (g.fr * H_dot * eff_time_restr)
          debugStr = `Ec.3: Num=${Math.round(num)} Den=${Math.round(den)}`
          if (den <= 0) tf = 999
          else {
            const arg = num / den
            tf = arg <= 0 ? 0 : tau + (T2 / LN2) * Math.log(arg)
          }
        }
      } catch (e) {
        tf = 999
      }

      if (tf < 0) tf = 0
      const days = tf > 1440 ? 61 : Math.ceil(tf / 24)
      
      let badgeClass = 'bg-err', badgeText = '> 60 días'
      if (days === 0) {
        badgeClass = 'bg-ok'
        badgeText = 'Vida normal'
      } else if (days <= 60) {
        badgeText = `${days} días`
        badgeClass = days <= 5 ? 'bg-warn' : 'bg-err'
      }

      return { ...g, tf, days, badgeClass, badgeText, debugStr, RD_c_uSv }
    })

    setResults(newResults)
    updateChart(H_dot, tau, T1, T2)
  }

  const updateChart = (H0, tau, T1, T2) => {
    if (!chartRef.current) return

    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    const labels = [], data = []
    const lam1 = LN2 / T1, lam2 = LN2 / T2

    for (let h = 0; h <= 168; h += 4) {
      labels.push((h / 24).toFixed(1) + 'd')
      const val = h <= tau
        ? H0 * Math.exp(-lam1 * h)
        : (H0 * Math.exp(-lam1 * tau)) * Math.exp(-lam2 * (h - tau))
      data.push(val)
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tasa estimada (µSv/h)',
          data,
          borderColor: '#88c0d0',
          backgroundColor: 'rgba(136,192,208,0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#d8dee9', font: { size: 12 } } }
        },
        scales: {
          x: {
            ticks: { color: '#7b88a1', font: { size: 11 } },
            grid: { color: 'rgba(76,86,106,0.5)' }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'µSv/h', color: '#7b88a1', font: { size: 12 } },
            ticks: { color: '#7b88a1', font: { size: 11 } },
            grid: { color: 'rgba(76,86,106,0.5)' }
          }
        }
      }
    })
  }

  const params = TREATMENTS[treatment]

  return (
    <div className="page-body" style={{ maxWidth: '960px' }}>
      <div className="page-header">
        <div className="page-icon"><i className="bi bi-activity"></i></div>
        <h1 className="page-title">Restricciones Dosimétrica Lu-177</h1>
        <p className="page-subtitle">Farmacocinética ajustada · DOTA-TATE / PSMA-617</p>
      </div>

      <div className="calc-card" style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div>
            <label className="field-label">Fármaco</label>
            <select className="dark-select" value={treatment} onChange={e => setTreatment(e.target.value)}>
              <option value="dotatate">Lu-DOTA-TATE</option>
              <option value="psma">Lu-PSMA-617</option>
            </select>
          </div>
          <div>
            <label className="field-label">Ciclos totales</label>
            <input type="number" className="dark-input" value={cycles} onChange={e => setCycles(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Momento del alta</label>
            <select className="dark-select" value={scenario} onChange={e => setScenario(e.target.value)}>
              <option value="24">Alta a las 24 h</option>
              <option value="6">Alta a las 6 h</option>
            </select>
          </div>
          <div>
            <label className="field-label">Tasa a 1 m (µSv/h)</label>
            <input type="number" className="dark-input" value={rate} onChange={e => setRate(e.target.value)} step="0.5" min="0" />
          </div>
        </div>

        <div style={{
          background: 'rgba(136,192,208,0.08)',
          borderLeft: '3px solid var(--accent-blue)',
          borderRadius: '0 6px 6px 0',
          padding: '10px 16px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '20px'
        }}>
          <strong>{params.name}:</strong> T<sub>ef,1</sub> = {params.tef1} h, T<sub>ef,2</sub> = {params.tef2} h &nbsp;·&nbsp; Límite dividido entre {cycles} ciclos.
        </div>

        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            textDecoration: 'underline',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            float: 'right'
          }}
        >
          Ver cálculo matemático
        </button>
        <div style={{ clear: 'both' }}></div>

        <div style={{ overflowX: 'auto', marginTop: '8px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr>
                <th style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '11px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)'
                }}>Grupo de convivencia</th>
                <th style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '11px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)'
                }}>Límite (RD)</th>
                <th style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '11px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)'
                }}>Límite / ciclo</th>
                <th style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '11px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)'
                }}>Restricción (t<sub>f</sub>)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <>
                  <tr key={idx}>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-sub)',
                      color: 'var(--text-secondary)'
                    }}>{row.name}</td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-sub)',
                      color: 'var(--text-muted)'
                    }}>{row.lim} mSv</td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-sub)',
                      color: 'var(--text-muted)'
                    }}>{(row.lim / cycles).toFixed(3)} mSv</td>
                    <td style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-sub)'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontWeight: 600,
                        fontSize: '12px',
                        minWidth: '100px',
                        textAlign: 'center',
                        background: row.badgeClass === 'bg-ok' ? 'rgba(163,190,140,0.15)' :
                          row.badgeClass === 'bg-warn' ? 'rgba(235,203,139,0.15)' : 'rgba(191,97,106,0.15)',
                        color: row.badgeClass === 'bg-ok' ? 'var(--accent-green)' :
                          row.badgeClass === 'bg-warn' ? 'var(--accent-yellow)' : 'var(--accent-red)',
                        border: row.badgeClass === 'bg-ok' ? '1px solid rgba(163,190,140,0.3)' :
                          row.badgeClass === 'bg-warn' ? '1px solid rgba(235,203,139,0.3)' : '1px solid rgba(191,97,106,0.3)'
                      }}>
                        {row.badgeText}
                      </span>
                    </td>
                  </tr>
                  {showDebug && (
                    <tr key={`debug-${idx}`} style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      <td colSpan="4" style={{
                        padding: '6px 16px',
                        borderBottom: '1px solid var(--border-sub)'
                      }}>
                        DEBUG: {row.debugStr} | Raw tf = {row.tf.toFixed(2)} h
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '24px 28px',
        marginBottom: '20px'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '16px'
        }}>
          <i className="bi bi-graph-down" style={{ marginRight: '6px' }}></i>
          Evolución de tasa de dosis estimada
        </div>
        <div style={{ height: '280px' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  )
}

export default RestricionesLu177
