import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'
import { verifyEmail } from '../services/api.js'

// React StrictMode can mount, clean up, and remount effects in development.
// Share the request across those effect runs so a single-use token is sent once.
const verificationRequests = new Map()

function verifyEmailOnce(token) {
  const existingRequest = verificationRequests.get(token)
  if (existingRequest) return existingRequest

  const request = verifyEmail(token).then(
    (result) => {
      verificationRequests.delete(token)
      return result
    },
    (error) => {
      verificationRequests.delete(token)
      throw error
    },
  )
  verificationRequests.set(token, request)
  return request
}

function VerifyEmail() {
  const location = useLocation()
  const token = new URLSearchParams(location.search).get('token')
  const [status, setStatus] = useState(token ? 'verifying' : 'error')
  const [message, setMessage] = useState(token
    ? 'Verifying your email address…'
    : 'This verification link is missing its token. Request a new email.')

  useEffect(() => {
    let isActive = true

    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token. Request a new email.')
      return () => { isActive = false }
    }

    setStatus('verifying')
    setMessage('Verifying your email address…')

    verifyEmailOnce(token)
      .then((result) => {
        if (!isActive) return
        setStatus('verified')
        setMessage(result?.message || 'Your email address has been verified. You can now sign in.')
      })
      .catch((error) => {
        if (!isActive) return
        setStatus('error')
        setMessage(error?.message || 'We could not verify this link. Request a new email and try again.')
      })

    return () => { isActive = false }
  }, [token])

  return (
    <main className="verify-page">
      <section className="verify-content" aria-live="polite" aria-busy={status === 'verifying'}>
        <div className="verify-wordmark">
          <img className="verify-mark" src={logo} alt="" />
          <span>S19</span>
        </div>
        <p className="eyebrow">S19 ACCOUNT</p>
        <h1>{status === 'verified' ? 'Email verified' : status === 'error' ? 'Verification link issue' : 'Verify your email'}</h1>
        <p>{message}</p>
        {status !== 'verifying' && <Link className="verify-signin-link" to="/login">Return to sign in</Link>}
      </section>
    </main>
  )
}

export default VerifyEmail
