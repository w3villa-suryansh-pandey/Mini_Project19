import { useEffect, useRef, useState } from 'react'
import { verifyEmail } from '../services/api.js'

function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [status, setStatus] = useState(token ? 'verifying' : 'error')
  const [message, setMessage] = useState(token
    ? 'Verifying your email address…'
    : 'This verification link is missing its token. Request a new email.')
  const verificationStarted = useRef(false)

  useEffect(() => {
    if (!token || verificationStarted.current) return

    verificationStarted.current = true
    let isActive = true
    verifyEmail(token)
      .then((result) => {
        if (!isActive) return
        setStatus('verified')
        setMessage(result.message)
      })
      .catch((error) => {
        if (!isActive) return
        setStatus('error')
        setMessage(error.message)
      })

    return () => { isActive = false }
  }, [token])

  return (
    <main className="verify-page">
      <section className="verify-content" aria-live="polite">
        <span className="verify-mark" aria-hidden="true">W</span>
        <p className="eyebrow">W3 ACCOUNT</p>
        <h1>{status === 'verified' ? 'Email verified' : status === 'error' ? 'Verification link issue' : 'Verify your email'}</h1>
        <p>{message}</p>
        {status === 'verifying' && <p className="verify-progress">Verifying your email address…</p>}
        {status !== 'verifying' && <a className="verify-signin-link" href="/">Return to sign in</a>}
      </section>
    </main>
  )
}

export default VerifyEmail