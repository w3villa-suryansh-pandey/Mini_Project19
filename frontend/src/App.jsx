import { lazy, Suspense, useEffect, useState } from 'react'
import UserProfile from './pages/user/UserProfile.jsx'
import UserDashboard from './pages/user/UserDashboard.jsx'
import Pricing from './pages/user/Pricing.jsx'
import Payment from './pages/user/Payment.jsx'
const PrimePdfEditor = lazy(() => import('./pages/user/PrimePdfEditor.jsx'))
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import PricingPlans from './pages/admin/PricingPlans.jsx'
import Cronjobs from './pages/admin/Cronjobs.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import { signIn, signUp, startFacebookLogin, startGoogleLogin } from './services/api.js'
import './App.css'

function App() {
  const [mode, setMode] = useState('signup')
  const [selectedRole, setSelectedRole] = useState('user')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSignup = mode === 'signup'

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get('authError')
    if (!authError) return

    const messages = {
      google_not_configured: 'Google sign-in is not configured on the server yet.',
      facebook_not_configured: 'Facebook sign-in is not configured on the server yet.',
      auth_not_configured: 'Authentication is not configured on the server yet.',
      google_login_cancelled: 'Google sign-in was cancelled.',
      google_email_unverified: 'Your Google account did not provide a verified email address.',
      google_account_linked_elsewhere: 'This email is already linked to a different Google account.',
      google_account_disabled: 'This account is disabled. Contact an administrator.',
      google_state_missing: 'Google sign-in state was missing. Restart sign-in and try again.',
      google_state_mismatch: 'Google sign-in state did not match. Restart sign-in and try again.',
      google_state_expired: 'Google sign-in took too long. Restart sign-in and try again.',
      google_state_invalid: 'Google sign-in could not be verified. Restart sign-in and try again.',
      google_provider_error: 'Google could not complete sign-in. Check the backend log and OAuth callback URL.',
      google_auth_failed: 'Google sign-in failed. Check your Google account and try again.',
      facebook_login_cancelled: 'Facebook sign-in was cancelled.',
      facebook_email_missing: 'Facebook did not share an email. Allow email access and try again.',
      facebook_account_link_required: 'This email already has an account. Sign in and connect Facebook from your profile.',
      facebook_account_linked_elsewhere: 'This Facebook account is already linked to another account.',
      facebook_account_disabled: 'This account is disabled. Contact an administrator.',
      facebook_state_missing: 'Facebook sign-in state was missing. Restart sign-in and try again.',
      facebook_state_mismatch: 'Facebook sign-in state did not match. Restart sign-in and try again.',
      facebook_state_expired: 'Facebook sign-in took too long. Restart sign-in and try again.',
      facebook_state_invalid: 'Facebook sign-in could not be verified. Restart sign-in and try again.',
      facebook_link_account_mismatch: 'Facebook could not be linked to this account. Sign in and try again.',
      facebook_provider_error: 'Facebook sign-in failed. Check the Facebook app settings and callback URL.',
      facebook_auth_failed: 'Facebook sign-in failed. Check your Facebook account and try again.',
    }
    setNotice(messages[authError] || messages.google_auth_failed)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  if (window.location.pathname === '/verify-email') {
    return <VerifyEmail />
  }

  if (window.location.pathname === '/profile') {
    return <ProtectedRoute requiredRole="user"><UserProfile /></ProtectedRoute>
  }

  if (window.location.pathname === '/dashboard') {
    return <ProtectedRoute requiredRole="user"><UserDashboard /></ProtectedRoute>
  }

  if (window.location.pathname === '/pricing') {
    return <ProtectedRoute requiredRole="user"><Pricing /></ProtectedRoute>
  }

  if (window.location.pathname === '/payment') {
    return <ProtectedRoute requiredRole="user"><Payment /></ProtectedRoute>
  }

  if (window.location.pathname === '/editor') {
    return (
      <ProtectedRoute requiredRole="user">
        <Suspense fallback={<p className="prime-pdf-loading">Loading PDF editor…</p>}>
          <PrimePdfEditor />
        </Suspense>
      </ProtectedRoute>
    )
  }

  if (window.location.pathname === '/admin') {
    return <ProtectedRoute><AdminDashboard /></ProtectedRoute>
  }

  if (window.location.pathname === '/admin/users') {
    return <ProtectedRoute><AdminUsers /></ProtectedRoute>
  }

  if (window.location.pathname === '/admin/plans') {
    return <ProtectedRoute><PricingPlans /></ProtectedRoute>
  }

  if (window.location.pathname === '/admin/cronjobs') {
    return <ProtectedRoute><Cronjobs /></ProtectedRoute>
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'signup') setSelectedRole('user')
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setNotice('')

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim()
    const credentials = {
      email,
      password: String(formData.get('password') || ''),
      role: selectedRole,
    }

    try {
      if (isSignup) {
        const result = await signUp({
          ...credentials,
          name: String(formData.get('name') || '').trim(),
        })
        window.location.assign(result.user.role === 'admin' ? '/admin' : '/dashboard')
      } else {
        const result = await signIn(credentials)
        window.location.assign(result.user.role === 'admin' ? '/admin' : '/dashboard')
      }
    } catch (error) {
      setNotice(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSocialAuth(provider) {
    if (provider === 'Google') {
      startGoogleLogin()
      return
    }
    if (provider === 'Facebook') {
      startFacebookLogin()
      return
    }
    setNotice(`${provider} authentication is not connected yet. No data was sent.`)
  }

  return (
    <main className="auth-layout auth-simple-layout">
      <header className="w3-brand-header">
        <a className="w3-brand" href="#top" aria-label="W3 home">
          <span className="w3-brand-mark" aria-hidden="true">W3</span>
          <span className="w3-brand-name">W3</span>
          <span className="w3-brand-description">PDF or document editor</span>
        </a>
      </header>

      <section className="form-panel auth-simple-form-panel" id="top">
        <div className="auth-content">
          <div className="form-heading">
            <p className="eyebrow">YOUR WORKSPACE AWAITS</p>
            <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="form-subtitle">
              {isSignup
                ? 'Start with a few details. You can set everything else up later.'
                : 'Sign in to pick up right where you left off.'}
            </p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Account access mode">
            <button
              className={isSignup ? 'mode-tab active' : 'mode-tab'}
              type="button"
              role="tab"
              aria-selected={isSignup}
              onClick={() => changeMode('signup')}
            >
              Create account
            </button>
            <button
              className={!isSignup ? 'mode-tab active' : 'mode-tab'}
              type="button"
              role="tab"
              aria-selected={!isSignup}
              onClick={() => changeMode('login')}
            >
              Sign in
            </button>
          </div>

          <div className="social-auth-options" aria-label="Continue with a social account">
            <button className="social-auth-button" type="button" onClick={() => handleSocialAuth('Google')}>
              <span className="google-mark" aria-hidden="true">G</span>
              <span>Google</span>
            </button>
            <button className="social-auth-button" type="button" onClick={() => handleSocialAuth('Facebook')}>
              <span className="facebook-mark" aria-hidden="true">f</span>
              <span>Facebook</span>
            </button>
          </div>
          <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="account-role">
              Account type
              <select
                id="account-role"
                name="role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                <option value="user">User</option>
                <option value="admin" disabled={isSignup}>Admin{isSignup ? ' (existing admins only)' : ''}</option>
              </select>
              {isSignup && <span className="role-note">Admin accounts can only sign in; signup creates user accounts.</span>}
            </label>
            {isSignup && (
              <label className="field-label" htmlFor="full-name">
                Full name
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label className="field-label" htmlFor="email">
              Work email
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="field-label" htmlFor="password">
              <span className="label-row">
                Password
                {!isSignup && <a href="#reset" onClick={(event) => {
                  event.preventDefault()
                  setNotice('Password reset is not connected yet.')
                }}>Forgot password?</a>}
              </span>
              <span className="password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={isSignup ? 8 : undefined}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            {isSignup && (
              <label className="consent-row">
                <input type="checkbox" name="terms" required />
                <span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</span>
              </label>
            )}

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              <span aria-hidden="true">→</span>
            </button>
            <p className="form-notice" aria-live="polite">{notice}</p>
          </form>

          <p className="switch-prompt">
            {isSignup ? 'Already have an account?' : 'New to W3?'}{' '}
            <button type="button" onClick={() => changeMode(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="security-note"><span aria-hidden="true">◆</span> Your information is always kept private.</p>
        </div>
        <footer className="form-footer">
          <span>© 2026 W3</span>
          <a href="mailto:hello@w3villa.example">Need help?</a>
        </footer>
      </section>
    </main>
  )
}

export default App
