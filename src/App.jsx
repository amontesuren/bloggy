import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Blog from './pages/Blog'
import ConvertUnits from './pages/ConvertUnits'
import DecayCalculator from './pages/DecayCalculator'
import RestricionesLu177 from './pages/RestricionesLu177'
import UniformidadGamma from './pages/UniformidadGamma'
import Admin from './pages/Admin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Blog />} />
        <Route path="convert-units" element={<ConvertUnits />} />
        <Route path="decay-calculator" element={<DecayCalculator />} />
        <Route path="restricciones-lu177" element={<RestricionesLu177 />} />
        <Route path="uniformidad-gamma" element={<UniformidadGamma />} />
      </Route>
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

export default App
