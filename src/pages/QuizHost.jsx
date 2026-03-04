import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { auth, db } from '../firebase'
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import '../styles/quiz.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const googleProvider = new GoogleAuthProvider()

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function QuizHost() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quiz, setQuiz] = useState(null)
  const [session, setSession] = useState(null)
  const [sessionCode, setSessionCode] = useState('')
  const [gameState, setGameState] = useState('setup') // 'setup' | 'lobby' | 'question' | 'results' | 'final'
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [participants, setParticipants] = useState({})
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user && quizId) {
      loadQuiz()
    }
  }, [user, quizId])

  useEffect(() => {
    if (sessionCode) {
      const unsubscribe = onSnapshot(doc(db, 'QUIZ_SESSIONS', sessionCode), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setSession(data)
          setParticipants(data.participantes || {})
        }
      })
      return unsubscribe
    }
  }, [sessionCode])

  const loadQuiz = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'QUIZZES', quizId))
      if (docSnap.exists()) {
        setQuiz({ id: docSnap.id, ...docSnap.data() })
      }
    } catch (err) {
      console.error('Error loading quiz:', err)
    }
  }

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const startSession = async () => {
    const code = generateCode()
    setSessionCode(code)
    
    try {
      await setDoc(doc(db, 'QUIZ_SESSIONS', code), {
        quizId,
        host: user.uid,
        estado: 'lobby',
        preguntaActual: 0,
        participantes: {},
        fechaCreacion: serverTimestamp()
      })
      setGameState('lobby')
    } catch (err) {
      console.error('Error creating session:', err)
    }
  }

  const startGame = async () => {
    await updateDoc(doc(db, 'QUIZ_SESSIONS', sessionCode), {
      estado: 'jugando',
      preguntaActual: 0,
      inicioTiempo: serverTimestamp()
    })
    setGameState('question')
    setCurrentQuestion(0)
    setShowResults(false)
  }

  const showQuestionResults = () => {
    setShowResults(true)
  }

  const nextQuestion = async () => {
    const next = currentQuestion + 1
    if (next < quiz.preguntas.length) {
      await updateDoc(doc(db, 'QUIZ_SESSIONS', sessionCode), {
        preguntaActual: next,
        inicioTiempo: serverTimestamp()
      })
      setCurrentQuestion(next)
      setShowResults(false)
    } else {
      await updateDoc(doc(db, 'QUIZ_SESSIONS', sessionCode), {
        estado: 'finalizada'
      })
      setGameState('final')
    }
  }

  const endSession = async () => {
    if (sessionCode) {
      await deleteDoc(doc(db, 'QUIZ_SESSIONS', sessionCode))
      navigate('/quizzes')
    }
  }

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Cargando...</div>
  }

  if (!user) {
    return (
      <div className="quiz-play-container">
        <div className="quiz-start-screen">
          <div className="quiz-start-icon">🎯</div>
          <h1>Host de Quiz</h1>
          <p>Inicia sesión para crear una sesión en vivo</p>
          <button onClick={handleLogin} className="btn-play">
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Cargando quiz...</div>
  }

  if (gameState === 'setup') {
    return (
      <div className="quiz-play-container">
        <div className="quiz-start-screen">
          <div className="quiz-start-icon">🎮</div>
          <h1>{quiz.titulo}</h1>
          <p>{quiz.descripcion}</p>
          <div className="quiz-start-meta">
            <span><i className="bi bi-question-circle"></i> {quiz.preguntas.length} preguntas</span>
          </div>
          <button onClick={startSession} className="btn-play">
            Crear Sesión en Vivo
          </button>
          <button onClick={() => navigate('/quizzes')} className="btn-back">
            <i className="bi bi-arrow-left"></i> Volver
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'lobby') {
    return (
      <div className="host-container">
        <div className="host-lobby">
          <h1>Código de Sesión</h1>
          <div className="session-code">{sessionCode}</div>
          <p>Los jugadores pueden unirse en: <strong>falkensmaze.es/join</strong></p>
          
          <div className="participants-list">
            <h3>Jugadores conectados ({Object.keys(participants).length})</h3>
            <div className="participants-grid">
              {Object.entries(participants).map(([id, player]) => (
                <div key={id} className="participant-card">
                  <i className="bi bi-person-circle"></i>
                  <span>{player.nombre}</span>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={startGame} 
            disabled={Object.keys(participants).length === 0}
            className="btn-play"
          >
            Iniciar Juego
          </button>
          <button onClick={endSession} className="btn-back">
            Cancelar Sesión
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'question') {
    const pregunta = quiz.preguntas[currentQuestion]
    const answers = Object.values(participants).filter(p => p.respuestas?.[currentQuestion])
    const totalAnswers = answers.length
    const totalPlayers = Object.keys(participants).length

    return (
      <div className="host-container">
        <div className="host-question">
          <div className="host-header">
            <span>Pregunta {currentQuestion + 1}/{quiz.preguntas.length}</span>
            <span>{totalAnswers}/{totalPlayers} respondieron</span>
          </div>

          <h2 className="host-question-text">{pregunta.pregunta}</h2>

          {!showResults ? (
            <>
              <div className="host-options">
                {pregunta.opciones.map((opcion) => (
                  <div key={opcion.id} className="host-option">
                    <span className="host-option-letter">{opcion.id.toUpperCase()}</span>
                    <span className="host-option-text">{opcion.texto}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={showQuestionResults}
                disabled={totalAnswers === 0}
                className="btn-play"
              >
                Mostrar Resultados
              </button>
            </>
          ) : (
            <>
              <ResultsChart pregunta={pregunta} participants={participants} currentQuestion={currentQuestion} />
              
              <button onClick={nextQuestion} className="btn-play">
                {currentQuestion < quiz.preguntas.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados Finales'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'final') {
    const ranking = Object.entries(participants)
      .map(([id, player]) => ({
        id,
        nombre: player.nombre,
        puntos: player.puntos || 0,
        correctas: player.respuestas?.filter(r => r.correcta).length || 0
      }))
      .sort((a, b) => b.puntos - a.puntos)

    return (
      <div className="host-container">
        <div className="host-final">
          <h1>🏆 Resultados Finales</h1>
          
          <div className="final-podium">
            {ranking.slice(0, 3).map((player, idx) => (
              <div key={player.id} className={`podium-place place-${idx + 1}`}>
                <div className="podium-medal">{['🥇', '🥈', '🥉'][idx]}</div>
                <div className="podium-name">{player.nombre}</div>
                <div className="podium-score">{player.puntos} pts</div>
                <div className="podium-correct">{player.correctas} correctas</div>
              </div>
            ))}
          </div>

          <div className="final-ranking">
            <h3>Clasificación Completa</h3>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Jugador</th>
                  <th>Puntos</th>
                  <th>Correctas</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((player, idx) => (
                  <tr key={player.id}>
                    <td>{idx + 1}</td>
                    <td>{player.nombre}</td>
                    <td>{player.puntos}</td>
                    <td>{player.correctas}/{quiz.preguntas.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={endSession} className="btn-play">
            Finalizar Sesión
          </button>
        </div>
      </div>
    )
  }
}

function ResultsChart({ pregunta, participants, currentQuestion }) {
  const correctOption = pregunta.opciones.find(op => op.correcta)
  
  const answerCounts = {}
  pregunta.opciones.forEach(op => {
    answerCounts[op.id] = 0
  })

  Object.values(participants).forEach(player => {
    const answer = player.respuestas?.[currentQuestion]
    if (answer && answer.respuesta) {
      answerCounts[answer.respuesta] = (answerCounts[answer.respuesta] || 0) + 1
    }
  })

  const data = {
    labels: pregunta.opciones.map(op => `${op.id.toUpperCase()}: ${op.texto}`),
    datasets: [{
      label: 'Respuestas',
      data: pregunta.opciones.map(op => answerCounts[op.id]),
      backgroundColor: pregunta.opciones.map(op => 
        op.correcta ? 'rgba(39, 174, 96, 0.8)' : 'rgba(231, 76, 60, 0.8)'
      ),
      borderColor: pregunta.opciones.map(op => 
        op.correcta ? 'rgba(39, 174, 96, 1)' : 'rgba(231, 76, 60, 1)'
      ),
      borderWidth: 2
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Respuesta correcta: ${correctOption.id.toUpperCase()}`,
        color: '#a3be8c',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: '#d8dee9'
        },
        grid: {
          color: 'rgba(216, 222, 233, 0.1)'
        }
      },
      x: {
        ticks: {
          color: '#d8dee9'
        },
        grid: {
          color: 'rgba(216, 222, 233, 0.1)'
        }
      }
    }
  }

  return (
    <div className="results-chart-container">
      <Bar data={data} options={options} />
    </div>
  )
}

export default QuizHost
