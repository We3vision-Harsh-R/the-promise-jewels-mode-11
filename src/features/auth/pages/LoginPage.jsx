import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { Eye, EyeOff, ArrowRight, ArrowLeft, Mail, Lock, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth.jsx'
import { forgotPassword, resetPassword } from '@/features/auth/auth.api.js'
import { Field, Input } from '@/components/forms/Field.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'

// The card used to paint itself here: a teal gradient running to nearly
// pure cyan, with a dark overlay laid on top to flatten it back down.
//
// Neither was ever visible. `.admin-theme .pj-card` paints every card with
// the glass fill and does it with !important — it has to, or Bootstrap`s own
// .bg-white utility repaints the panel — and an !important stylesheet rule
// beats an inline style. This screen also sits OUTSIDE AdminLayout, so it
// carries no data-admin-theme attribute and was being handed the light
// theme`s white glass, then darkened by the overlay. That is where the murky
// grey card came from.
//
// It is painted in globals.css now, where the rule that was winning lives.
// Dark recessed field treatment — near-black instead of a light sheen,
// so fields read as inset boxes against the darker card.
const FIELD_GRADIENT = 'linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.18) 100%)'
const OTP_LENGTH = 6

// Fixed sparkle field (position/size/timing) so it doesn't reshuffle on
// every render — only the values, no new color tokens (brass-300 only).
const SPARKLES = [
  { top: '12%', left: '18%', size: 3, delay: 0, duration: 3.4 },
  { top: '22%', left: '82%', size: 2, delay: 0.6, duration: 4.1 },
  { top: '68%', left: '10%', size: 2, delay: 1.2, duration: 3.8 },
  { top: '78%', left: '88%', size: 3, delay: 0.3, duration: 3.2 },
  { top: '38%', left: '6%', size: 2, delay: 1.8, duration: 4.6 },
  { top: '8%', left: '55%', size: 2, delay: 2.2, duration: 3.6 },
  { top: '90%', left: '48%', size: 2, delay: 0.9, duration: 4.2 },
  { top: '55%', left: '92%', size: 3, delay: 1.5, duration: 3.9 },
  { top: '48%', left: '30%', size: 2, delay: 2.6, duration: 4.4 },
  { top: '30%', left: '70%', size: 2, delay: 0.4, duration: 3.5 },
]

// Rounded-box field with a leading icon — dark, subtly bordered, muted
// gray-ivory icon (not gold) to match the reference. Hover/focus brighten
// the border toward gold as an interaction cue only.
function PillInput({ icon: Icon, className, style, ...props }) {
  return (
    <div className="relative group">
      <Icon size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ivory-100/40 z-10" />
      <Input
        style={{ backgroundImage: FIELD_GRADIENT, ...style }}
        className={`!relative !rounded-xl !border !border-ivory-100/10 !bg-transparent !pl-10 !text-ivory-100 placeholder:!text-ivory-100/25 !shadow-[0_2px_10px_-3px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] !transition-all !duration-300 group-hover:!border-brass-300/30 focus:!ring-2 focus:!ring-brass-300/35 focus:!border-brass-300/70 focus:!shadow-[0_2px_18px_-2px_rgba(196,168,93,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] ${className || ''}`}
        {...props}
      />
    </div>
  )
}

// One 6-box OTP entry with auto-advance-on-type and backspace-to-previous.
function OtpInput({ value, onChange }) {
  const refs = useRef([])
  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH)

  function setDigit(i, char) {
    const next = [...digits]
    next[i] = char
    onChange(next.join(''))
  }

  function handleChange(i, e) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    setDigit(i, char)
    if (char && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted.padEnd(OTP_LENGTH, ''))
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          style={{ backgroundImage: FIELD_GRADIENT }}
          className="h-12 w-10 rounded-xl border border-ivory-100/10 bg-transparent text-center text-lg font-medium text-ivory-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-300 hover:border-brass-300/30 focus:outline-none focus:ring-2 focus:ring-brass-300/35 focus:border-brass-300/70 focus:shadow-[0_2px_18px_-2px_rgba(196,168,93,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] focus:scale-105"
        />
      ))}
    </div>
  )
}

