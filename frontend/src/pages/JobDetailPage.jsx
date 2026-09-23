import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'

const QUESTION_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean']
const STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']

export default function JobDetailPage() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState('')

  function loadJob() {
    return api
      .get(`/api/jobs/${id}`)
      .then((data) => setJob(data.job))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return <div className="alert alert-error">{error}</div>
  if (!job) return <p className="text-muted">Loading…</p>

  const publicUrl = job.status === 'PUBLISHED' ? `${window.location.origin}/apply/${job.slug}` : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="tabs">
        {['overview', 'questions', 'applicants', 'results'].map((t) => (
          <button
            key={t}
            className={t === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
            type="button"
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab job={job} publicUrl={publicUrl} onUpdated={setJob} />}
      {tab === 'questions' && <QuestionsTab job={job} onReload={loadJob} />}
      {tab === 'applicants' && <ApplicantsTab jobId={job.id} />}
      {tab === 'results' && <ResultsTab jobId={job.id} />}
    </div>
  )
}

function OverviewTab({ job, publicUrl, onUpdated }) {
  const [status, setStatus] = useState(job.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleStatusChange(e) {
    const value = e.target.value
    setStatus(value)
    setSaving(true)
    setError('')
    try {
      const data = await api.patch(`/api/jobs/${job.id}`, { status: value })
      onUpdated(data.job)
    } catch (err) {
      setError(err.message)
      setStatus(job.status)
    } finally {
      setSaving(false)
    }
  }

  const req = job.structured_requirements

  return (
    <div className="card">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field-row">
        <label className="field">
          <span>Status</span>
          <select value={status} onChange={handleStatusChange} disabled={saving}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Location</span>
          <div>{job.location || '—'}</div>
        </div>
        <div className="field">
          <span>Employment type</span>
          <div>{job.employment_type.replace('_', ' ')}</div>
        </div>
      </div>

      {publicUrl && (
        <div className="callout">
          <strong>Public application link:</strong>{' '}
          <a href={publicUrl} target="_blank" rel="noreferrer">
            {publicUrl}
          </a>
        </div>
      )}

      <h3>Description</h3>
      <p className="preserve-lines">{job.description}</p>

      {req && (
        <>
          <h3>AI-structured requirements</h3>
          <div className="chip-group">
            {(req.required_skills || []).map((s) => (
              <span key={s} className="chip chip-required">
                {s}
              </span>
            ))}
            {(req.preferred_skills || []).map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
          {req.required_experience_years != null && (
            <p className="text-muted">Required experience: {req.required_experience_years}+ years</p>
          )}
        </>
      )}
    </div>
  )
}

function QuestionsTab({ job, onReload }) {
  const [form, setForm] = useState({ question: '', questionType: 'text', required: false, options: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        question: form.question,
        questionType: form.questionType,
        required: form.required,
        orderIndex: job.questions.length,
      }
      if (['select', 'multiselect'].includes(form.questionType)) {
        payload.options = form.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      }
      await api.post(`/api/jobs/${job.id}/questions`, payload)
      setForm({ question: '', questionType: 'text', required: false, options: '' })
      await onReload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(questionId) {
    try {
      await api.delete(`/api/questions/${questionId}`)
      await onReload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {job.questions.length === 0 && <p className="text-muted">No custom questions yet.</p>}

      {job.questions.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Type</th>
              <th>Required</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {job.questions.map((q) => (
              <tr key={q.id}>
                <td>{q.question}</td>
                <td>{q.question_type}</td>
                <td>{q.required ? 'Yes' : 'No'}</td>
                <td>
                  <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(q.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="card form-card" onSubmit={handleAdd}>
        <h3>Add a question</h3>
        <label className="field">
          <span>Question</span>
          <input
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            required
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Type</span>
            <select
              value={form.questionType}
              onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value }))}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
            />
            <span>Required</span>
          </label>
        </div>
        {['select', 'multiselect'].includes(form.questionType) && (
          <label className="field">
            <span>Options (comma-separated)</span>
            <input
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              placeholder="Immediate, 2 weeks, 1 month"
              required
            />
          </label>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add question'}
        </button>
      </form>
    </div>
  )
}

function ApplicantsTab({ jobId }) {
  const [applications, setApplications] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  function load() {
    api
      .get(`/api/jobs/${jobId}/applications`)
      .then((data) => setApplications(data.applications))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [jobId])

  async function toggleExpand(appId) {
    if (expandedId === appId) {
      setExpandedId(null)
      return
    }
    setExpandedId(appId)
    try {
      const data = await api.get(`/api/applications/${appId}`)
      setDetail(data.application)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStatusChange(appId, status) {
    try {
      await api.patch(`/api/applications/${appId}`, { status })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!applications) return <p className="text-muted">Loading…</p>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {applications.length === 0 && <p className="text-muted">No applications yet.</p>}

      {applications.map((app) => (
        <div key={app.id} className="card list-card">
          <div className="list-card-row">
            <div>
              <strong>{app.name}</strong>
              <div className="text-muted">{app.email}</div>
            </div>
            <div className="list-card-actions">
              <select value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value)}>
                {['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED', 'ARCHIVED'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleExpand(app.id)}>
                {expandedId === app.id ? 'Hide' : 'View answers'}
              </button>
            </div>
          </div>

          {expandedId === app.id && detail && (
            <div className="expanded-detail">
              {detail.answers.length === 0 && <p className="text-muted">No custom question answers.</p>}
              {detail.answers.map((a) => (
                <div key={a.id} className="answer-row">
                  <strong>{a.question}</strong>
                  <span>{a.answer_text || JSON.stringify(a.answer_json)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ResultsTab({ jobId }) {
  const [results, setResults] = useState(null)
  const [screening, setScreening] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  function load() {
    api
      .get(`/api/jobs/${jobId}/results`)
      .then((data) => setResults(data.results))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [jobId])

  async function handleScreen() {
    setScreening(true)
    setError('')
    try {
      await api.post(`/api/jobs/${jobId}/screen`)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setScreening(false)
    }
  }

  if (!results) return <p className="text-muted">Loading…</p>

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <button type="button" className="btn btn-primary" onClick={handleScreen} disabled={screening}>
        {screening ? 'Screening…' : 'Run AI Screening'}
      </button>

      {results.length === 0 && <p className="text-muted">No screening results yet. Run screening above.</p>}

      {results.map((r) => (
        <div key={r.id} className="card list-card">
          <div className="list-card-row" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
            <div>
              <strong>{r.name}</strong>
              <div className="text-muted">{r.email}</div>
            </div>
            <div className="score-cell">
              <span className="score-big">{r.overall_score}</span>
              <StatusBadge status={r.recommendation} />
            </div>
          </div>

          {expandedId === r.id && (
            <div className="expanded-detail">
              <p>
                Skills {r.skills_score} · Experience {r.experience_score} · Education {r.education_score} ·
                Similarity {r.vector_similarity != null ? Number(r.vector_similarity).toFixed(3) : '—'}
              </p>
              <div className="chip-group">
                {(r.matched_skills || []).map((s) => (
                  <span key={s} className="chip chip-required">
                    {s}
                  </span>
                ))}
                {(r.missing_skills || []).map((s) => (
                  <span key={s} className="chip chip-missing">
                    {s}
                  </span>
                ))}
              </div>
              <p>{r.experience_analysis}</p>
              {(r.strengths || []).length > 0 && (
                <>
                  <strong>Strengths</strong>
                  <ul>
                    {r.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {(r.concerns || []).length > 0 && (
                <>
                  <strong>Concerns</strong>
                  <ul>
                    {r.concerns.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
