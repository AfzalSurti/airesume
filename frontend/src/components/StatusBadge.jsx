export function StatusBadge({ status }) {
  if (!status) return null
  const slug = status.toLowerCase().replace(/_/g, '-')
  return <span className={`badge badge-${slug}`}>{status.replace(/_/g, ' ')}</span>
}
