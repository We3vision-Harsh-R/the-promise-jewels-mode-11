import { useMemo } from 'react'

import usePublicTeam from '@/features/team/hooks/usePublicTeam.js'

/**
 * The people a band of the website shows: those added under Admin > Our Team
 * and marked as shown, narrowed to the ones ticked in the Editor ("memberIds",
 * comma-separated). Nothing ticked means everyone. Order is the Our Team order.
 */
export default function useSelectedTeam(memberIds) {
  const { members, loading } = usePublicTeam()

  const chosen = useMemo(() => {
    const ids = String(memberIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    return ids.length === 0 ? members : members.filter((member) => ids.includes(member.id))
  }, [members, memberIds])

  return { members: chosen, loading }
}
