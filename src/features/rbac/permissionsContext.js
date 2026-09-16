import { createContext, useContext } from 'react'

/**
 * The context and its hooks, kept apart from the components that provide it.
 *
 * Splitting them is not organisational taste: a file that exports both a
 * component and a plain function loses fast refresh for the whole module, so
 * editing a permission check would remount the panel and drop whatever the
 * admin had half-typed.
 */
export const PermissionsContext = createContext(null)

export function usePermissions() {
  const context = useContext(PermissionsContext)

  if (!context) {
    // Failing loudly beats silently reporting "no permissions", which would
    // look like a role problem rather than a missing provider.
    throw new Error('usePermissions must be used inside a PermissionsProvider')
  }

  return context
}

/** The hook form of a single check, for logic rather than markup. */
export function useCan(resource, action = 'view') {
  const { can } = usePermissions()
  return can(resource, action)
}
