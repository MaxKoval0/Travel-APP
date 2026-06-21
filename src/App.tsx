import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PlacesPage from './features/places/PlacesPage'
import TripsListPage from './features/trips/TripsListPage'
import TripDetailPage from './features/trips/TripDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/places" replace />} />
        <Route path="places" element={<PlacesPage />} />
        <Route path="trips" element={<TripsListPage />} />
        <Route path="trips/:tripId" element={<TripDetailPage />} />
      </Route>
    </Routes>
  )
}

export default App
