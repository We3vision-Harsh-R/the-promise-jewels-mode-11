import { AuthProvider } from '@/features/auth/hooks/useAuth.jsx'
import { ToastProvider } from '@/components/feedback/Toast.jsx'
import { PermissionsProvider } from '@/features/rbac/usePermissions.jsx'

// Every app-wide context provider is composed here, so App.jsx stays a thin
// shell and new providers (theme, query client, ...) get added in one place
// instead of deepening the nesting inside App.jsx.
export default function Providers({ children }) {
  return (
    <AuthProvider>
      {/* Inside AuthProvider because it keys on the signed-in account: it
          fetches nothing until there is one, and refetches when it changes. */}
      <PermissionsProvider>
        <ToastProvider>{children}</ToastProvider>
      </PermissionsProvider>
    </AuthProvider>
  )
}
