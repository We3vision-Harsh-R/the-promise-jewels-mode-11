import { useEffect, useMemo, useState } from 'react'

import { getAccessProfile } from '@/features/rbac/rbac.api.js'
import { PermissionsContext, usePermissions } from '@/features/rbac/permissionsContext.js'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'

/**
 * What the signed-in admin may do, for the panel to draw itself from.
 *
 * The permissions are FETCHED, never derived. The browser keeps no copy of
 * what permissions exist, nor of which ones a role implies — it asks the
 * server and renders the answer. That is what makes the two halves of RBAC
 * impossible to drift apart: there is one catalogue, on the server.
 *
 * Hiding a control is a courtesy, not a control. Everything gated here is
 * gated again on the server (permission.middleware.ts); this exists so the
 * panel does not offer buttons that would 403.
 */

const EMPTY = Object.freeze({
  role: null,
  isMaster: false,
  permissions: [],
  resources: [],
})

export function PermissionsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Held together with the account it belongs to, rather than reset from an
  // effect when the account changes. A reset would be a setState during an
  // effect body, and — worse — there would be a frame between the two where
  // the previous person's permissions were still on screen.
  const [state, setState] = useState({ userId: null, profile: null })

  useEffect(() => {
    if (!userId) return undefined

    let alive = true

    getAccessProfile()
      .then((data) => {
        if (alive) setState({ userId, profile: data ?? EMPTY })
      })
      .catch(() => {
        // A failed fetch must never be read as "allowed". An empty profile
        // renders the no-access state, which is the safe way to fail.
        if (alive) setState({ userId, profile: EMPTY })
      })

    return () => {
      alive = false
    }
  }, [userId])

  const value = useMemo(() => {
    // Anything belonging to a different account is not this account's answer.
    const profile = state.userId === userId ? state.profile : null
    const granted = new Set(profile?.permissions ?? [])
    const resources = profile?.resources ?? []

    return {
      // Derived rather than stored: "we have an account but not yet its
      // answer" IS the loading state, and writing a flag for it would mean
      // a setState inside the effect body.
      loading: userId !== null && profile === null,
      ready: profile !== null,
      role: profile?.role ?? null,
      isMaster: Boolean(profile?.isMaster),
      resources,

      /** `can('collections', 'edit')` */
      can: (resource, action = 'view') => granted.has(`${resource}:${action}`),

      /** Whether the screen for this resource should exist at all. */
      canView: (resource) => granted.has(`${resource}:view`),

      /** Every resource this account may open, in catalogue order. */
      visibleResources: resources.filter((r) => granted.has(`${r.key}:view`)),
    }
  }, [state, userId])

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

/**
 * Renders its children only when the permission is held.
 *
 * `fallback` is for the rare case where absence needs saying — an empty state
 * explaining why a table is not there. Most callers want nothing, which is the
 * default: a button that cannot be used should be absent, not drawn disabled
 * and mysterious.
 */
export function Can({ resource, action = 'view', fallback = null, children }) {
  const { can } = usePermissions()
  return can(resource, action) ? children : fallback
}