function StepHeading({ title, subtitle }) {
  return (
    <div className="mb-6 text-center">
      <h1 className="font-display text-3xl font-semibold text-ink-900">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-ink-400">{subtitle}</p>}
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-rose/10 border border-rose/20 px-3 py-2 text-xs text-rose animate-[pj-shake_0.4s_ease-in-out]">
      {message}
    </p>
  )
}

function BackLink({ onClick, label = 'Back to sign in' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 mx-auto text-xs text-brass-300 hover:text-brass-200 transition-colors duration-200 group"
    >
      <ArrowLeft size={13} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> {label}
    </button>
  )
}

// Uppercase, tracked-out label treatment matching the reference — a
// softer, less saturated gold than a pure brass-300, applied to Field's
// own label element (rendered as a <span> per the existing [&_span]
// selector convention used elsewhere in this file).
const GOLD_LABEL_CLASS =
  '[&_span]:text-brass-300/80 [&_span]:uppercase [&_span]:tracking-wider [&_span]:text-[11px] [&_span]:font-semibold'

// Primary CTA wrapper — adds a light diagonal shimmer sweep across the
// gold button every few seconds and a gentle hover/press scale + lift.
function ShimmerCta({ children }) {
  return (
    <div className="relative overflow-hidden rounded-xl transition-all duration-200 hover:scale-[1.015] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0">
      {children}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        style={{ animation: 'pj-shimmer 3.2s ease-in-out infinite', animationDelay: '1s' }}
      />
    </div>
  )
}

