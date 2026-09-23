import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '' })
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
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your organization</h1>
        <p className="auth-subtitle">You'll be the first admin</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Organization name</span>
          <input value={form.organizationName} onChange={update('organizationName')} required autoFocus />
        </label>

        <label className="field">
          <span>Your name</span>
          <input value={form.name} onChange={update('name')} required />
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>

        <label className="field">
          <span>Password</span>
          <input type="password" value={form.password} onChange={update('password')} required minLength={8} />
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
