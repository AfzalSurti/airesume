import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Briefcase } from 'lucide-react'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'

export default function JobsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading for the new query params
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    api
      .get(`/api/jobs?${params.toString()}`)
      .then((data) => {
        if (cancelled) return
        setJobs(data.jobs)
        setTotal(data.pagination.total)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, status])

  return (
    <div>
      <div className="page-header">
        <h1>Jobs</h1>
        <Link to="/jobs/new" className="btn btn-primary">
          <Plus size={16} />
          New Job
        </Link>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <Search size={15} />
          <input
            placeholder="Search by title…"
            defaultValue={q}
            onChange={(e) => {
              const value = e.target.value
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (value) next.set('q', value)
                else next.delete('q')
                return next
              })
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            const value = e.target.value
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              if (value) next.set('status', value)
              else next.delete('status')
              return next
            })
          }}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CLOSED">Closed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <Spinner label="Loading jobs…" />}

      {!loading && jobs.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title="No jobs found"
          subtitle={q || status ? 'Try adjusting your search or filters.' : 'Create your first job to get started.'}
        />
      )}

      {!loading && jobs.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Location</th>
              <th>Type</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                </td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td>{job.location || '—'}</td>
                <td>{job.employment_type.replace('_', ' ')}</td>
                <td>{new Date(job.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && jobs.length > 0 && <p className="text-muted">{total} total</p>}
    </div>
  )
}
