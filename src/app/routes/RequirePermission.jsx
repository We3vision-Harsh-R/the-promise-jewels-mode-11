import { Navigate } from 'react-router-dom'

import { usePermissions } from '@/features/rbac/permissionsContext.js'

/**
 * Refuses a route the current role may not open.
 *
 * Hiding the sidebar entry is not enough — the URL is still typeable, and a
 * bookmark from before a role changed still resolves. This is the second of
 * three gates: the nav does not offer it, this does not mount it, and the API
 * behind it refuses the request anyway (permission.middleware.ts). Only the
 * third is a security control; the first two exist so the panel behaves
 * sensibly rather than filling with failed requests.
 *
 * While the profile is still loading it renders nothing rather than
 * redirecting. Redirecting on "not known yet" would bounce a legitimate admin
 * off their own landing page on every hard refresh.
 */
export default function RequirePermission({ resource, action = 'view', children }) {
  const { ready, can, visibleResources } = usePermissions()

  if (!ready) return null

  if (can(resource, action)) return children

  // Somewhere they CAN go beats a dead end. If there is nowhere, the no-access
  // screen below says so plainly instead of looping through redirects.
  const firstAllowed = visibleResources.find((r) => r.path)

  if (firstAllowed) {
    return <Navigate to={firstAllowed.path} replace />
  }

  return <NoAccess />
}

/**
 * The end state for an account whose role grants nothing.
 *
 * It is reachable: a role can legitimately be created with no permissions, and
 * a new account starts somewhere. Saying so directly is better than an empty
 * dashboard that looks broken.
 */
function NoAccess() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-100 bg-ivory-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>

      <h2 className="font-display text-lg font-semibold text-ink-900">
        Nothing has been shared with you yet
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-ink-400">
        Your account is active, but the role it holds does not open any screens
        in this panel. Ask an administrator to grant your role access.
      </p>
    </div>
  )
}
