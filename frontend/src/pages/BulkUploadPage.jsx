import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from '../api/client'

const CONCURRENCY = 3

export default function BulkUploadPage() {
  const [files, setFiles] = useState([])
  const [running, setRunning] = useState(false)
  const fileInputRef = useRef(null)

  function handleSelect(e) {
    const picked = Array.from(e.target.files || [])
    const entries = picked.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending',
      candidateId: null,
      candidateName: null,
      error: null,
    }))
    setFiles((prev) => [...prev, ...entries])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateFile(id, patch) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  async function uploadOne(entry) {
    updateFile(entry.id, { status: 'uploading' })
    const formData = new FormData()
    formData.append('resume', entry.file)
    try {
      const data = await api.post('/api/resumes/upload', formData, { isForm: true })
      const extractedName = data.processing?.profile?.name
      updateFile(entry.id, {
        status: data.processing?.status === 'ok' ? 'done' : 'done-no-ai',
        candidateId: data.candidate.id,
        candidateName: extractedName || data.candidate.name,
        error: data.processing?.status === 'failed' ? data.processing.message : null,
      })
    } catch (err) {
      updateFile(entry.id, { status: 'error', error: err.message })
    }
  }

  async function handleUploadAll() {
    setRunning(true)
    const pending = files.filter((f) => f.status === 'pending')
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(uploadOne))
    }
    setRunning(false)
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const doneCount = files.filter((f) => f.status === 'done' || f.status === 'done-no-ai').length
  const errorCount = files.filter((f) => f.status === 'error').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bulk Upload Resumes</h1>
          <p className="text-muted">
            Add multiple resumes to your candidate pool at once. Each PDF becomes a candidate - AI extracts their
            name, skills and experience automatically, no need to type anything upfront.
          </p>
        </div>
      </div>

      <div className="card">
        <label className="btn btn-secondary btn-inline">
          <Upload size={15} />
          Choose PDF files
          <input ref={fileInputRef} type="file" accept="application/pdf" multiple onChange={handleSelect} hidden />
        </label>
        {files.length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 12 }}
            onClick={handleUploadAll}
            disabled={running || pendingCount === 0}
          >
            {running ? <span className="spinner" /> : <Upload size={16} />}
            {running ? 'Uploading…' : `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {files.length > 0 && (
        <p className="text-muted">
          {files.length} selected · {doneCount} done · {errorCount} failed
        </p>
      )}

      {files.map((entry) => (
        <div key={entry.id} className="card list-card">
          <div className="list-card-row">
            <div className="list-card-identity">
              <FileText size={18} className="text-muted" />
              <div>
                <strong>
                  {entry.status === 'done' || entry.status === 'done-no-ai' ? (
                    entry.candidateId ? (
                      <Link to={`/candidates/${entry.candidateId}`}>{entry.candidateName}</Link>
                    ) : (
                      entry.candidateName
                    )
                  ) : (
                    entry.file.name
                  )}
                </strong>
                <div className="text-muted">
                  {entry.status === 'done' && 'Added to pool - AI extracted profile'}
                  {entry.status === 'done-no-ai' && `Added to pool, but AI processing failed: ${entry.error}`}
                  {entry.status === 'error' && entry.error}
                  {entry.status === 'pending' && entry.file.name}
                  {entry.status === 'uploading' && 'Uploading and processing…'}
                </div>
              </div>
            </div>
            <div className="list-card-actions">
              {entry.status === 'pending' && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFile(entry.id)}>
                  Remove
                </button>
              )}
              {entry.status === 'uploading' && <Loader2 size={18} className="spin-icon" />}
              {entry.status === 'done' && <CheckCircle2 size={18} color="var(--success)" />}
              {entry.status === 'done-no-ai' && <CheckCircle2 size={18} color="var(--warning)" />}
              {entry.status === 'error' && <XCircle size={18} color="var(--danger)" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