export default function LoginPage() {
  const { user, requestLoginOtp, verifyLoginOtp, error } = useAuth()
  const location = useLocation()

  // 'login' | 'login-otp' | 'forgot' | 'otp' | 'reset' | 'done'
  const [mode, setMode] = useState('login')

  // Empty, not a default. This shipped seeded with an address, which named
  // a real account to anyone who opened the sign-in page — half of a
  // credential, handed over before a password was ever asked for. It also
  // meant the wrong address was pre-filled for every OTHER person who signs
  // in here, and a field you have to clear before you can use it is worse
  // than an empty one.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Separate OTP box state for the login step vs. the password-reset step
  // below, so switching between "forgot password" and a normal login
  // never leaves a stale code sitting in the other flow's boxes.
  const [loginOtp, setLoginOtp] = useState('')

  const [resetEmail, setResetEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [stepLoading, setStepLoading] = useState(false)
  const [stepError, setStepError] = useState('')

  const panelRef = useRef(null)
  const markRef = useRef(null)
  const cardWrapRef = useRef(null)

  // Mount-only: the logo entrance and the card entrance.
  // Kept separate from the mode-change effect below so
  // the logo doesn't re-pop every time the user moves between steps.
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(markRef.current, { opacity: 0, y: -14, scale: 0.7, rotate: -12 }, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: 0.7 })
      .fromTo(cardWrapRef.current, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6 }, '-=0.35')
      .to(markRef.current, { y: -6, duration: 1.8, ease: 'sine.inOut', repeat: -1, yoyo: true }, '-=0.1')

  }, [])

  // Fires on every step change: crossfades the panel content and staggers
  // the new step's fields/buttons in. goTo() below fades the panel out
  // first, then flips `mode`, which re-triggers this to fade it back in.
  useEffect(() => {
    if (!panelRef.current) return
    gsap.set(panelRef.current, { opacity: 1 })
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.fromTo(
      panelRef.current.children,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.07 }
    )
  }, [mode])

  if (user) {
    return <Navigate to={location.state?.from?.pathname || '/admin/dashboard'} replace />
  }

  // Fades the current step out, then swaps `mode` — the mode-effect above
  // handles fading the next step back in, giving a soft crossfade instead
  // of an instant content swap.
  function goTo(next) {
    setStepError('')
    if (panelRef.current) {
      gsap.to(panelRef.current, {
        opacity: 0,
        y: -8,
        duration: 0.16,
        ease: 'power2.in',
        onComplete: () => setMode(next),
      })
    } else {
      setMode(next)
    }
  }

  // Step 1 of login: validate email/password and send the OTP — does NOT
  // sign in yet. Session is only created once the code is verified below.
  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { ok, otpRequired } = await requestLoginOtp(email, password)
    setLoading(false)

    if (!ok) return

    // With the code switched off there is nothing to type: the session already
    // exists, `user` is set, and the redirect at the top of this component
    // fires on its own.
    if (!otpRequired) return

    setLoginOtp('')
    goTo('login-otp')
  }

  // Step 2 of login: confirming the code is what actually creates the
  // session — once verifyLoginOtp succeeds, `user` becomes truthy and the
  // Navigate redirect above fires automatically.
  async function handleLoginOtpSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await verifyLoginOtp(email, password, loginOtp)
    setLoading(false)
  }

  async function handleResendLoginOtp() {
    setLoading(true)
    await requestLoginOtp(email, password)
    setLoading(false)
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setStepError('')
    setStepLoading(true)
    try {
      await forgotPassword(resetEmail)
      setOtp('')
      goTo('otp')
    } catch (err) {
      setStepError(err.message || 'Could not send reset instructions.')
    } finally {
      setStepLoading(false)
    }
  }

  // The backend has no standalone way to pre-validate a forgot-password
  // OTP (its /verify-otp is login-only — see auth.service.js). So this
  // step only checks the code is 6 digits locally and advances; the OTP
  // is actually verified server-side inside handleResetSubmit's call to
  // resetPassword(), which fails with a clear error there if it's wrong.
  function handleOtpSubmit(e) {
    e.preventDefault()
    setStepError('')
    if (otp.length !== OTP_LENGTH) {
      setStepError('Enter the 6-digit code.')
      return
    }
    goTo('reset')
  }

  async function handleResendOtp() {
    setStepError('')
    setStepLoading(true)
    try {
      await forgotPassword(resetEmail)
    } catch (err) {
      setStepError(err.message || 'Could not resend code.')
    } finally {
      setStepLoading(false)
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setStepError('')
    if (newPassword !== confirmPassword) {
      setStepError('New password and confirmation do not match.')
      return
    }
    setStepLoading(true)
    try {
      await resetPassword({ email: resetEmail, otp, newPassword })
      goTo('done')
    } catch (err) {
      setStepError(err.message || 'Could not reset password.')
    } finally {
      setStepLoading(false)
    }
  }

  // Very light pointer-based tilt on the card for a premium "catches the
  // light" feel — a few degrees max, eased back to flat on leave. Doesn't
  // touch the card's own gradient/background.
  function handleCardMouseMove(e) {
    const el = cardWrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    gsap.to(el, { rotateY: px * 4, rotateX: -py * 4, duration: 0.4, ease: 'power2.out', transformPerspective: 800 })
  }

  function handleCardMouseLeave() {
    const el = cardWrapRef.current
    if (!el) return
    gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'power2.out' })
  }

  return (
    // !bg-ink-900 forces this dark background to win over .admin-theme's
    // own `background: var(--color-ivory)` rule in index.css — same
    // selector specificity, but the stylesheet rule was winning the
    // cascade and painting this page cream/ivory instead of dark.
    // pj-login-bg: this is the one admin screen with a DARK ground, so the
    // light glass used everywhere else would leave this card's dark text
    // sitting on a see-through panel. The class re-points the glass fill to
    // a dense variant for this page only (see globals.css).
    <div className="admin-theme pj-login-bg relative min-h-screen !bg-ink-900 flex items-center justify-center px-4 overflow-hidden">
      {/* Scoped keyframes for the idle/ambient animations used below. */}
      <style>{`
        @keyframes pj-twinkle { 0%, 100% { opacity: .15; transform: scale(.5); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes pj-shimmer { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(320%) skewX(-20deg); } }
        @keyframes pj-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
      `}</style>

      {/* Two blurred "ambient facet glow" blobs used to sit here — a gold one
          top right and a green one bottom left. Blurred to 3xl they were two
          pale patches washing light back into a ground that is meant to be a
          flat, deep green, and they were the brightest thing on the page.
          The sparkle field below gives the same life without lifting the
          ground: points of gold, not clouds of it. */}

      {/* Sparkle field — small twinkling points, jewelry-appropriate */}
      <div className="pointer-events-none absolute inset-0">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-brass-300"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              boxShadow: '0 0 6px 1px rgba(196,168,93,0.7)',
              animation: `pj-twinkle ${s.duration}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm">
        <div ref={markRef} className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
          <div className="relative flex h-full w-full items-center justify-center rounded-full border border-brass-300/25 bg-ink-900/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <img src="/images/PROMISE_LOGO_skin_icon_only.webp" alt="Promise Jewel" className="h-full w-full object-contain drop-shadow-lg" />
          </div>
        </div>

        <div
          ref={cardWrapRef}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          className="transition-shadow duration-500 hover:shadow-[0_0_64px_-12px_rgba(196,168,93,0.35)]"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        >
          <Card
            className="relative overflow-hidden !rounded-[32px] p-7 sm:p-8 border border-brass-300/10 dark-surface"
            style={{ boxShadow: '0 24px 70px -22px rgba(0, 0, 0, 0.65)' }}
          >
            {/* The darkening overlay that used to sit here is gone — the fill underneath is already the colour it was trying to reach. */}

            <div ref={panelRef} className="relative">
              {mode === 'login' && (
                <>
                  <StepHeading title="Promise Jewel" subtitle="Sign in to the Admin Portal" />
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* required dropped from Field (hides its "*" mark, matching
                        the reference); native `required` still passed to the
                        input itself below so HTML5 validation still applies. */}
                    <Field label="Email address" className={GOLD_LABEL_CLASS}>
                      <PillInput
                        icon={Mail}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@thepromisejewels.com"
                      />
                    </Field>

                    <Field label="Password" className={GOLD_LABEL_CLASS}>
                      <div className="relative">
                        <PillInput
                          icon={Lock}
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="!pr-10"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory-100/40 hover:text-ivory-100/70 z-10 transition-colors duration-200"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>

                    <div className="flex justify-end -mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email)
                          goTo('forgot')
                        }}
                        className="text-xs text-brass-300 hover:text-brass-200 underline-offset-4 hover:underline transition-colors duration-200"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <ErrorBanner message={error} />

                    <ShimmerCta>
                      <Button type="submit" variant="primary" className="w-full !rounded-xl" loading={loading} iconRight={ArrowRight}>
                        Sign In
                      </Button>
                    </ShimmerCta>
                  </form>

                  <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-brass-300/10 pt-4 text-xs text-brass-100/40">
                    <ShieldCheck size={13} className="text-brass-300/50" />
                    Full administrative access session
                  </div>
                </>
              )}

              {mode === 'login-otp' && (
                <>
                  <StepHeading
                    title="Enter the code"
                    subtitle={<>Sent to <span className="text-brass-200">{email}</span></>}
                  />
                  <form onSubmit={handleLoginOtpSubmit} className="space-y-5">
                    <OtpInput value={loginOtp} onChange={setLoginOtp} />

                    <ErrorBanner message={error} />

                    <ShimmerCta>
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full !rounded-xl"
                        loading={loading}
                        iconRight={ShieldCheck}
                        disabled={loginOtp.length !== OTP_LENGTH}
                      >
                        Verify & sign in
                      </Button>
                    </ShimmerCta>

                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={handleResendLoginOtp}
                        disabled={loading}
                        className="text-xs text-brass-300 hover:text-brass-200 underline-offset-4 hover:underline disabled:opacity-40 transition-colors duration-200"
                      >
                        Resend code
                      </button>
                      <span className="text-brass-300/30">·</span>
                      <BackLink onClick={() => goTo('login')} label="Cancel" />
                    </div>
                  </form>
                </>
              )}

              {mode === 'forgot' && (
                <>
                  <StepHeading title="Reset password" subtitle="We'll email you a 6-digit code" />
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <Field label="Email address" className={GOLD_LABEL_CLASS}>
                      <PillInput
                        icon={Mail}
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        placeholder="you@thepromisejewels.com"
                      />
                    </Field>

                    <ErrorBanner message={stepError} />

                    <ShimmerCta>
                      <Button type="submit" variant="primary" className="w-full !rounded-xl" loading={stepLoading} iconRight={Mail}>
                        Send code
                      </Button>
                    </ShimmerCta>

                    <BackLink onClick={() => goTo('login')} />
                  </form>
                </>
              )}

              {mode === 'otp' && (
                <>
                  <StepHeading
                    title="Enter the code"
                    subtitle={<>Sent to <span className="text-brass-200">{resetEmail}</span></>}
                  />
                  <form onSubmit={handleOtpSubmit} className="space-y-5">
                    <OtpInput value={otp} onChange={setOtp} />

                    <ErrorBanner message={stepError} />

                    <ShimmerCta>
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full !rounded-xl"
                        loading={stepLoading}
                        iconRight={ShieldCheck}
                        disabled={otp.length !== OTP_LENGTH}
                      >
                        Verify code
                      </Button>
                    </ShimmerCta>

                    <div className="flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={stepLoading}
                        className="text-xs text-brass-300 hover:text-brass-200 underline-offset-4 hover:underline disabled:opacity-40 transition-colors duration-200"
                      >
                        Resend code
                      </button>
                      <span className="text-brass-300/30">·</span>
                      <BackLink onClick={() => goTo('login')} label="Cancel" />
                    </div>
                  </form>
                </>
              )}

              {mode === 'reset' && (
                <>
                  <StepHeading title="New password" subtitle="Choose a new password for your account" />
                  <form onSubmit={handleResetSubmit} className="space-y-4">
                    <Field label="New password" className={GOLD_LABEL_CLASS} hint="At least 8 characters.">
                      <div className="relative">
                        <PillInput
                          icon={KeyRound}
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                          className="!pr-10"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((s) => !s)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ivory-100/40 hover:text-ivory-100/70 z-10 transition-colors duration-200"
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>

                    <Field label="Confirm new password" className={GOLD_LABEL_CLASS}>
                      <PillInput
                        icon={KeyRound}
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••"
                      />
                    </Field>

                    <ErrorBanner message={stepError} />

                    <ShimmerCta>
                      <Button type="submit" variant="primary" className="w-full !rounded-xl" loading={stepLoading} iconRight={ArrowRight}>
                        Update password
                      </Button>
                    </ShimmerCta>
                  </form>
                </>
              )}

              {mode === 'done' && (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brass-500/15 text-brass-300 animate-[pj-twinkle_1.6s_ease-in-out_2]">
                    <CheckCircle2 size={20} />
                  </div>
                  <h1 className="font-display text-xl text-ink-900">Password updated</h1>
                  <p className="mt-2 text-sm text-ink-400">You can now sign in with your new password.</p>
                  <ShimmerCta>
                    <Button
                      variant="primary"
                      className="w-full !rounded-xl mt-6"
                      iconRight={ArrowRight}
                      onClick={() => goTo('login')}
                    >
                      Back to sign in
                    </Button>
                  </ShimmerCta>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}