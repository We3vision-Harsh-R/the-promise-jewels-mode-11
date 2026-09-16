export function formatDate(input, opts = {}) {
  if (!input) return '—'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...opts })
}

export function formatDateTime(input) {
  if (!input) return '—'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(input) {
  if (!input) return '—'
  const seconds = Math.floor((Date.now() - new Date(input).getTime()) / 1000)
  const ranges = [
    ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, secs] of ranges) {
    const val = Math.floor(seconds / secs)
    if (val >= 1) return `${val} ${unit}${val > 1 ? 's' : ''} ago`
  }
  return 'just now'
}
