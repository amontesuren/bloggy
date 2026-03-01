import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

const links = [
  { href: '/', icon: 'bi-house-door', label: 'Inicio', section: 'Blog' },
  { href: '/convert-units', icon: 'bi-arrow-left-right', label: 'Conversor Ci–Bq', section: 'Aplicaciones' },
  { href: '/decay-calculator', icon: 'bi-clock-history', label: 'Decay Calculator', section: 'Aplicaciones' },
  { href: '/restricciones-lu177', icon: 'bi-activity', label: 'Lu-177 Restricciones', section: 'Aplicaciones' },
  { href: '/uniformidad-gamma', icon: 'bi-grid-1x2-fill', label: 'Uniformidad NEMA', section: 'Aplicaciones' }
]

function Topbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [topics, setTopics] = useState([])
  const location = useLocation()
  const currentTopic = new URLSearchParams(location.search).get('t')

  useEffect(() => {
    loadTopics()
  }, [])

  const loadTopics = async () => {
    try {
      const snap = await getDocs(collection(db, 'BLOG'))
      const topicsSet = new Set()
      snap.forEach(doc => {
        const t = doc.data().topic
        if (t) topicsSet.add(t)
      })
      setTopics([...topicsSet].sort())
    } catch (error) {
      console.error('Error loading topics:', error)
    }
  }

  const sections = ['Blog', 'Aplicaciones']

  return (
    <>
      <header className="topbar">
        <button 
          className="topbar-toggle" 
          type="button" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir menú"
        >
          <i className="bi bi-list"></i>
        </button>
        <div className="topbar-logo"></div>
        <span className="topbar-name">Falken's Maze</span>
      </header>

      {/* Backdrop */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Offcanvas */}
      <div 
        className={`offcanvas offcanvas-start${isOpen ? ' show' : ''}`}
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 200
        }}
      >
        <div className="offcanvas-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <div className="s-avatar"></div>
            <span className="s-name">Falken's Maze</span>
          </div>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1
            }}
          >
            <i className="bi bi-x"></i>
          </button>
        </div>
        <div className="offcanvas-body p-0">
          <nav className="sidebar-nav">
            {sections.map(sec => (
              <div key={sec} className="nav-section">
                <span className="nav-section-label">{sec}</span>
                {links.filter(l => l.section === sec).map(l => (
                  <Link 
                    key={l.href}
                    to={l.href} 
                    className={`nav-link-item${location.pathname === l.href && !currentTopic ? ' active' : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className={`bi ${l.icon}`}></i> {l.label}
                  </Link>
                ))}
              </div>
            ))}
            
            {/* Topics section */}
            {topics.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-label">Temas</span>
                <Link 
                  to="/" 
                  className={`nav-link-item${location.pathname === '/' && !currentTopic ? ' active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <i className="bi bi-grid-3x3-gap"></i> Todos
                </Link>
                {topics.map(t => (
                  <Link 
                    key={t}
                    to={`/?t=${encodeURIComponent(t)}`}
                    className={`nav-link-item${currentTopic === t ? ' active' : ''}`}
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="bi bi-tag"></i> {t}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  )
}

export default Topbar
