import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Eye, CheckCircle2, Send, Calendar, Award, Briefcase, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { StatusBadge } from '../components/StatusBadge'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'

export default function PipelineDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [pipeline, setPipeline] = useState(null)
  const [hodUsers, setHodUsers] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  function load() {
    api
      .get(`/api/pipelines/${id}`)
      .then((data) => setPipeline(data.pipeline))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [id])

  useEffect(() => {
    api
      .get('/api/users?role=HOD')
      .then((data) => setHodUsers(data.users))
      .catch(() => {})
  }, [])

  async function viewFile(path) {
    try {
      const blob = await api.getBlob(path)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !pipeline) return <div className="alert alert-error">{error}</div>
  if (!pipeline) return <Spinner label="Loading pipeline…" />

  const isHrLike = ['ADMIN', 'HR'].includes(user?.role)
  const isHodLike = ['ADMIN', 'HOD'].includes(user?.role)

  return (
    <div>
      <div className="page-header">
        <div className="list-card-identity">
          <Avatar name={pipeline.candidate_name} />
          <div>
            <h1 style={{ marginBottom: 4 }}>{pipeline.candidate_name}</h1>
            <p className="text-muted" style={{ margin: 0 }}>
              {pipeline.job_title}
            </p>
          </div>
        </div>
        <StatusBadge status={pipeline.stage} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {notice && (
        <div className="callout">
          <ExternalLink size={15} />
          <span>{notice}</span>
        </div>
      )}

      <div className="callout">
        <ExternalLink size={15} />
        <span>
          Candidate document link:{' '}
          <a href={`${window.location.origin}/documents/${pipeline.document_token}`} target="_blank" rel="noreferrer">
            {`${window.location.origin}/documents/${pipeline.document_token}`}
          </a>
        </span>
      </div>

      <h2>Documents</h2>
      {pipeline.documents.length === 0 && <p className="text-muted">No documents submitted yet.</p>}
      {pipeline.documents.map((doc) => (
        <div key={doc.id} className="card list-card">
          <div className="list-card-row">
            <div className="list-card-identity">
              <FileText size={18} className="text-muted" />
              <div>
                <strong>{doc.label}</strong>
                <div className="text-muted">{doc.file_name}</div>
              </div>
            </div>
            <div className="list-card-actions">
              {doc.verified && <span className="badge badge-published">Verified</span>}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => viewFile(`/api/pipelines/documents/${doc.id}/file`)}
              >
                <Eye size={13} />
                View
              </button>
              {isHrLike && !doc.verified && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await api.post(`/api/pipelines/${id}/documents/${doc.id}/verify`)
                    load()
                  }}
                >
                  <CheckCircle2 size={13} />
                  Verify
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <h2>Work Experience</h2>
      {pipeline.experienceEntries.length === 0 && <p className="text-muted">No experience entries submitted.</p>}
      {pipeline.experienceEntries.map((exp) => (
        <div key={exp.id} className="card">
          <div className="list-card-identity" style={{ marginBottom: 10 }}>
            <Briefcase size={18} className="text-muted" />
            <div>
              <strong>{exp.company_name}</strong>
              <div className="text-muted">
                {exp.company_location || '—'} ·{' '}
                {exp.date_of_joining ? new Date(exp.date_of_joining).toLocaleDateString() : '—'} to{' '}
                {exp.date_of_exit ? new Date(exp.date_of_exit).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
          <div className="chip-group">
            {['experienceLetter', 'offerLetter', 'appointmentLetter'].map((field) => {
              const fileName = exp[`${field.replace(/([A-Z])/g, '_$1').toLowerCase()}_file_name`]
              if (!fileName) return null
              return (
                <button
                  key={field}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => viewFile(`/api/pipelines/${id}/experience/${exp.id}/${field}/file`)}
                >
                  <Eye size={13} />
                  {field.replace(/([A-Z])/g, ' $1')}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {pipeline.interview_date && (
        <div className="callout">
          <Calendar size={15} />
          <span>
            Interview: {new Date(pipeline.interview_date).toLocaleDateString()} at {pipeline.interview_time} ·{' '}
            {pipeline.interview_location}
          </span>
        </div>
      )}

      {pipeline.hod_decision_notes && (
        <div className="callout">
          <Award size={15} />
          <span>HOD notes: {pipeline.hod_decision_notes}</span>
        </div>
      )}

      {pipeline.offer_letter_storage_key && (
        <div className="card">
          <h3>Offer Letter</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => viewFile(`/api/pipelines/${id}/offer-letter`)}
          >
            <Eye size={13} />
            View offer letter
          </button>
        </div>
      )}

      {isHrLike && (pipeline.stage === 'DOCS_REQUESTED' || pipeline.stage === 'DOCS_SUBMITTED') && (
        <ForwardToHodAction pipelineId={id} hodUsers={hodUsers} onDone={load} setError={setError} setNotice={setNotice} />
      )}

      {isHodLike && pipeline.stage === 'FORWARDED_TO_HOD' && (
        <ScheduleInterviewAction pipelineId={id} onDone={load} setError={setError} setNotice={setNotice} />
      )}

      {isHodLike && pipeline.stage === 'INTERVIEW_SCHEDULED' && (
        <DecisionAction pipelineId={id} onDone={load} setError={setError} />
      )}

      {isHrLike && pipeline.stage === 'HOD_SELECTED' && (
        <SendOfferAction pipelineId={id} onDone={load} setError={setError} setNotice={setNotice} />
      )}

      {isHrLike && pipeline.stage === 'OFFER_SENT' && (
        <div className="card">
          <h3>Finish Hiring</h3>
          <p className="text-muted">Once all documents are verified, mark this pipeline complete.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await api.post(`/api/pipelines/${id}/complete`)
              load()
            }}
          >
            <CheckCircle2 size={16} />
            Mark Hired
          </button>
        </div>
      )}
    </div>
  )
}

function ForwardToHodAction({ pipelineId, hodUsers, onDone, setError, setNotice }) {
  const [hodUserId, setHodUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const data = await api.post(`/api/pipelines/${pipelineId}/forward-to-hod`, { hodUserId })
      setNotice(
        data.emailStatus === 'SENT'
          ? 'Forwarded - the HOD has been emailed.'
          : 'Forwarded, but the notification email could not be sent (not configured yet) - let the HOD know directly.'
      )
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Forward to HOD</h3>
      {hodUsers.length === 0 && (
        <p className="text-muted">
          No HOD users yet - create one under <strong>Settings → Team</strong>.
        </p>
      )}
      {hodUsers.length > 0 && (
        <>
          <label className="field">
            <span>Head of Department</span>
            <select value={hodUserId} onChange={(e) => setHodUserId(e.target.value)} required>
              <option value="">Select…</option>
              {hodUsers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Send size={15} />
            {submitting ? 'Forwarding…' : 'Forward'}
          </button>
        </>
      )}
    </form>
  )
}

function ScheduleInterviewAction({ pipelineId, onDone, setError, setNotice }) {
  const [form, setForm] = useState({ interviewDate: '', interviewTime: '', interviewLocation: '' })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const data = await api.post(`/api/pipelines/${pipelineId}/schedule-interview`, form)
      setNotice(
        data.emailStatus === 'SENT'
          ? 'Interview scheduled - the candidate has been emailed.'
          : 'Interview scheduled, but the notification email could not be sent (not configured yet) - let the candidate know directly.'
      )
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Schedule Interview</h3>
      <div className="field-row">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={form.interviewDate}
            onChange={(e) => setForm((f) => ({ ...f, interviewDate: e.target.value }))}
            required
          />
        </label>
        <label className="field">
          <span>Time</span>
          <input
            type="time"
            value={form.interviewTime}
            onChange={(e) => setForm((f) => ({ ...f, interviewTime: e.target.value }))}
            required
          />
        </label>
      </div>
      <label className="field">
        <span>Location</span>
        <input
          value={form.interviewLocation}
          onChange={(e) => setForm((f) => ({ ...f, interviewLocation: e.target.value }))}
          placeholder="Office address or video call link"
          required
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        <Calendar size={15} />
        {submitting ? 'Scheduling…' : 'Schedule & Notify Candidate'}
      </button>
    </form>
  )
}

function DecisionAction({ pipelineId, onDone, setError }) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleDecision(decision) {
    setSubmitting(true)
    try {
      await api.post(`/api/pipelines/${pipelineId}/decision`, { decision, notes })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card form-card">
      <h3>Interview Decision</h3>
      <label className="field">
        <span>Notes (optional)</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="field-row">
        <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => handleDecision('SELECTED')}>
          <CheckCircle2 size={15} />
          Select Candidate
        </button>
        <button
          type="button"
          className="btn btn-danger-outline"
          disabled={submitting}
          onClick={() => handleDecision('REJECTED')}
        >
          Reject
        </button>
      </div>
    </div>
  )
}

function SendOfferAction({ pipelineId, onDone, setError, setNotice }) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const file = fileInputRef.current?.files[0]
    if (!file) {
      setError('Please attach the offer letter PDF')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('offerLetter', file)
      formData.append('message', message)
      const data = await api.post(`/api/pipelines/${pipelineId}/offer`, formData, { isForm: true })
      setNotice(
        data.emailStatus === 'SENT'
          ? 'Offer sent - the candidate has been emailed.'
          : 'Offer saved, but the email could not be sent (not configured yet) - share the offer link with the candidate directly.'
      )
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Send Offer Letter</h3>
      <label className="field">
        <span>Offer letter (PDF)</span>
        <input ref={fileInputRef} type="file" accept="application/pdf" required />
      </label>
      <label className="field">
        <span>Message (optional)</span>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        <Send size={15} />
        {submitting ? 'Sending…' : 'Send Offer'}
      </button>
    </form>
  )
}
