import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Briefcase, FolderOpen, Plus, Search } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [candidates, publishedJobs, allJobs] = await Promise.all([
          api.get('/api/candidates?pageSize=1'),
          api.get('/api/jobs?status=PUBLISHED&pageSize=1'),
          api.get('/api/jobs?pageSize=1'),
        ])
        setStats({
          candidates: candidates.pagination.total,
          publishedJobs: publishedJobs.pagination.total,
          totalJobs: allJobs.pagination.total,
        })
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [])

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p className="text-muted">
        {user?.role} · Dashboard
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <Link to="/candidates" className="stat-card">
          <div className="stat-icon">
            <Users size={18} />
          </div>
          <div className="stat-value">{stats ? stats.candidates : '—'}</div>
          <div className="stat-label">Candidates in pool</div>
        </Link>
        <Link to="/jobs?status=PUBLISHED" className="stat-card">
          <div className="stat-icon">
            <FolderOpen size={18} />
          </div>
          <div className="stat-value">{stats ? stats.publishedJobs : '—'}</div>
          <div className="stat-label">Published jobs</div>
        </Link>
        <Link to="/jobs" className="stat-card">
          <div className="stat-icon">
            <Briefcase size={18} />
          </div>
          <div className="stat-value">{stats ? stats.totalJobs : '—'}</div>
          <div className="stat-label">Total jobs</div>
        </Link>
      </div>

      <div className="quick-actions">
        <Link to="/jobs/new" className="btn btn-primary">
          <Plus size={16} />
          New Job
        </Link>
        <Link to="/matching" className="btn btn-secondary">
          <Search size={16} />
          Search Resume Pool
        </Link>
      </div>
    </div>
  )
}
