import { useEffect, useState } from 'react'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { getAddressFromCoordinates } from '../../services/location.service.js'
import { getAdminProfile, updateAdminProfile } from '../../services/api.js'

const COUNTRY_CODES = [
  { code: '+91', country: 'India', digits: 10 }, { code: '+1', country: 'US / Canada', digits: 10 },
  { code: '+44', country: 'UK', digits: 10 }, { code: '+61', country: 'Australia', digits: 9 },
  { code: '+64', country: 'New Zealand', digits: 10 }, { code: '+971', country: 'UAE', digits: 9 },
  { code: '+65', country: 'Singapore', digits: 8 }, { code: '+49', country: 'Germany', digits: 11 },
  { code: '+33', country: 'France', digits: 9 }, { code: '+81', country: 'Japan', digits: 10 },
  { code: '+86', country: 'China', digits: 11 }, { code: '+27', country: 'South Africa', digits: 9 },
]

function splitPhone(value = '') {
  const digits = String(value).replace(/\D/g, '')
  if (String(value).trim().startsWith('+')) {
    const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find(({ code }) => digits.startsWith(code.slice(1)))
    if (match) return { code: match.code, number: digits.slice(match.code.length - 1) }
  }
  return { code: '+91', number: digits }
}

function AdminProfile() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', address: '', company: '', jobTitle: '', bio: '', profilePicture: '' })
  const [countryCode, setCountryCode] = useState('+91')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [isError, setIsError] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationNotice, setLocationNotice] = useState('')
  const [locationError, setLocationError] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let isCurrent = true
    getAdminProfile()
      .then(({ profile: saved }) => {
        if (!isCurrent) return
        const phone = splitPhone(saved.phone)
        setCountryCode(phone.code)
        setProfile({
          name: saved.name || '', email: saved.email || '', phone: phone.number,
          address: saved.address || '', company: saved.company || '', jobTitle: saved.jobTitle || '',
          bio: saved.bio || '', profilePicture: saved.profilePicture || '',
        })
      })
      .catch((error) => { if (isCurrent) { setNotice(error.message || 'Could not load admin profile.'); setIsError(true) } })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  function updateField(event) {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }))
    setNotice('')
    setIsError(false)
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file to update your photo.')
      setIsError(true)
      event.target.value = ''
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setNotice('Choose an image smaller than 3 MB.')
      setIsError(true)
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setProfile((current) => ({ ...current, profilePicture: reader.result }))
      setNotice('')
      setIsError(false)
    }
    reader.readAsDataURL(file)
  }

  async function fillAddressFromLocation() {
    if (!navigator.geolocation) {
      setLocationNotice('Your browser does not support location detection.')
      setLocationError(true)
      return
    }
    setIsLocating(true)
    setLocationNotice('')
    setLocationError(false)
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }))
      const place = await getAddressFromCoordinates(position.coords.latitude, position.coords.longitude)
      const address = [place.city, place.state, place.postalCode, place.country].filter(Boolean).join(', ')
      if (!address) throw new Error('No address details found for this location.')
      setProfile((current) => ({ ...current, address }))
      setLocationNotice('Location detected. Review the address and save your profile.')
    } catch (error) {
      setLocationNotice(error.code === 1 ? 'Location permission denied. Please allow location access.' : error.code === 2 ? 'Your current location is unavailable.' : error.code === 3 ? 'Location request timed out. Please try again.' : error.message || 'Unable to detect your address.')
      setLocationError(true)
    } finally { setIsLocating(false) }
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (phoneError) {
      document.getElementById('admin-profile-phone')?.focus()
      return
    }
    setIsSaving(true)
    setNotice('')
    setIsError(false)
    try {
      const { profile: saved } = await updateAdminProfile({
        name: profile.name, email: profile.email, phone: profile.phone ? `${countryCode}${profile.phone}` : '',
        address: profile.address, company: profile.company, jobTitle: profile.jobTitle,
        bio: profile.bio, profilePicture: profile.profilePicture,
      })
      const phone = splitPhone(saved.phone)
      setCountryCode(phone.code)
      setProfile({ name: saved.name || '', email: saved.email || '', phone: phone.number, address: saved.address || '', company: saved.company || '', jobTitle: saved.jobTitle || '', bio: saved.bio || '', profilePicture: saved.profilePicture || '' })
      setNotice('Admin profile saved.')
    } catch (error) {
      setNotice(error.message || 'Could not save admin profile.')
      setIsError(true)
    } finally { setIsSaving(false) }
  }

  const selectedCountry = COUNTRY_CODES.find(({ code }) => code === countryCode) || COUNTRY_CODES[0]
  const phoneError = /\D/.test(profile.phone) ? 'Enter digits only.' : profile.phone.length > selectedCountry.digits ? `${selectedCountry.country} phone numbers can have up to ${selectedCountry.digits} digits.` : ''
  const completionItems = [profile.name, profile.email, profile.phone, profile.address, profile.company, profile.jobTitle, profile.bio, profile.profilePicture]
  const completion = Math.round(completionItems.filter((item) => String(item || '').trim()).length / completionItems.length * 100)
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <main className="admin-layout admin-profile-page">
      <AdminSidebar active="profile" />
      <section className="admin-main-panel">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">Administration <span>/</span> Admin profile</div>
          <div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<AccountBadge variant="admin" /></div>
        </header>
        <div className="admin-content admin-profile-content">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">ACCOUNT SETTINGS</p><h1>Admin profile</h1><p>Keep your administrator details up to date.</p></div>
          </div>
          <section className="profile-hero admin-profile-hero" aria-label="Admin profile overview">
            <div className="profile-hero-avatar">{profile.profilePicture ? <img src={profile.profilePicture} alt="" /> : <span>{initials || 'A'}</span>}</div>
            <div className="profile-hero-copy">
              <p className="profile-hero-kicker">ADMIN ACCOUNT</p>
              <h2>{profile.name || (isLoading ? 'Loading your profile…' : 'Welcome, Administrator')}</h2>
              <p>{profile.email || 'Add your email and details to personalize your account.'}</p>
              <div className="profile-progress-track" role="progressbar" aria-label="Profile completeness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completion}><span style={{ width: `${completion}%` }} /></div>
              <small>{completion === 100 ? 'Profile complete' : `${completion}% complete · Add details to finish your profile`}</small>
            </div>
            <div className="profile-completion-stat"><strong>{completion}<span>%</span></strong><small>complete</small></div>
          </section>

          <section className="profile-section photo-section admin-profile-section" aria-labelledby="admin-profile-photo-heading">
            <div className="profile-section-heading"><h2 id="admin-profile-photo-heading">Profile photo</h2><p>Choose a clear photo so you can recognize your admin account.</p></div>
            <div className="photo-controls">
              {profile.profilePicture ? <button type="button" className="profile-avatar profile-avatar-clickable" onClick={() => setPreviewOpen(true)} aria-label="View profile photo"><img src={profile.profilePicture} alt="Admin profile" /></button> : <div className="profile-avatar"><span>{initials || 'A'}</span></div>}
              <div className="photo-actions">
                <label className="upload-photo-button" htmlFor="admin-profile-photo">Upload photo<input id="admin-profile-photo" type="file" accept="image/*" onChange={handlePhotoChange} /></label>
                {profile.profilePicture && <button className="remove-photo-button" type="button" onClick={() => setProfile((current) => ({ ...current, profilePicture: '' }))}>Remove photo</button>}
                <span className="photo-hint">JPG, PNG or GIF. 3 MB max.</span>
              </div>
            </div>
          </section>

          <form className="profile-section profile-form admin-profile-form" onSubmit={saveProfile}>
            <div className="profile-section-heading"><h2>Personal information</h2><p>Your administrator name and contact details.</p></div>
            <div className="profile-fields">
              <label className="profile-field" htmlFor="admin-profile-name">Full name<input id="admin-profile-name" name="name" autoComplete="name" placeholder="Your full name" value={profile.name} onChange={updateField} required maxLength="100" /></label>
              <label className="profile-field" htmlFor="admin-profile-email">Email address<input id="admin-profile-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={profile.email} onChange={updateField} required /></label>
              <div className="profile-field profile-phone-field"><label htmlFor="admin-profile-phone">Phone number</label><div className="profile-phone-input-row"><select aria-label="Country calling code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>{COUNTRY_CODES.map(({ code, country }) => <option key={code} value={code}>{country} ({code})</option>)}</select><input id="admin-profile-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern={`[0-9]{0,${selectedCountry.digits}}`} aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? 'admin-profile-phone-error' : undefined} placeholder={`Up to ${selectedCountry.digits} digits`} value={profile.phone} onChange={updateField} /></div>{phoneError && <span id="admin-profile-phone-error" className="profile-phone-error" role="alert">{phoneError}</span>}</div>
              <div className="profile-field profile-address-field"><label htmlFor="admin-profile-address">Address</label><input id="admin-profile-address" name="address" autoComplete="street-address" maxLength="240" placeholder="Enter your address or use current location" value={profile.address} onChange={updateField} /><div className="address-location-actions"><button className="profile-download" type="button" onClick={fillAddressFromLocation} disabled={isLocating || isLoading}>{isLocating ? 'Finding location…' : '📍 Use current location'}</button><span className="address-hint" aria-live="polite" role={locationError ? 'alert' : 'status'}>{locationNotice || 'Use your current location to autofill your address.'}</span></div></div>
              <label className="profile-field" htmlFor="admin-profile-company">Company<input id="admin-profile-company" name="company" autoComplete="organization" placeholder="Company name" value={profile.company} onChange={updateField} maxLength="120" /></label>
              <label className="profile-field" htmlFor="admin-profile-job-title">Job title<input id="admin-profile-job-title" name="jobTitle" autoComplete="organization-title" placeholder="Your role" value={profile.jobTitle} onChange={updateField} maxLength="120" /></label>
              <label className="profile-field profile-bio-field" htmlFor="admin-profile-bio">About<textarea id="admin-profile-bio" name="bio" rows="4" maxLength="240" placeholder="A short introduction…" value={profile.bio} onChange={updateField} /><span className="bio-count">{profile.bio.length}/240</span></label>
            </div>
            <div className="profile-form-footer"><p className={`profile-notice${isError ? ' is-error' : ''}`} aria-live="polite">{notice}</p><button className="profile-save-button" type="submit" disabled={isLoading || isSaving || Boolean(phoneError)}>{isLoading ? 'Loading…' : isSaving ? 'Saving…' : 'Save changes'}</button></div>
          </form>
          <p className="profile-storage-note">Admin profile changes are saved to your administrator account.</p>
        </div>
      </section>
      {previewOpen && profile.profilePicture && <div className="profile-photo-modal" onClick={() => setPreviewOpen(false)}><div className="profile-photo-modal-content" role="dialog" aria-modal="true" aria-label="Admin profile photo preview" onClick={(event) => event.stopPropagation()}><button type="button" className="profile-photo-modal-close" onClick={() => setPreviewOpen(false)} aria-label="Close photo preview">&times;</button><img src={profile.profilePicture} alt="Full-size admin profile" className="profile-photo-full" /></div></div>}
    </main>
  )
}

export default AdminProfile
