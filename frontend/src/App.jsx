import { lazy, Suspense, useEffect, useState } from 'react'

import ProtectedRoute from './components/ProtectedRoute.jsx'

import { resendVerification, signIn, signUp, startFacebookLogin, startGoogleLogin } from './services/api.js'

import logo from './assets/logo.png'

import LandingPage from './pages/LandingPage.jsx'

import './App.css'

import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'



const ForgotPassword = lazy(() =>

  import('./pages/auth/ForgotPassword.jsx')

)



const ResetPassword = lazy(() =>

  import('./pages/auth/ResetPassword.jsx')

)



const UserProfile = lazy(() => import('./pages/user/UserProfile.jsx'))

const UserDashboard = lazy(() => import('./pages/user/UserDashboard.jsx'))

const WorkspaceHome = lazy(() => import('./pages/user/WorkspaceHome.jsx'))

const Pricing = lazy(() => import('./pages/user/Pricing.jsx'))

const Payment = lazy(() => import('./pages/user/Payment.jsx'))

const PrimePdfEditor = lazy(() => import('./pages/user/PrimePdfEditor.jsx'))

const PresentationStudio = lazy(() => import('./pages/user/PresentationStudio.jsx'))

const FileCompressor = lazy(() => import('./pages/user/FileCompressor.jsx'))

const FileConverter = lazy(() => import('./pages/user/FileConverter.jsx'))

const WritingPad = lazy(() => import('./pages/user/WritingPad.jsx'))

const ImageTools = lazy(() => import('./pages/user/ImageTools.jsx'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))

const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'))

const AdminUserDetails = lazy(() => import('./pages/admin/UserDetails.jsx'))

const PricingPlans = lazy(() => import('./pages/admin/PricingPlans.jsx'))

const Cronjobs = lazy(() => import('./pages/admin/Cronjobs.jsx'))

const AdminProfile = lazy(() => import('./pages/admin/AdminProfile.jsx'))

const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'))

const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'))



