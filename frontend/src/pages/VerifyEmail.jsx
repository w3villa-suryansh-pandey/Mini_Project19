import { useState } from 'react'
import { verifyEmail } from '../services/api.js'

function VerifyEmail() {
  const [status, setStatus] = useState('ready')
  const [message, setMessage] = useState('Confirm your email address to activate your account.')
  const token = new URLSearchParams(window.location.search).get('token')

  async function handleVerification() {
    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token. Request a new email.')
      return
    }

    setStatus('verifying')
    try {
      const result = await verifyEmail(token)
      setStatus('verified')
      setMessage(result.message)
    } catch (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  return (
    <main className="verify-page">
      <section className="verify-content" aria-live="polite">
        <span className="verify-mark" aria-hidden="true">W</span>
        <p className="eyebrow">W3 ACCOUNT</p>
        <h1>{status === 'verified' ? 'Email verified' : status === 'error' ? 'Verification link issue' : 'Verify your email'}</h1>
        <p>{message}</p>
        {status === 'ready' && <button className="submit-button" type="button" onClick={handleVerification}>Verify email address <span aria-hidden="true">→</span></button>}
        {status === 'verifying' && <p className="verify-progress">Verifying your email address…</p>}
        {status !== 'verifying' && <a className="verify-signin-link" href="/">Return to sign in</a>}
      </section>
    </main>
  )
}

export default VerifyEmail