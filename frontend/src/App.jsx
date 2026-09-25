import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import NewOrder from './pages/NewOrder'
import OrderHistory from './pages/OrderHistory'
import LowStock from './pages/LowStock'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<NewOrder />} />
        <Route path="history" element={<OrderHistory />} />
        <Route path="low-stock" element={<LowStock />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
