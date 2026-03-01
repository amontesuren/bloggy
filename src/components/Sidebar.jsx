import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'

const links = [
  { href: '/', icon: 'bi-house-door', label: 'Inicio', section: 'Blog' },
  { href: '/convert-units', icon: 'bi-arrow-left-right', label: 'Conversor Ci–Bq', section: 'Aplicaciones' },
  { href: '/decay-calculator', icon: 'bi-clock-history', label: 'Decay Calculator', section: 'Aplicaciones' },
  { href: '/restricciones-lu177', icon: 'bi-activity', label: 'Lu-177 Restricciones', section: 'Aplicaciones' },
  { href: '/uniformidad-gamma', icon: 'bi-grid-1x2-fill', label: 'Uniformidad NEMA', section: 'Aplicaciones' }
]

function Sidebar() {
  const location = useLocation()
  const [topics, setTopics] = useState([])
  
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
    <aside className="sidebar">
      <Link to="/" className="sidebar-brand">
        <div className="s-avatar"></div>
        <span className="s-name">Falken's Maze<span className="cursor">_</span></span>
      </Link>
      
      <nav className="sidebar-nav">
        {sections.map(sec => (
          <div key={sec} className="nav-section">
            <span className="nav-section-label">{sec}</span>
            {links.filter(l => l.section === sec).map(l => (
              <Link 
                key={l.href}
                to={l.href} 
                className={`nav-link-item${location.pathname === l.href && !currentTopic ? ' active' : ''}`}
              >
                <i className={`bi ${l.icon}`}></i> {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      
      {topics.length > 0 && (
        <div className="nav-section">
          <span className="nav-section-label">Temas</span>
          <Link 
            to="/" 
            className={`nav-link-item${location.pathname === '/' && !currentTopic ? ' active' : ''}`}
          >
            <i className="bi bi-grid-3x3-gap"></i> Todos
          </Link>
          {topics.map(t => (
            <Link 
              key={t}
              to={`/?t=${encodeURIComponent(t)}`}
              className={`nav-link-item${currentTopic === t ? ' active' : ''}`}
            >
              <i className="bi bi-tag"></i> {t}
            </Link>
          ))}
        </div>
      )}
      
      <div className="sidebar-footer">Física Médica &amp; Medicina Nuclear</div>
    </aside>
  )
}

export default Sidebar
