import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

export default function CandidateDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  function load() {
    api
      .get(`/api/candidates/${id}`)
      .then((data) => setCandidate(data.candidate))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [id])

  async function handleUploadNewVersion(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('resume', file)
    formData.append('candidateId', id)
    try {
      await api.post('/api/resumes/upload', formData, { isForm: true })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleArchiveResume(resumeId) {
    try {
      await api.delete(`/api/resumes/${resumeId}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRestoreResume(resumeId) {
    try {
      await api.post(`/api/resumes/${resumeId}/restore`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleViewResume(resumeId) {
    try {
      const blob = await api.getBlob(`/api/resumes/${resumeId}/file`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePurgeResume(resumeId) {
    if (!window.confirm('Permanently delete this resume file? This cannot be undone.')) return
    try {
      await api.delete(`/api/resumes/${resumeId}/permanent`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleArchiveCandidate() {
    try {
      await api.delete(`/api/candidates/${id}`)
      navigate('/candidates')
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !candidate) return <div className="alert alert-error">{error}</div>
  if (!candidate) return <p className="text-muted">Loading…</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{candidate.name}</h1>
          {candidate.deleted_at && <span className="badge badge-archived">Archived</span>}
        </div>
        {!candidate.deleted_at && (
          <button type="button" className="btn btn-danger-outline" onClick={handleArchiveCandidate}>
            Archive candidate
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="field-row">
          <div className="field">
            <span>Email</span>
            <div>{candidate.email || '—'}</div>
          </div>
          <div className="field">
            <span>Phone</span>
            <div>{candidate.phone || '—'}</div>
          </div>
          <div className="field">
            <span>Location</span>
            <div>{candidate.location || '—'}</div>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <span>Total experience</span>
            <div>{candidate.total_experience != null ? `${candidate.total_experience} yrs` : '—'}</div>
          </div>
          <div className="field">
            <span>Education</span>
            <div>{candidate.education_summary || '—'}</div>
          </div>
          <div className="field">
            <span>Notice period</span>
            <div>{candidate.notice_period || '—'}</div>
          </div>
        </div>
        {candidate.structured_profile?.skills?.length > 0 && (
          <>
            <span className="field-label">Skills (AI-extracted)</span>
            <div className="chip-group">
              {candidate.structured_profile.skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <h2>Resumes</h2>
      <div className="card">
        <label className="btn btn-secondary btn-inline">
          {uploading ? 'Uploading…' : 'Upload new version'}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleUploadNewVersion}
            disabled={uploading}
            hidden
          />
        </label>
      </div>

      {candidate.resumes.length === 0 && <p className="text-muted">No resumes.</p>}

      {candidate.resumes.map((r) => (
        <div key={r.id} className="card list-card">
          <div className="list-card-row">
            <div>
              <strong>
                v{r.version} {r.is_active && <span className="badge badge-published">Active</span>}
              </strong>
              <div className="text-muted">{r.file_name}</div>
            </div>
            <div className="list-card-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleViewResume(r.id)}>
                View
              </button>
              {!r.deleted_at && (
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => handleArchiveResume(r.id)}>
                  Archive
                </button>
              )}
              {r.deleted_at && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestoreResume(r.id)}>
                    Restore
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handlePurgeResume(r.id)}>
                    Delete forever
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      <h2>Application History</h2>
      {candidate.applications.length === 0 && <p className="text-muted">No applications yet.</p>}
      {candidate.applications.map((a) => (
        <div key={a.id} className="card list-card">
          <div className="list-card-row">
            <Link to={`/jobs/${a.job_id}`}>{a.job_title}</Link>
            <StatusBadge status={a.status} />
          </div>
        </div>
      ))}
    </div>
  )
}
