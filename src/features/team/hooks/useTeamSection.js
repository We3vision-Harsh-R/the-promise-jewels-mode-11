import { useMemo } from 'react'

import usePublicTeam from '@/features/team/hooks/usePublicTeam.js'

/** "a,b,c" -> ["a","b","c"] */
export function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/**
 * The people one section of the website shows.
 *
 * Everyone in Admin > Our Team who is switched on there and is of the right
 * kind ("leader", "team", or "all"), except the ones whose eye was closed for
 * THIS section in the Editor (`hiddenIds`, comma-separated). A person added
 * tomorrow shows up everywhere by default; closing the eye hides them from that
 * one section only. The order is the one set in Our Team.
 */
export default function useTeamSection(kind, hiddenIds) {
  const { members, loading } = usePublicTeam()

  const shown = useMemo(() => {
    const hidden = parseIds(hiddenIds)
    return members.filter((member) => (kind === 'all' || member.kind === kind) && !hidden.includes(member.id))
  }, [members, kind, hiddenIds])

  return { members: shown, everyone: members, loading }
}
