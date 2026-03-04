import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Blog from './pages/Blog'
import ConvertUnits from './pages/ConvertUnits'
import DecayCalculator from './pages/DecayCalculator'
import RestricionesLu177 from './pages/RestricionesLu177'
import UniformidadGamma from './pages/UniformidadGamma'
import RTPlanCompare from './pages/RTPlanCompare'
import Admin from './pages/Admin'
import QuizCreator from './pages/QuizCreator'
import QuizList from './pages/QuizList'
import QuizPlay from './pages/QuizPlay'
import QuizHost from './pages/QuizHost'
import QuizJoin from './pages/QuizJoin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Blog />} />
        <Route path="convert-units" element={<ConvertUnits />} />
        <Route path="decay-calculator" element={<DecayCalculator />} />
        <Route path="restricciones-lu177" element={<RestricionesLu177 />} />
        <Route path="uniformidad-gamma" element={<UniformidadGamma />} />
        <Route path="rtplan-compare" element={<RTPlanCompare />} />
      </Route>
      <Route path="/admin" element={<Admin />} />
      <Route path="/quiz-creator" element={<QuizCreator />} />
      <Route path="/quizzes" element={<QuizList />} />
      <Route path="/quiz/:quizId" element={<QuizPlay />} />
      <Route path="/host/:quizId" element={<QuizHost />} />
      <Route path="/join" element={<QuizJoin />} />
    </Routes>
  )
}

export default App
