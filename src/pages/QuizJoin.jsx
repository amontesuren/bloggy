import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import '../styles/quiz.css'

function QuizJoin() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [currentAnswer, setCurrentAnswer] = useState(null)
  const [hasAnswered, setHasAnswered] = useState(false)

  useEffect(() => {
    if (session && session.estado === 'jugando') {
      setHasAnswered(false)
      setCurrentAnswer(null)
    }
  }, [session?.preguntaActual])

  useEffect(() => {
    if (code && playerId) {
      const unsubscribe = onSnapshot(doc(db, 'QUIZ_SESSIONS', code), (docSnap) => {
        if (docSnap.exists()) {
          setSession(docSnap.data())
        } else {
          setError('La sesión ha finalizado')
          setSession(null)
        }
      })
      return unsubscribe
    }
  }, [code, playerId])

  useEffect(() => {
    if (session && session.quizId && !quiz) {
      loadQuiz(session.quizId)
    }
  }, [session])

  const loadQuiz = async (quizId) => {
    try {
      const docSnap = await getDoc(doc(db, 'QUIZZES', quizId))
      if (docSnap.exists()) {
        setQuiz({ id: docSnap.id, ...docSnap.data() })
      }
    } catch (err) {
      console.error('Error loading quiz:', err)
    }
  }

  const joinSession = async () => {
    if (!code.trim() || !playerName.trim()) {
      setError('Introduce el código y tu nombre')
      return
    }

    setLoading(true)
    setError('')

    try {
      const sessionRef = doc(db, 'QUIZ_SESSIONS', code)
      const sessionSnap = await getDoc(sessionRef)

      if (!sessionSnap.exists()) {
        setError('Código inválido')
        setLoading(false)
        return
      }

      const sessionData = sessionSnap.data()
      if (sessionData.estado !== 'lobby') {
        setError('La sesión ya ha comenzado')
        setLoading(false)
        return
      }

      const pid = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setPlayerId(pid)

      await updateDoc(sessionRef, {
        [`participantes.${pid}`]: {
          nombre: playerName,
          puntos: 0,
          respuestas: [],
          fechaUnion: serverTimestamp()
        }
      })

      setCode(code)
      setLoading(false)
    } catch (err) {
      console.error('Error joining session:', err)
      setError('Error al unirse a la sesión')
      setLoading(false)
    }
  }

  const submitAnswer = async (opcionId) => {
    if (hasAnswered) return

    setCurrentAnswer(opcionId)
    setHasAnswered(true)

    const pregunta = quiz.preguntas[session.preguntaActual]
    const opcionCorrecta = pregunta.opciones.find(op => op.correcta)
    const isCorrect = opcionId === opcionCorrecta.id
    
    // Calcular puntos (simplificado, sin bonus de tiempo)
    const points = isCorrect ? pregunta.puntos : 0

    try {
      const sessionRef = doc(db, 'QUIZ_SESSIONS', code)
      const sessionSnap = await getDoc(sessionRef)
      const currentData = sessionSnap.data()
      const playerData = currentData.participantes[playerId]

      const updatedAnswers = [...(playerData.respuestas || [])]
      updatedAnswers[session.preguntaActual] = {
        preguntaId: pregunta.id,
        respuesta: opcionId,
        correcta: isCorrect,
        puntos: points
      }

      await updateDoc(sessionRef, {
        [`participantes.${playerId}.respuestas`]: updatedAnswers,
        [`participantes.${playerId}.puntos`]: (playerData.puntos || 0) + points
      })
    } catch (err) {
      console.error('Error submitting answer:', err)
    }
  }

  if (!session) {
    return (
      <div className="quiz-play-container">
        <div className="quiz-start-screen">
          <div className="quiz-start-icon">🎮</div>
          <h1>Unirse al Quiz</h1>
          <p>Introduce el código de sesión</p>

          <div className="quiz-start-form">
            <input
              type="text"
              className="dark-input"
              placeholder="Código (6 dígitos)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoFocus
            />
            <input
              type="text"
              className="dark-input"
              placeholder="Tu nombre..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinSession()}
            />
            {error && <div className="error-message">{error}</div>}
            <button onClick={joinSession} disabled={loading} className="btn-play">
              {loading ? 'Conectando...' : 'Unirse'}
            </button>
          </div>

          <button onClick={() => navigate('/quizzes')} className="btn-back">
            <i className="bi bi-arrow-left"></i> Volver
          </button>
        </div>
      </div>
    )
  }

  if (session.estado === 'lobby') {
    return (
      <div className="quiz-play-container">
        <div className="quiz-start-screen">
          <div className="quiz-start-icon">⏳</div>
          <h1>Esperando...</h1>
          <p>El host iniciará el juego pronto</p>
          <div className="player-name-display">{playerName}</div>
        </div>
      </div>
    )
  }

  if (session.estado === 'jugando' && quiz) {
    const pregunta = quiz.preguntas[session.preguntaActual]

    return (
      <div className="quiz-play-container">
        <div className="player-question-container">
          <div className="player-header">
            <span>{playerName}</span>
            <span>Pregunta {session.preguntaActual + 1}/{quiz.preguntas.length}</span>
          </div>

          <h2 className="player-question-text">{pregunta.pregunta}</h2>

          <div className="player-options">
            {pregunta.opciones.map((opcion) => {
              let className = 'player-option'
              if (hasAnswered && currentAnswer === opcion.id) {
                className += ' player-option-selected'
              }
              
              return (
                <button
                  key={opcion.id}
                  className={className}
                  onClick={() => submitAnswer(opcion.id)}
                  disabled={hasAnswered}
                >
                  <span className="player-option-letter">{opcion.id.toUpperCase()}</span>
                  <span className="player-option-text">{opcion.texto}</span>
                </button>
              )
            })}
          </div>

          {hasAnswered && (
            <div className="player-waiting">
              <div className="spinner"></div>
              <p>Esperando a los demás jugadores...</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (session.estado === 'finalizada') {
    const playerData = session.participantes[playerId]
    const ranking = Object.entries(session.participantes)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.puntos - a.puntos)
    const position = ranking.findIndex(p => p.id === playerId) + 1

    return (
      <div className="quiz-play-container">
        <div className="quiz-results-screen">
          <div className="results-trophy">🏆</div>
          <h1>¡Juego Terminado!</h1>
          <div className="results-player-name">{playerName}</div>
          
          <div className="results-stats">
            <div className="result-stat">
              <div className="result-stat-value">#{position}</div>
              <div className="result-stat-label">Posición</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-value">{playerData.puntos}</div>
              <div className="result-stat-label">Puntos</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-value">
                {playerData.respuestas?.filter(r => r.correcta).length || 0}/{quiz.preguntas.length}
              </div>
              <div className="result-stat-label">Correctas</div>
            </div>
          </div>

          <button onClick={() => navigate('/quizzes')} className="btn-play">
            <i className="bi bi-grid"></i> Ver más quizzes
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default QuizJoin
