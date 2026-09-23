import { useState } from 'react'
import { Search, Sparkles, UserX } from 'lucide-react'
import { api } from '../api/client'
import { StatusBadge } from '../components/StatusBadge'
import { Avatar } from '../components/Avatar'
import { ScoreRing } from '../components/ScoreRing'
import { EmptyState } from '../components/EmptyState'

export default function MatchingPage() {
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const data = await api.post('/api/matching/search', { jdText })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Search Resume Pool</h1>
      <p className="text-muted">Paste a job description to find and rank matching candidates already in your pool.</p>

      <form className="card form-card" onSubmit={handleSearch}>
        <textarea
          rows={8}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here…"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="spinner" /> : <Search size={16} />}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <>
          <div className="card">
            <h3>
              <Sparkles size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
              AI understood this JD as
            </h3>
            <p>
              <strong>{result.structuredJd.job_title}</strong>
              {result.structuredJd.required_experience_years != null &&
                ` · ${result.structuredJd.required_experience_years}+ years`}
            </p>
            <div className="chip-group">
              {(result.structuredJd.required_skills || []).map((s) => (
                <span key={s} className="chip chip-required">
                  {s}
                </span>
              ))}
              {(result.structuredJd.preferred_skills || []).map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <p className="text-muted">
            Considered {result.totalCandidatesConsidered} candidates, {result.totalAfterHardFilter} passed
            requirement screening, showing top {result.results.length}.
          </p>

          {result.results.length === 0 && (
            <EmptyState icon={UserX} title="No matching candidates" subtitle="Try a broader job description, or add more resumes to your pool." />
          )}

          {result.results.map((r) => (
            <div key={r.candidateId} className="card list-card">
              <div className="list-card-row" onClick={() => setExpandedId(expandedId === r.candidateId ? null : r.candidateId)}>
                <div className="list-card-identity">
                  <Avatar name={r.name} size="sm" />
                  <div>
                    <strong>{r.name}</strong>
                    <div className="text-muted">{r.email}</div>
                  </div>
                </div>
                <div className="score-cell">
                  <ScoreRing score={r.overall_score} />
                  <StatusBadge status={r.recommendation} />
                </div>
              </div>

              {expandedId === r.candidateId && (
                <div className="expanded-detail">
                  <p>
                    Skills {r.skills_score} · Experience {r.experience_score} · Education {r.education_score} ·
                    Similarity {r.vectorSimilarity.toFixed(3)}
                  </p>
                  <div className="chip-group">
                    {(r.matched_skills || []).map((s) => (
                      <span key={s} className="chip chip-required">
                        {s}
                      </span>
                    ))}
                    {(r.missing_required_skills || []).map((s) => (
                      <span key={s} className="chip chip-missing">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p>{r.experience_analysis}</p>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
