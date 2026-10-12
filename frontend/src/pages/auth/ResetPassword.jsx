
import { useState } from 'react'
import { resetPassword } from '../../services/api.js'
import './PasswordReset.css'

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Invalid password reset link. Please request a new one.')
      return
    }

    if (password.length < 8 || password.length > 72) {
      setError('Password must be between 8 and 72 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await resetPassword(token, password)
      setCompleted(true)
      setMessage(result.message || 'Your password has been reset successfully.')
      setPassword('')
      setConfirmPassword('')
      window.history.replaceState({}, '', '/reset-password')
    } catch (err) {
      setError(err.message || 'Unable to reset password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="password-page">
      <div className="password-card">
        <a href="/" className="password-brand">S19</a>

        <div className="password-icon" aria-hidden="true">🔒</div>

        <h1>Create new password</h1>
        <p className="password-description">
          Choose a strong password to secure your account.
        </p>

        {completed ? (
          <>
            <p className="password-alert success" role="status">{message}</p>
            <a href="/login" className="password-button password-button-link">
              Continue to login
            </a>
          </>
        ) : !token ? (
          <>
            <p className="password-alert error" role="alert">
              This reset link is invalid or missing a token.
            </p>
            <a href="/forgot-password" className="password-button password-button-link">
              Request new link
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              disabled={isSubmitting}
            />

            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              disabled={isSubmitting}
            />

            <label className="password-show">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              Show passwords
            </label>

            {error && <p className="password-alert error" role="alert">{error}</p>}

            <button
              type="submit"
              className="password-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}

        <a href="/login" className="password-back-link">
          ← Back to login
        </a>
      </div>
    </main>
  )
}
