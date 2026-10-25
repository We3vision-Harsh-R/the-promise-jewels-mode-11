// Aliased to USE_MOCK so the rest of this file needs no other changes —
// auth now follows its own flag (USE_MOCK_AUTH) instead of the shared one,
// since the auth backend module is live while dashboard/collections/
// brands aren't yet.
import { primeAccessProfile } from '@/features/rbac/rbac.api.js'
import request, { USE_MOCK_AUTH as USE_MOCK, mockDelay } from '@/services/api/client.js'

const SESSION_KEY = 'pj_admin_session' // mock-only; real auth uses HttpOnly cookies + GET /me

export async function login({ email, password }) {
  if (USE_MOCK) {
    if (!email || password.length < 8) {
      throw new Error('Enter a valid email and a password of at least 8 characters.')
    }

    const user = {
      email,
      name: email.split('@')[0],
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return mockDelay(user)
  }

  // Real backend's /login never returns tokens — it only validates the
  // password and sends an OTP. Kept as a thin alias of requestLoginOtp for
  // anything still calling it directly.
  return requestLoginOtp({ email, password })
}

// Step 1 of login: POST /auth/login validates email+password and sends an
// OTP to the user's email. Response data is null — no session yet.
export async function requestLoginOtp({ email, password }) {
  if (USE_MOCK) {
    if (!email || password.length < 8) {
      throw new Error('Enter a valid email and a password of at least 8 characters.')
    }

    console.log('Mock: login OTP requested', email)

    return mockDelay({
      success: true,
      message: 'OTP sent successfully.',
    })
  }

  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

// Step 2 of login: POST /auth/verify-otp confirms the code. On the real
// backend this is what actually sets the accessToken/refreshToken
// HttpOnly cookies and returns { user } — the browser stores the cookies
// automatically (fetch is called with credentials: 'include' in api.js),
// there's nothing for this code to persist itself. Only email+otp are
// sent: the backend controller only reads those two fields off the body.
export async function verifyLoginOtp({ email, otp }) {
  if (USE_MOCK) {
    if (!otp || otp.length !== 6) {
      throw new Error('Invalid or expired code.')
    }

    console.log('Mock: login OTP verified', email, otp)

    const user = { email, name: email.split('@')[0] }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return mockDelay(user)
  }

  const { user } = await request('/auth/verify-otp', {
    method: 'POST',
    body: { email, otp },
  })
  return user
}

export async function logout() {
  if (USE_MOCK) {
    sessionStorage.removeItem(SESSION_KEY)
    return mockDelay(null, 150)
  }

  return request('/auth/logout', {
    method: 'POST',
  })
}

// Session restore on page load. Mock mode can check synchronously via
// sessionStorage, but the real backend's tokens live in HttpOnly cookies
// JS can never read — the only way to know "am I signed in" is to ask the
// server. GET /auth/me returns the user if the accessToken cookie is
// valid (auto-refreshed once via api.js's 401 handling if it just
// expired), or throws (caught here and treated as signed-out) if not.
export async function getSession() {
  if (USE_MOCK) {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  }

  // One request answers both "who is this" and "what may they do"; the second
  // half is handed to the permissions provider so it does not ask again. Held
  // for a moment so the early call from admin-main.jsx and the provider's own
  // call are one request, not two.
  if (!sessionInFlight || Date.now() - sessionAt > 3000) {
    sessionAt = Date.now()
    sessionInFlight = request('/auth/session')
      .then((data) => {
        primeAccessProfile(data.access)
        return data.user
      })
      .catch(() => {
        sessionInFlight = null
        return null
      })
  }
  return sessionInFlight
}

let sessionInFlight = null
let sessionAt = 0

export async function forgotPassword(email) {
  if (USE_MOCK) {
    console.log('Mock: forgot password', email)
    return mockDelay({
      success: true,
      message: 'OTP sent successfully.',
    })
  }

  return request('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })
}

// Step 2 of a password reset. The emailed code is checked on the SERVER
// (POST /auth/verify-reset-otp); only a correct, unexpired, unused code returns
// the short-lived `resetToken` that step 3 needs. The client never decides
// whether a code is right.
export async function verifyResetOtp({ email, otp }) {
  if (USE_MOCK) {
    if (!/^\d{6}$/.test(otp || '')) {
      throw new Error('Invalid OTP.')
    }

    return mockDelay({ resetToken: 'mock-reset-token-mock-reset-token-mock-1' })
  }

  const data = await request('/auth/verify-reset-otp', {
    method: 'POST',
    body: { email, otp },
  })

  return data
}

// Step 3. Needs the reset token from step 2 — the emailed code is not accepted.
export async function resetPassword({ email, resetToken, newPassword }) {
  if (USE_MOCK) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.')
    }

    console.log('Mock: reset password', email)

    return mockDelay({
      success: true,
      message: 'Password reset successful.',
    })
  }

  return request('/auth/reset-password', {
    method: 'POST',
    body: {
      email,
      resetToken,
      newPassword,
    },
  })
}
