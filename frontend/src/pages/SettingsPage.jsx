import { useEffect, useState } from 'react'
import { Plus, Trash2, UserPlus, FileCheck } from 'lucide-react'
import { api } from '../api/client'
import { Avatar } from '../components/Avatar'

const ROLES = ['HR', 'RECRUITER', 'HOD', 'VIEWER']

export default function SettingsPage() {
  const [tab, setTab] = useState('team')

  return (
    <div>
      <h1>Settings</h1>

      <div className="tabs">
        <button type="button" className={tab === 'team' ? 'tab active' : 'tab'} onClick={() => setTab('team')}>
          <UserPlus size={15} />
          Team
        </button>
        <button type="button" className={tab === 'docs' ? 'tab active' : 'tab'} onClick={() => setTab('docs')}>
          <FileCheck size={15} />
          Document Checklist
        </button>
      </div>

      {tab === 'team' && <TeamTab />}
      {tab === 'docs' && <DocumentChecklistTab />}
    </div>
  )
}

function TeamTab() {
  const [users, setUsers] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'HOD' })
  const [error, setError] = useState('')
  const [lastCreated, setLastCreated] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    api
      .get('/api/users')
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLastCreated(null)
    setSubmitting(true)
    try {
      const data = await api.post('/api/users', form)
      setLastCreated(data)
      setForm({ name: '', email: '', role: 'HOD' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {lastCreated && (
        <div className="callout">
          <span>
            Created {lastCreated.user.name} ({lastCreated.user.role}). Email{' '}
            {lastCreated.emailStatus === 'SENT' ? 'sent' : 'could not be sent'} —{' '}
            {lastCreated.emailStatus !== 'SENT' && (
              <>
                share this temporary password manually: <strong>{lastCreated.tempPassword}</strong>
              </>
            )}
          </span>
        </div>
      )}

      {users === null && <p className="text-muted">Loading…</p>}
      {users &&
        users.map((u) => (
          <div key={u.id} className="card list-card">
            <div className="list-card-row">
              <div className="list-card-identity">
                <Avatar name={u.name} size="sm" />
                <div>
                  <strong>{u.name}</strong>
                  <div className="text-muted">{u.email}</div>
                </div>
              </div>
              <span className="badge">{u.role}</span>
            </div>
          </div>
        ))}

      <form className="card form-card" onSubmit={handleSubmit}>
        <h3>Add a team member</h3>
        <div className="field-row">
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Plus size={16} />
          {submitting ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </div>
  )
}

function DocumentChecklistTab() {
  const [items, setItems] = useState(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    api
      .get('/api/document-requirements')
      .then((data) => setItems(data.documentRequirements))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [])

  async function handleAdd(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/api/document-requirements', { label, orderIndex: items.length })
      setLabel('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/document-requirements/${id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <p className="text-muted">
        These are the standard documents candidates are asked to upload when HR requests documents. Add or remove
        items to match what your organization needs.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      {items === null && <p className="text-muted">Loading…</p>}
      {items &&
        items.map((item) => (
          <div key={item.id} className="card list-card">
            <div className="list-card-row">
              <strong>{item.label}</strong>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(item.id)}>
                <Trash2 size={13} />
                Remove
              </button>
            </div>
          </div>
        ))}

      <form className="card form-card" onSubmit={handleAdd}>
        <h3>Add a document type</h3>
        <div className="field-row">
          <label className="field" style={{ flex: 3 }}>
            <span>Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. PAN Card" required />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Plus size={16} />
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </form>
    </div>
  )
}
