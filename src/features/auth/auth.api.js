// Aliased to USE_MOCK so the rest of this file needs no other changes —
// auth now follows its own flag (USE_MOCK_AUTH) instead of the shared one,
// since the auth backend module is live while dashboard/collections/
// brands aren't yet.
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

  try {
    return await request('/auth/me')
  } catch {
    return null
  }
}

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

// NOTE on the real backend: there is no standalone endpoint to
// pre-validate a forgot-password OTP. /auth/verify-otp is hardcoded
// server-side to only check LOGIN-purpose codes — calling it here with a
// FORGOT_PASSWORD code will always fail. The backend instead checks the
// OTP as part of resetPassword() itself. This function is therefore
// mock-only (LoginPage's forgot-password "enter code" step no longer
// calls it in real mode — see LoginPage.jsx); kept here so mock behavior
// is unchanged and so it's obvious *why* it's mock-only if someone reaches
// for it later.
export async function verifyOtp({ email, otp }) {
  if (USE_MOCK) {
    if (!otp || otp.length !== 6) {
      throw new Error('Invalid OTP.')
    }

    console.log('Mock: verify OTP', email, otp)

    return mockDelay({
      success: true,
    })
  }

  throw new Error('Not supported by the backend — OTP is validated during resetPassword() instead.')
}

export async function resetPassword({ email, otp, newPassword }) {
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
      otp,
      newPassword,
    },
  })
}