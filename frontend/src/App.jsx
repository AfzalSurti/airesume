import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import JobsListPage from './pages/JobsListPage'
import JobFormPage from './pages/JobFormPage'
import JobDetailPage from './pages/JobDetailPage'
import CandidatesListPage from './pages/CandidatesListPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import BulkUploadPage from './pages/BulkUploadPage'
import MatchingPage from './pages/MatchingPage'
import PublicApplyPage from './pages/PublicApplyPage'
import PipelinesPage from './pages/PipelinesPage'
import PipelineDetailPage from './pages/PipelineDetailPage'
import SettingsPage from './pages/SettingsPage'
import PublicPipelinePage from './pages/PublicPipelinePage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/apply/:slug" element={<PublicApplyPage />} />
        <Route path="/documents/:token" element={<PublicPipelinePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsListPage />} />
            <Route path="/jobs/new" element={<JobFormPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/candidates" element={<CandidatesListPage />} />
            <Route path="/candidates/upload" element={<BulkUploadPage />} />
            <Route path="/candidates/:id" element={<CandidateDetailPage />} />
            <Route path="/matching" element={<MatchingPage />} />
            <Route path="/pipeline" element={<PipelinesPage />} />
            <Route path="/pipeline/:id" element={<PipelineDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
