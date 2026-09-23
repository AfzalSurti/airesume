import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

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
          + New Job
        </Link>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
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
      {loading && <p className="text-muted">Loading…</p>}

      {!loading && jobs.length === 0 && <p className="text-muted">No jobs found.</p>}

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

      {!loading && <p className="text-muted">{total} total</p>}
    </div>
  )
}
