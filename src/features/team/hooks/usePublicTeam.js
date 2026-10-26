import { useEffect, useState } from 'react'

import { listPublicTeam } from '@/features/team/team.api.js'
import { useContentTick } from '@/services/contentSync.js'

/**
 * The people for the Our Team page.
 *
 * Fetched on every visit to the page rather than cached for the whole session:
 * someone who adds a person in the admin panel and then opens the page expects
 * to see them, and the answer comes from the server's own cache in a few
 * milliseconds anyway.
 *
 * `loading` is true until the first answer, so the page can show a calm
 * skeleton instead of flashing "nobody is listed" first. A failed request
 * becomes an empty list — the page then shows its message rather than breaking.
 */
export default function usePublicTeam() {
  const [state, setState] = useState({ members: [], loading: true })
  const tick = useContentTick()

  useEffect(() => {
    let alive = true

    listPublicTeam()
      .then((rows) => alive && setState({ members: Array.isArray(rows) ? rows : [], loading: false }))
      .catch(() => alive && setState({ members: [], loading: false }))

    return () => {
      alive = false
    }
  }, [tick])

  return state
}
