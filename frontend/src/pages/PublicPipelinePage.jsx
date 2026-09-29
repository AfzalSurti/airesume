import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, FileText, Trash2, Upload, Briefcase, Plus, Download, Sparkles } from 'lucide-react'
import { api, API_URL } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'
import { Spinner } from '../components/Spinner'

export default function PublicPipelinePage() {
  const { token } = useParams()
  const [pipeline, setPipeline] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function load() {
    fetch(`${API_URL}/api/public/pipeline/${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Link not found')
        setPipeline(data.pipeline)
      })
      .catch((err) => setLoadError(err.message))
  }

  useEffect(load, [token])

  async function handleUploadDocument(requirementId, file) {
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentRequirementId', requirementId)
    try {
      await api.post(`/api/public/pipeline/${token}/documents`, formData, { isForm: true })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveDocument(documentId) {
    try {
      await api.delete(`/api/public/pipeline/${token}/documents/${documentId}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRemoveExperience(experienceId) {
    try {
      await api.delete(`/api/public/pipeline/${token}/experience/${experienceId}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSubmit() {
    try {
      await api.post(`/api/public/pipeline/${token}/submit`)
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loadError) {
    return (
      <div className="public-page">
        <div className="alert alert-error">{loadError}</div>
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="public-page">
        <Spinner label="Loading…" />
      </div>
    )
  }

  return (
    <div className="public-page">
      <div className="page-topbar">
        <ThemeToggle />
      </div>

      <div className="card">
        <div className="auth-brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <span className="brand-name">AI Recruiter</span>
        </div>
        <h1>Document Submission</h1>
        <p className="text-muted">
          {pipeline.candidateName} · {pipeline.jobTitle}
        </p>
        {pipeline.offerLetterAvailable && (
          <a
            className="btn btn-secondary btn-inline"
            href={`${API_URL}/api/public/pipeline/${token}/offer-letter`}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} />
            Download your offer letter
          </a>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {submitted && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <CheckCircle2 size={32} color="var(--success)" style={{ marginBottom: 8 }} />
          <p>Documents submitted. HR will review them shortly.</p>
        </div>
      )}

      <h2>Required Documents</h2>
      {pipeline.documentRequirements.map((req) => {
        const uploaded = pipeline.documents.find((d) => d.document_requirement_id === req.id)
        return (
          <div key={req.id} className="card list-card">
            <div className="list-card-row">
              <div className="list-card-identity">
                <FileText size={18} className="text-muted" />
                <div>
                  <strong>
                    {req.label} {req.required && <span className="text-muted">(required)</span>}
                  </strong>
                  {uploaded && <div className="text-muted">{uploaded.file_name}</div>}
                </div>
              </div>
              <div className="list-card-actions">
                {uploaded ? (
                  <>
                    <CheckCircle2 size={18} color="var(--success)" />
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      onClick={() => handleRemoveDocument(uploaded.id)}
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </>
                ) : (
                  <label className="btn btn-secondary btn-sm btn-inline">
                    <Upload size={13} />
                    Upload
                    <input
                      type="file"
                      accept="application/pdf"
                      hidden
                      onChange={(e) => e.target.files[0] && handleUploadDocument(req.id, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <h2>Work Experience</h2>
      <p className="text-muted">If you have prior work experience, add each employer below with the relevant letters.</p>

      {pipeline.experienceEntries.map((exp) => (
        <div key={exp.id} className="card list-card">
          <div className="list-card-row">
            <div className="list-card-identity">
              <Briefcase size={18} className="text-muted" />
              <div>
                <strong>{exp.company_name}</strong>
                <div className="text-muted">{exp.company_location}</div>
              </div>
            </div>
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => handleRemoveExperience(exp.id)}>
              <Trash2 size={13} />
              Remove
            </button>
          </div>
        </div>
      ))}

      <AddExperienceForm token={token} onAdded={load} setError={setError} />

      {!submitted && (
        <button type="button" className="btn btn-primary btn-block" onClick={handleSubmit} style={{ marginTop: 20 }}>
          <CheckCircle2 size={16} />
          Submit for Review
        </button>
      )}
    </div>
  )
}

function AddExperienceForm({ token, onAdded, setError }) {
  const [form, setForm] = useState({ companyName: '', companyLocation: '', dateOfJoining: '', dateOfExit: '' })
  const [files, setFiles] = useState({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => v && formData.append(k, v))
      Object.entries(files).forEach(([k, file]) => file && formData.append(k, file))
      await api.post(`/api/public/pipeline/${token}/experience`, formData, { isForm: true })
      setForm({ companyName: '', companyLocation: '', dateOfJoining: '', dateOfExit: '' })
      setFiles({})
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h3>Add an employer</h3>
      <div className="field-row">
        <label className="field">
          <span>Company name</span>
          <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} required />
        </label>
        <label className="field">
          <span>Company location</span>
          <input value={form.companyLocation} onChange={(e) => setForm((f) => ({ ...f, companyLocation: e.target.value }))} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Date of joining</span>
          <input type="date" value={form.dateOfJoining} onChange={(e) => setForm((f) => ({ ...f, dateOfJoining: e.target.value }))} />
        </label>
        <label className="field">
          <span>Date of exit</span>
          <input type="date" value={form.dateOfExit} onChange={(e) => setForm((f) => ({ ...f, dateOfExit: e.target.value }))} />
        </label>
      </div>
      <div className="field-row">
        {[
          ['experienceLetter', 'Experience letter'],
          ['offerLetter', 'Offer letter'],
          ['appointmentLetter', 'Appointment letter'],
        ].map(([key, label]) => (
          <label key={key} className="field">
            <span>{label}</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFiles((f) => ({ ...f, [key]: e.target.files[0] }))}
            />
          </label>
        ))}
      </div>
      <button type="submit" className="btn btn-secondary" disabled={submitting}>
        <Plus size={15} />
        {submitting ? 'Adding…' : 'Add Employer'}
      </button>
    </form>
  )
}
