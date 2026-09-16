import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'

export default function RequireAuth({ children }) {
  const { user, isChecking } = useAuth()
  const location = useLocation()

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <div className="h-6 w-6 rounded-full border-2 border-ink-900 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}
