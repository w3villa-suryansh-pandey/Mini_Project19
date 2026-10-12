
import { useState } from 'react'
import { forgotPassword } from '../../services/api.js'
import './PasswordReset.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setIsSubmitting(true)

    try {
      const result = await forgotPassword(email.trim())
      setMessage(result.message || 'If an account exists, a reset link will be sent.')
    } catch (err) {
      setError(err.message || 'Unable to send reset email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="password-page">
      <div className="password-card">
        <a href="/" className="password-brand">S19</a>

        <div className="password-icon" aria-hidden="true">✉</div>

        <h1>Forgot your password?</h1>
        <p className="password-description">
          Enter your registered email address and we'll send you a link
          to reset your password.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="reset-email">Email address</label>
          <input
            id="reset-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={isSubmitting}
          />

          {error && <p className="password-alert error" role="alert">{error}</p>}
          {message && <p className="password-alert success" role="status">{message}</p>}

          <button
            type="submit"
            className="password-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <a href="/login" className="password-back-link">
          ← Back to login
        </a>
      </div>
    </main>
  )
}
