export function classNames(...args) {
  return args.filter(Boolean).join(' ')
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function statusTone(status) {
  const map = {
    published: 'emerald', active: 'emerald', resolved: 'emerald', upcoming: 'brass',
    draft: 'ink', inactive: 'ink', past: 'ink',
    new: 'rose', in_progress: 'brass',
  }
  return map[status] || 'ink'
}
