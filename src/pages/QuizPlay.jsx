import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import '../styles/quiz.css'

function QuizPlay() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gameState, setGameState] = useState('start') // 'start' | 'playing' | 'results'
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [answers, setAnswers] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    loadQuiz()
  }, [quizId])

  useEffect(() => {
    if (gameState === 'playing' && !showAnswer && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && gameState === 'playing' && !showAnswer) {
      handleTimeUp()
    }
  }, [timeLeft, gameState, showAnswer])

  const loadQuiz = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'QUIZZES', quizId))
      if (docSnap.exists()) {
        setQuiz({ id: docSnap.id, ...docSnap.data() })
      } else {
        alert('Quiz no encontrado')
        navigate('/quizzes')
      }
    } catch (err) {
      console.error('Error loading quiz:', err)
    } finally {
      setLoading(false)
    }
  }

  const startGame = () => {
    if (!playerName.trim()) {
      alert('Introduce tu nombre')
      return
    }
    setGameState('playing')
    setTimeLeft(quiz.preguntas[0].tiempo)
  }

  const handleAnswer = (opcionId) => {
    if (showAnswer) return
    setSelectedAnswer(opcionId)
  }

  const submitAnswer = () => {
    if (!selectedAnswer) return
    
    const pregunta = quiz.preguntas[currentQuestion]
    const opcionCorrecta = pregunta.opciones.find(op => op.correcta)
    const isCorrect = selectedAnswer === opcionCorrecta.id
    
    // Calcular puntos basados en tiempo restante
    const timeBonus = Math.floor((timeLeft / pregunta.tiempo) * 100)
    const points = isCorrect ? Math.floor(pregunta.puntos * (timeBonus / 100)) : 0
    
    setAnswers([...answers, {
      preguntaId: pregunta.id,
      respuesta: selectedAnswer,
      correcta: isCorrect,
      puntos: points,
      tiempo: pregunta.tiempo - timeLeft
    }])
    
    setScore(score + points)
    setShowAnswer(true)
  }

  const handleTimeUp = () => {
    if (selectedAnswer) {
      submitAnswer()
    } else {
      const pregunta = quiz.preguntas[currentQuestion]
      setAnswers([...answers, {
        preguntaId: pregunta.id,
        respuesta: null,
        correcta: false,
        puntos: 0,
        tiempo: pregunta.tiempo
      }])
      setShowAnswer(true)
    }
  }

  const nextQuestion = () => {
    if (currentQuestion < quiz.preguntas.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowAnswer(false)
      setTimeLeft(quiz.preguntas[currentQuestion + 1].tiempo)
    } else {
      setGameState('results')
    }
  }

  const restartQuiz = () => {
    setCurrentQuestion(0)
    setAnswers([])
    setSelectedAnswer(null)
    setShowAnswer(false)
    setScore(0)
    setGameState('start')
  }

  if (loading) {
    return (
      <div className="quiz-play-container">
        <div style={{ textAlign: 'center', padding: '48px' }}>Cargando...</div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="quiz-play-container">
        <div style={{ textAlign: 'center', padding: '48px' }}>Quiz no encontrado</div>
      </div>
    )
  }

  if (gameState === 'start') {
    return (
      <div className="quiz-play-container">
        <div className="quiz-start-screen">
          <div className="quiz-start-icon">🎯</div>
          <h1>{quiz.titulo}</h1>
          <p className="quiz-start-desc">{quiz.descripcion}</p>
          <div className="quiz-start-meta">
            <span><i className="bi bi-question-circle"></i> {quiz.preguntas.length} preguntas</span>
            <span><i className="bi bi-tag"></i> {quiz.topic}</span>
          </div>
          <div className="quiz-start-form">
            <input
              type="text"
              className="dark-input"
              placeholder="Tu nombre..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && startGame()}
              autoFocus
            />
            <button onClick={startGame} className="btn-play">
              Empezar <i className="bi bi-play-fill"></i>
            </button>
          </div>
          <button onClick={() => navigate('/quizzes')} className="btn-back">
            <i className="bi bi-arrow-left"></i> Volver
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'playing') {
    const pregunta = quiz.preguntas[currentQuestion]
    const opcionCorrecta = pregunta.opciones.find(op => op.correcta)
    const progress = ((currentQuestion + 1) / quiz.preguntas.length) * 100

    return (
      <div className="quiz-play-container">
        <div className="quiz-header">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="quiz-header-info">
            <span className="quiz-question-number">Pregunta {currentQuestion + 1}/{quiz.preguntas.length}</span>
            <span className="quiz-score">💎 {score}</span>
            <span className={`quiz-timer ${timeLeft <= 5 ? 'quiz-timer-warning' : ''}`}>
              ⏱️ {timeLeft}s
            </span>
          </div>
        </div>

        <div className="quiz-question-container">
          <h2 className="quiz-question-text">{pregunta.pregunta}</h2>
          
          <div className="quiz-options">
            {pregunta.opciones.map((opcion) => {
              let className = 'quiz-option'
              if (showAnswer) {
                if (opcion.correcta) {
                  className += ' quiz-option-correct'
                } else if (selectedAnswer === opcion.id) {
                  className += ' quiz-option-wrong'
                }
              } else if (selectedAnswer === opcion.id) {
                className += ' quiz-option-selected'
              }
              
              return (
                <button
                  key={opcion.id}
                  className={className}
                  onClick={() => handleAnswer(opcion.id)}
                  disabled={showAnswer}
                >
                  <span className="quiz-option-letter">{opcion.id.toUpperCase()}</span>
                  <span className="quiz-option-text">{opcion.texto}</span>
                  {showAnswer && opcion.correcta && <i className="bi bi-check-circle-fill"></i>}
                  {showAnswer && !opcion.correcta && selectedAnswer === opcion.id && <i className="bi bi-x-circle-fill"></i>}
                </button>
              )
            })}
          </div>

          {!showAnswer && selectedAnswer && (
            <button onClick={submitAnswer} className="btn-submit-answer">
              Confirmar respuesta
            </button>
          )}

          {showAnswer && (
            <div className="quiz-answer-feedback">
              {answers[answers.length - 1].correcta ? (
                <>
                  <div className="feedback-icon">✅</div>
                  <h3>¡Correcto!</h3>
                  <p>+{answers[answers.length - 1].puntos} puntos</p>
                </>
              ) : (
                <>
                  <div className="feedback-icon">❌</div>
                  <h3>Incorrecto</h3>
                  <p>La respuesta correcta era: {opcionCorrecta.texto}</p>
                </>
              )}
              <button onClick={nextQuestion} className="btn-next">
                {currentQuestion < quiz.preguntas.length - 1 ? 'Siguiente pregunta' : 'Ver resultados'}
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'results') {
    const correctAnswers = answers.filter(a => a.correcta).length
    const totalQuestions = quiz.preguntas.length
    const percentage = Math.round((correctAnswers / totalQuestions) * 100)
    const maxScore = quiz.preguntas.reduce((sum, p) => sum + p.puntos, 0)

    return (
      <div className="quiz-play-container">
        <div className="quiz-results-screen">
          <div className="results-trophy">🏆</div>
          <h1>¡Quiz completado!</h1>
          <div className="results-player-name">{playerName}</div>
          
          <div className="results-stats">
            <div className="result-stat">
              <div className="result-stat-value">{score}</div>
              <div className="result-stat-label">Puntos</div>
              <div className="result-stat-max">de {maxScore}</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-value">{correctAnswers}/{totalQuestions}</div>
              <div className="result-stat-label">Correctas</div>
              <div className="result-stat-max">{percentage}%</div>
            </div>
          </div>

          <div className="results-details">
            <h3>Detalle de respuestas</h3>
            {quiz.preguntas.map((pregunta, index) => {
              const answer = answers[index]
              return (
                <div key={pregunta.id} className="result-item">
                  <div className="result-item-header">
                    <span className={answer.correcta ? 'result-correct' : 'result-wrong'}>
                      {answer.correcta ? '✅' : '❌'}
                    </span>
                    <span className="result-question">{pregunta.pregunta}</span>
                    <span className="result-points">+{answer.puntos}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="results-actions">
            <button onClick={restartQuiz} className="btn-play">
              <i className="bi bi-arrow-clockwise"></i> Jugar de nuevo
            </button>
            <button onClick={() => navigate('/quizzes')} className="btn-back">
              <i className="bi bi-grid"></i> Ver más quizzes
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default QuizPlay