const AUTH_ERROR_MESSAGES = {

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



function LazyRoute({ Page, requiredRole }) {

  return (

    <Suspense fallback={<main className="route-loading" role="status">Loading page…</main>}>

      <ProtectedRoute {...(requiredRole ? { requiredRole } : {})}>

        <Page />

      </ProtectedRoute>

    </Suspense>

  )

}



function AuthPage({ notice, setNotice }) {
  const navigate = useNavigate()
  const location = useLocation()

  const mode = location.pathname === '/login' ? 'login' : 'signup'

  const [selectedRole, setSelectedRole] = useState('user')

  const [showPassword, setShowPassword] = useState(false)


  const [isSubmitting, setIsSubmitting] = useState(false)

  const [resendEmail, setResendEmail] = useState('')

  const [canResendVerification, setCanResendVerification] = useState(false)



  const isSignup = mode === 'signup'



  function changeMode(nextMode) {

    navigate(nextMode === 'signup' ? '/signup' : '/login')

    if (nextMode === 'signup') setSelectedRole('user')

    setNotice('')

    setCanResendVerification(false)

  }



  async function handleSubmit(event) {

    event.preventDefault()

    setIsSubmitting(true)

    setNotice('')

    setCanResendVerification(false)



    const formData = new FormData(event.currentTarget)

    const email = String(formData.get('email') || '').trim()

    setResendEmail(email)

    const credentials = {

      email,

      password: String(formData.get('password') || ''),

      role: selectedRole,

    }



    try {

      if (isSignup) {

        const password = String(formData.get('password') || '')

        const result = await signUp({

          ...credentials,

          name: String(formData.get('name') || '').trim(),

        })

        setNotice(result.message)

        setCanResendVerification(true)

        navigate('/login', {
          replace: true,
          state: { signupCredentials: { email, password } },
        })

      } else {

        const result = await signIn(credentials)

        navigate(result.user.role === 'admin' ? '/admin' : '/home', { replace: true })

      }

    } catch (error) {

      setNotice(error.message)

      setCanResendVerification(error.code === 'EMAIL_NOT_VERIFIED' || error.code === 'EMAIL_SEND_FAILED' || error.code === 'EMAIL_NOT_CONFIGURED')

    } finally {

      setIsSubmitting(false)

    }

  }



  async function handleResendVerification() {

    setIsSubmitting(true)

    setNotice('')

    try {

      const result = await resendVerification(resendEmail)

      setNotice(result.message)

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

        <Link className="w3-brand" to="/" aria-label="S19 home">

          <span className="w3-brand-wordmark">

            <img className="w3-brand-mark" src={logo} alt="" />

            <span className="w3-brand-name">S19</span>

          </span>

          <span className="w3-brand-description">PDF or document editor</span>

        </Link>

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



          <form key={mode} className="auth-form" onSubmit={handleSubmit}>

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

                defaultValue={location.state?.signupCredentials?.email || ''}

                required

              />

            </label>

            <label className="field-label" htmlFor="password">

              <span className="label-row">

                Password

                {!isSignup && (

                  <Link to="/forgot-password">

                  Forgot password?

                  </Link>              

                )}

              </span>

              <span className="password-wrap">

                <input

                  id="password"

                  name="password"

                  type={showPassword ? 'text' : 'password'}

                  placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'}

                  autoComplete={isSignup ? 'new-password' : 'current-password'}

                  defaultValue={!isSignup ? location.state?.signupCredentials?.password || '' : ''}

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

            {canResendVerification && resendEmail && (

              <button

                className="resend-verification-button"

                type="button"

                onClick={handleResendVerification}

                disabled={isSubmitting}

              >

                {isSubmitting ? 'Please wait…' : 'Resend verification email'}

              </button>

            )}

          </form>



          <p className="switch-prompt">

            {isSignup ? 'Already have an account?' : 'New to S19?'}{' '}

            <button type="button" onClick={() => changeMode(isSignup ? 'login' : 'signup')}>

              {isSignup ? 'Sign in' : 'Create an account'}

            </button>

          </p>

          <p className="security-note"><span aria-hidden="true">◆</span> Your information is always kept private.</p>

        </div>

        <footer className="form-footer">

          <span>© 2026 S19</span>

          <a href="mailto:hello@s19.example">Need help?</a>

        </footer>

      </section>

    </main>

  )

}



function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const authError = params.get('authError')
    if (!authError) return

    setNotice(AUTH_ERROR_MESSAGES[authError] || AUTH_ERROR_MESSAGES.google_auth_failed)
    params.delete('authError')
    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : '',
      hash: location.hash,
    }, { replace: true })
  }, [location.pathname, location.search, location.hash, navigate])

  return (
    <Routes>
      <Route path="/" element={<LandingPage notice={notice} />} />
      <Route path="/login" element={<AuthPage notice={notice} setNotice={setNotice} />} />
      <Route path="/signup" element={<AuthPage notice={notice} setNotice={setNotice} />} />
      <Route path="/verify-email" element={
        <Suspense fallback={<main className="route-loading" role="status">Loading verification…</main>}>
          <VerifyEmail />
        </Suspense>
      } />
      <Route path="/forgot-password" element={
        <Suspense fallback={<main className="route-loading" role="status">Loading forgot password…</main>}>
          <ForgotPassword />
        </Suspense>
      } />
      <Route path="/reset-password" element={
        <Suspense fallback={<main className="route-loading" role="status">Loading reset password…</main>}>
          <ResetPassword />
        </Suspense>
      } />
      <Route path="/profile" element={<LazyRoute requiredRole="user" Page={UserProfile} />} />
      <Route path="/home" element={<LazyRoute requiredRole="user" Page={WorkspaceHome} />} />
      <Route path="/dashboard" element={<LazyRoute requiredRole="user" Page={UserDashboard} />} />
      <Route path="/pricing" element={<LazyRoute requiredRole="user" Page={Pricing} />} />
      <Route path="/payment" element={<LazyRoute requiredRole="user" Page={Payment} />} />
      <Route path="/editor" element={<LazyRoute requiredRole="user" Page={PrimePdfEditor} />} />
      <Route path="/presentation" element={<LazyRoute requiredRole="user" Page={PresentationStudio} />} />
      <Route path="/compressor" element={<LazyRoute requiredRole="user" Page={FileCompressor} />} />
      <Route path="/converter" element={<LazyRoute requiredRole="user" Page={FileConverter} />} />
      <Route path="/writing-pad" element={<LazyRoute requiredRole="user" Page={WritingPad} />} />
      <Route path="/image-tools" element={<LazyRoute requiredRole="user" Page={ImageTools} />} />
      <Route path="/admin" element={<LazyRoute requiredRole="admin" Page={AdminDashboard} />} />
      <Route path="/admin/users" element={<LazyRoute requiredRole="admin" Page={AdminUsers} />} />
      <Route path="/admin/users/:userId" element={<LazyRoute requiredRole="admin" Page={AdminUserDetails} />} />
      <Route path="/admin/plans" element={<LazyRoute requiredRole="admin" Page={PricingPlans} />} />
      <Route path="/admin/cronjobs" element={<LazyRoute requiredRole="admin" Page={Cronjobs} />} />
      <Route path="/admin/reports" element={<LazyRoute requiredRole="admin" Page={AdminReports} />} />
      <Route path="/admin/profile" element={<LazyRoute requiredRole="admin" Page={AdminProfile} />} />
      <Route path="*" element={<main className="route-loading">Page not found</main>} />
    </Routes>
  )
}

export default App
