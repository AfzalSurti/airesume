import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { api } from '../api/client'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'

export default function CandidatesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''

  function updateParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading for the new query params
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    api
      .get(`/api/candidates?${params.toString()}`)
      .then((data) => {
        if (cancelled) return
        setCandidates(data.candidates)
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
        <h1>Candidate Pool</h1>
      </div>

      <div className="toolbar">
        <div className="search-wrap">
          <Search size={15} />
          <input
            placeholder="Search by name or email…"
            defaultValue={q}
            onChange={(e) => updateParam('q', e.target.value)}
          />
        </div>
        <select value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <Spinner label="Loading candidates…" />}

      {!loading && candidates.length === 0 && (
        <EmptyState
          icon={Users}
          title="No candidates found"
          subtitle={q ? 'Try a different search.' : 'Upload a resume to start building your pool.'}
        />
      )}

      {!loading && candidates.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Experience</th>
              <th>Resumes</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="table-name-cell">
                    <Avatar name={c.name} size="sm" />
                    <Link to={`/candidates/${c.id}`}>{c.name}</Link>
                  </div>
                </td>
                <td>{c.email || '—'}</td>
                <td>{c.total_experience != null ? `${c.total_experience} yrs` : '—'}</td>
                <td>{c.resume_count}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && candidates.length > 0 && <p className="text-muted">{total} total</p>}
    </div>
  )
}
