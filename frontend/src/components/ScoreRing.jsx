export function ScoreRing({ score }) {
  const tier = score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low'
  return <div className={`score-ring score-ring-${tier}`}>{score}</div>
}
