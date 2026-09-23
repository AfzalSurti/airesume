import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_URL } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'

export default function PublicApplyPage() {
  const { slug } = useParams()
  const [job, setJob] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    noticePeriod: '',
    currentSalary: '',
    expectedSalary: '',
  })
  const [answers, setAnswers] = useState({})
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/public/jobs/${slug}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Job not found')
        setJob(data.job)
      })
      .catch((err) => setLoadError(err.message))
  }, [slug])

  function updateForm(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function updateAnswer(questionId, value) {
    setAnswers((a) => ({ ...a, [questionId]: value }))
  }

  function toggleMultiselect(questionId, option) {
    setAnswers((a) => {
      const current = Array.isArray(a[questionId]) ? a[questionId] : []
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
      return { ...a, [questionId]: next }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')

    if (!file) {
      setSubmitError('Please attach your resume (PDF).')
      return
    }

    setSubmitting(true)
    try {
      const answerPayload = job.questions.map((q) => {
        const value = answers[q.id]
        if (q.question_type === 'multiselect') {
          return { questionId: q.id, answerJson: value || [] }
        }
        if (q.question_type === 'boolean') {
          return { questionId: q.id, answerJson: value === true }
        }
        return { questionId: q.id, answerText: value != null ? String(value) : '' }
      })

      const formData = new FormData()
      formData.append('resume', file)
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })
      formData.append('answers', JSON.stringify(answerPayload))

      const res = await fetch(`${API_URL}/api/public/jobs/${slug}/apply`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Application failed')
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="public-page">
        <div className="page-topbar">
          <ThemeToggle />
        </div>
        <div className="alert alert-error">{loadError}</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="public-page">
        <div className="page-topbar">
          <ThemeToggle />
        </div>
        <p className="text-muted">Loading…</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="public-page">
        <div className="page-topbar">
          <ThemeToggle />
        </div>
        <div className="card">
          <h1>Application submitted</h1>
          <p>Thanks for applying to {job.title}. We'll be in touch if there's a match.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="public-page">
      <div className="page-topbar">
        <ThemeToggle />
      </div>
      <div className="card">
        <h1>{job.title}</h1>
        <p className="text-muted">
          {job.location || 'Location not specified'} · {job.employment_type.replace('_', ' ')}
        </p>
        <p className="preserve-lines">{job.description}</p>
      </div>

      <form className="card form-card" onSubmit={handleSubmit}>
        <h2>Your details</h2>
        {submitError && <div className="alert alert-error">{submitError}</div>}

        <div className="field-row">
          <label className="field">
            <span>Full name *</span>
            <input value={form.name} onChange={updateForm('name')} required />
          </label>
          <label className="field">
            <span>Email *</span>
            <input type="email" value={form.email} onChange={updateForm('email')} required />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={updateForm('phone')} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={updateForm('location')} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>LinkedIn URL</span>
            <input value={form.linkedinUrl} onChange={updateForm('linkedinUrl')} />
          </label>
          <label className="field">
            <span>GitHub URL</span>
            <input value={form.githubUrl} onChange={updateForm('githubUrl')} />
          </label>
          <label className="field">
            <span>Portfolio URL</span>
            <input value={form.portfolioUrl} onChange={updateForm('portfolioUrl')} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Notice period</span>
            <input value={form.noticePeriod} onChange={updateForm('noticePeriod')} />
          </label>
          <label className="field">
            <span>Current salary</span>
            <input value={form.currentSalary} onChange={updateForm('currentSalary')} />
          </label>
          <label className="field">
            <span>Expected salary</span>
            <input value={form.expectedSalary} onChange={updateForm('expectedSalary')} />
          </label>
        </div>

        <label className="field">
          <span>Resume (PDF) *</span>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} required />
        </label>

        {job.questions.length > 0 && <h2>Additional questions</h2>}

        {job.questions.map((q) => (
          <div key={q.id} className="field">
            <span>
              {q.question} {q.required && '*'}
            </span>
            {q.question_type === 'text' && (
              <input value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)} required={q.required} />
            )}
            {q.question_type === 'textarea' && (
              <textarea
                rows={4}
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                required={q.required}
              />
            )}
            {q.question_type === 'number' && (
              <input
                type="number"
                value={answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                required={q.required}
              />
            )}
            {q.question_type === 'boolean' && (
              <select
                value={answers[q.id] === undefined ? '' : String(answers[q.id])}
                onChange={(e) => updateAnswer(q.id, e.target.value === 'true')}
                required={q.required}
              >
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            {q.question_type === 'select' && (
              <select value={answers[q.id] || ''} onChange={(e) => updateAnswer(q.id, e.target.value)} required={q.required}>
                <option value="">Select…</option>
                {(q.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {q.question_type === 'multiselect' && (
              <div className="checkbox-group">
                {(q.options || []).map((opt) => (
                  <label key={opt} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Array.isArray(answers[q.id]) && answers[q.id].includes(opt)}
                      onChange={() => toggleMultiselect(q.id, opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </form>
    </div>
  )
}
