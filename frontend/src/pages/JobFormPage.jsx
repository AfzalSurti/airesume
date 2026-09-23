import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../api/client'

export default function JobFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    employmentType: 'FULL_TIME',
    experienceMin: '',
    experienceMax: '',
    linkedinUrl: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        experienceMin: form.experienceMin ? Number(form.experienceMin) : undefined,
        experienceMax: form.experienceMax ? Number(form.experienceMax) : undefined,
      }
      const data = await api.post('/api/jobs', payload)
      navigate(`/jobs/${data.job.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-page">
      <h1>New Job</h1>

      <form className="card form-card" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Job title</span>
          <input value={form.title} onChange={update('title')} required autoFocus />
        </label>

        <label className="field">
          <span>Job description</span>
          <textarea
            rows={8}
            value={form.description}
            onChange={update('description')}
            placeholder="Paste the full job description here - AI will extract required/preferred skills and experience automatically."
            required
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={update('location')} />
          </label>

          <label className="field">
            <span>Employment type</span>
            <select value={form.employmentType} onChange={update('employmentType')}>
              <option value="FULL_TIME">Full time</option>
              <option value="PART_TIME">Part time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="TEMPORARY">Temporary</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Min experience (years)</span>
            <input type="number" min="0" step="0.5" value={form.experienceMin} onChange={update('experienceMin')} />
          </label>

          <label className="field">
            <span>Max experience (years)</span>
            <input type="number" min="0" step="0.5" value={form.experienceMax} onChange={update('experienceMax')} />
          </label>
        </div>

        <label className="field">
          <span>LinkedIn / job post URL</span>
          <input value={form.linkedinUrl} onChange={update('linkedinUrl')} />
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="spinner" /> : <Plus size={16} />}
          {submitting ? 'Creating…' : 'Create job'}
        </button>
      </form>
    </div>
  )
}
