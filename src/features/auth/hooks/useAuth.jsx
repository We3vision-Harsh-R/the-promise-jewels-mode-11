import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import * as authService from '@/features/auth/auth.api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = checking, null = signed out
  const [error, setError] = useState('')

  const { pathname } = useLocation()
  const isAdminArea = pathname.startsWith('/admin')

  useEffect(() => {
    // Only the admin side has a session to find.
    //
    // This provider wraps the whole app, so the check used to run on the
    // public homepage too — where there is no cookie, so GET /auth/me was a
    // guaranteed 401, and the API client answers a 401 by calling
    // /auth/refresh and retrying. Two round trips that could only ever fail,
    // on every visit by every anonymous visitor. Measured against production
    // they cost about 1.5s: /auth/me finished at 1.8s and the /auth/refresh
    // it triggered at 3.3s.
    //
    // Nothing public reads the user — the only consumers are RequireAuth, the
    // Sidebar, the Topbar and LoginPage, all of them behind /admin — so the
    // question simply does not need asking until someone goes there.
    //
    // Deliberately NOT guarded by a ref that says "already asked". A first
    // attempt at this used one, and it deadlocked the whole admin panel in
    // development: StrictMode runs an effect twice, so the first pass set the
    // flag and then had its result thrown away by its own cleanup, and the
    // second pass saw the flag and never asked at all. `user` stayed
    // undefined, which RequireAuth reads as "still checking", so every admin
    // route rendered a spinner forever. Re-running on a genuine change of
    // area is one request and it revalidates the session, which is the
    // behaviour worth having anyway.
    if (!isAdminArea) return

    // getSession() is async on the real backend (the tokens live in HttpOnly
    // cookies JS cannot read, so it has to ask GET /auth/me).
    let alive = true
    authService.getSession().then((session) => {
      if (alive) setUser(session)
    })
    return () => { alive = false }
  }, [isAdminArea])

  // Kept for backward compatibility — nothing in the app currently calls
  // this directly anymore (LoginPage now uses the two-step OTP flow
  // below), but leaving it in case anything else references it.
  const login = useCallback(async (email, password) => {
    setError('')
    try {
      const session = await authService.login({ email, password })
      setUser(session)
      return true
    } catch (e) {
      setError(e.message || 'Unable to sign in.')
      return false
    }
  }, [])

  // Step 1: validate credentials + send the OTP. No session yet.
  /**
   * Step one of signing in.
   *
   * Returns { ok, otpRequired }. When the emailed code is switched off in
   * Settings the password WAS the whole check, so the server has already set
   * the session cookies and handed back the user — there is no second step to
   * send anyone to, and holding them on a code screen would strand them.
   */
  const requestLoginOtp = useCallback(async (email, password) => {
    setError('')
    try {
      const data = await authService.requestLoginOtp({ email, password })

      // Absent on the mock path and on any older server, where a code was
      // always sent — so a missing flag is read as "yes, ask for one".
      const otpRequired = data?.otpRequired !== false

      if (!otpRequired && data?.user) setUser(data.user)

      return { ok: true, otpRequired }
    } catch (e) {
      setError(e.message || 'Unable to sign in.')
      return { ok: false, otpRequired: true }
    }
  }, [])

  // Step 2: confirm the OTP, which creates the session (real backend also
  // sets the accessToken/refreshToken HttpOnly cookies as a side effect of
  // this call — nothing here needs to store them).
  const verifyLoginOtp = useCallback(async (email, password, otp) => {
    setError('')
    try {
      const session = await authService.verifyLoginOtp({ email, password, otp })
      setUser(session)
      return true
    } catch (e) {
      setError(e.message || 'Invalid or expired code.')
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, error, login, requestLoginOtp, verifyLoginOtp, logout, isChecking: user === undefined }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}