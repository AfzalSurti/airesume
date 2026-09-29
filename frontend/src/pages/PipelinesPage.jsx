import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { StatusBadge } from '../components/StatusBadge'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { Spinner } from '../components/Spinner'

const STAGES = [
  'DOCS_REQUESTED',
  'DOCS_SUBMITTED',
  'FORWARDED_TO_HOD',
  'INTERVIEW_SCHEDULED',
  'HOD_SELECTED',
  'HOD_REJECTED',
  'OFFER_SENT',
  'COMPLETED',
]

export default function PipelinesPage() {
  const { user } = useAuth()
  const [pipelines, setPipelines] = useState(null)
  const [stage, setStage] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(user?.role === 'HOD')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (stage) params.set('stage', stage)
    if (assignedToMe) params.set('assignedToMe', 'true')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets list for the new filters
    setPipelines(null)
    api
      .get(`/api/pipelines?${params.toString()}`)
      .then((data) => setPipelines(data.pipelines))
      .catch((err) => setError(err.message))
  }, [stage, assignedToMe])

  return (
    <div>
      <div className="page-header">
        <h1>Hiring Pipeline</h1>
      </div>

      <div className="toolbar">
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {user?.role === 'HOD' && (
          <label className="checkbox-field">
            <input type="checkbox" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />
            <span>Assigned to me</span>
          </label>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!pipelines && <Spinner label="Loading pipeline…" />}

      {pipelines && pipelines.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title="No candidates in the pipeline"
          subtitle="Request documents from a shortlisted applicant to start one."
        />
      )}

      {pipelines &&
        pipelines.map((p) => (
          <Link key={p.id} to={`/pipeline/${p.id}`} className="card list-card" style={{ display: 'block' }}>
            <div className="list-card-row">
              <div className="list-card-identity">
                <Avatar name={p.candidate_name} size="sm" />
                <div>
                  <strong>{p.candidate_name}</strong>
                  <div className="text-muted">
                    {p.job_title}
                    {p.hod_name && ` · HOD: ${p.hod_name}`}
                  </div>
                </div>
              </div>
              <StatusBadge status={p.stage} />
            </div>
          </Link>
        ))}
    </div>
  )
}
