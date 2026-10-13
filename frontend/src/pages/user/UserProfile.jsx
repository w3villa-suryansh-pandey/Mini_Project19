import { useEffect, useState } from 'react'
import AccountBadge from '../../components/AccountBadge.jsx'
import Sidebar from '../../components/Sidebar.jsx'
import { getAddressFromCoordinates } from '../../services/location.service.js'
import {
	downloadUserProfile,
	getUserProfile,
	getUserSubscription,
	startFacebookLink,
	startGoogleLink,
	updateUserProfile,
} from '../../services/api.js'




const defaultProfile = {
	fullName: '',
	email: '',
	phone: '',
	address: '',
	company: '',
	jobTitle: '',
	bio: '',
	photo: '',
}

function UserProfile() {
	const [profile, setProfile] = useState(defaultProfile)
	const [notice, setNotice] = useState(() => {
		const params = new URLSearchParams(window.location.search)
		if (params.get('googleLinked') === 'true') return 'Google sign-in is connected to your account.'
		if (params.get('facebookLinked') === 'true') return 'Facebook sign-in is connected to your account.'
		return ''
	})
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [googleLinked, setGoogleLinked] = useState(false)
	const [facebookLinked, setFacebookLinked] = useState(false)
	const [subscription, setSubscription] = useState(null)
	const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true)
	const [subscriptionError, setSubscriptionError] = useState('')
	const [isLocating, setIsLocating] = useState(false)
	const [locationNotice, setLocationNotice] = useState('')
	const [isLocationError, setIsLocationError] = useState(false)
	const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false)

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		if (params.has('googleLinked') || params.has('facebookLinked')) {
			window.history.replaceState({}, '', window.location.pathname)
		}
		let isCurrent = true
		getUserProfile()
			.then(({ profile: savedProfile }) => {
				if (isCurrent) {
					setGoogleLinked(savedProfile.googleLinked)
					setFacebookLinked(savedProfile.facebookLinked)
					setProfile({
						fullName: savedProfile.name || '',
						email: savedProfile.email || '',
						phone: savedProfile.phone || '',
						address: savedProfile.address || '',
						company: savedProfile.company || '',
						jobTitle: savedProfile.jobTitle || '',
						bio: savedProfile.bio || '',
						photo: savedProfile.profilePicture || '',
					})
				}
			})
			.catch((error) => {
				if (isCurrent) setNotice(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	useEffect(() => {
		let isCurrent = true
		getUserSubscription()
			.then(({ subscription: currentSubscription }) => {
				if (isCurrent) setSubscription(currentSubscription)
			})
			.catch((error) => {
				if (isCurrent) setSubscriptionError(error.message)
			})
			.finally(() => {
				if (isCurrent) setIsSubscriptionLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	

	function updateField(event) {
		const { name, value } = event.target
		setProfile((currentProfile) => ({ ...currentProfile, [name]: value }))
		setNotice('')
		if (name === 'address') {
			setLocationNotice('')
			setIsLocationError(false)
		}
	}

    
async function fillAddressFromCurrentLocation() {
  if (!navigator.geolocation) {
    setLocationNotice('Your browser does not support location detection.')
    setIsLocationError(true)
    return
  }

  setIsLocating(true)
  setLocationNotice('')
  setIsLocationError(false)

  try {
    // Step 1: Detect browser location
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })

    const { latitude, longitude } = position.coords

    // Step 2: Convert coordinates into address
    const addressData = await getAddressFromCoordinates(
      latitude,
      longitude
    )

    // Step 3: Build address string
    const address = [
      addressData.city,
      addressData.state,
      addressData.postalCode,
      addressData.country,
    ]
      .filter(Boolean)
      .join(', ')

    if (!address) {
      throw new Error('No address details found for this location.')
    }

    // Step 4: Autofill existing address field
    setProfile((currentProfile) => ({
      ...currentProfile,
      address,
    }))

    setLocationNotice(
      'Location detected. Review your address and save your profile.'
    )

    setIsLocationError(false)

  } catch (error) {
    if (error.code === 1) {
      setLocationNotice(
        'Location permission denied. Please allow location access.'
      )
    } else if (error.code === 2) {
      setLocationNotice(
        'Your current location is unavailable.'
      )
    } else if (error.code === 3) {
      setLocationNotice(
        'Location request timed out. Please try again.'
      )
    } else {
      setLocationNotice(
        error.message || 'Unable to detect your address.'
      )
    }

    setIsLocationError(true)

  } finally {
    setIsLocating(false)
  }
}


	function handlePhotoChange(event) {
		const file = event.target.files?.[0]
		if (!file) return

		if (!file.type.startsWith('image/')) {
			setNotice('Choose an image file to update your photo.')
			event.target.value = ''
			return
		}

		if (file.size > 3 * 1024 * 1024) {
			setNotice('Choose an image smaller than 3 MB.')
			event.target.value = ''
			return
		}

		const reader = new FileReader()
		reader.onload = () => {
			setProfile((currentProfile) => ({ ...currentProfile, photo: reader.result }))
			setNotice('')
		}
		reader.readAsDataURL(file)
	}

	async function saveProfile(event) {
		event.preventDefault()
		setIsSaving(true)
		try {
			const { profile: savedProfile } = await updateUserProfile({
				name: profile.fullName,
				email: profile.email,
				phone: profile.phone,
				address: profile.address,
				company: profile.company,
				jobTitle: profile.jobTitle,
				bio: profile.bio,
				profilePicture: profile.photo,
			})
			setProfile({
				fullName: savedProfile.name,
				email: savedProfile.email,
				phone: savedProfile.phone,
				address: savedProfile.address || '',
				company: savedProfile.company,
				jobTitle: savedProfile.jobTitle,
				bio: savedProfile.bio,
				photo: savedProfile.profilePicture,
			})
			setGoogleLinked(savedProfile.googleLinked)
			setFacebookLinked(savedProfile.facebookLinked)
			setNotice('Profile saved to your account.')
		} catch (error) {
			setNotice(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	async function downloadProfile() {
		try {
			const profileFile = await downloadUserProfile()
			const downloadUrl = URL.createObjectURL(profileFile)
			const downloadLink = document.createElement('a')
			downloadLink.href = downloadUrl
			downloadLink.download = 's19-profile.pdf'
			downloadLink.click()
			setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
		} catch (error) {
			setNotice(error.message)
		}
	}

	function removePhoto() {
		setProfile((currentProfile) => ({ ...currentProfile, photo: '' }))
		setNotice('')
	}

	const initials = profile.fullName
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0))
		.join('')
		.toUpperCase()

	return (
		<div className="dashboard-layout profile-layout">
			<Sidebar active="profile" />
			<main className="profile-page">
			<header className="profile-topbar">
				<div className="profile-breadcrumb">Workspace <span>/</span> My profile</div>
				<div className="profile-topbar-actions">
					<AccountBadge user={{ name: profile.fullName, email: profile.email }} />
					<a className="profile-back-link" href="/dashboard">Back to overview <span aria-hidden="true">↗</span></a>
				</div>
			</header>

			<div className="profile-main">
				<div className="profile-page-heading">
					<div>
						<p className="profile-eyebrow">ACCOUNT SETTINGS</p>
						<h1>Your profile</h1>
						<p>Keep your personal details up to date.</p>
					</div>
					<button className="profile-download" type="button" onClick={downloadProfile} disabled={isLoading}>
						<svg viewBox="0 0 20 20" aria-hidden="true">
							<path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13.5v3h13v-3" />
						</svg>
						Download profile
					</button>
				</div>

				<section className="profile-section workspace-notice subscription-profile-notice" aria-labelledby="profile-subscription-heading">
					<span className="subscription-active-mark" aria-hidden="true">{subscription?.active ? '✓' : '₹'}</span>
					<div>
						<h2 id="profile-subscription-heading">Subscription</h2>
						{isSubscriptionLoading
							? <p>Loading subscription status…</p>
							: subscriptionError
								? <p role="alert">{subscriptionError}</p>
								: subscription?.active
									? <p>{subscription.planName || subscription.planId} · Active until {new Date(subscription.expiresAt).toLocaleString()}</p>
									: <p>No active subscription.</p>}
					</div>
					{!isSubscriptionLoading && !subscriptionError && !subscription?.active && (
						<a href="/pricing">View plans <span aria-hidden="true">→</span></a>
					)}
				</section>

				<section className="profile-section google-link-section" aria-labelledby="google-link-heading">
					<div className="profile-section-heading">
						<h2 id="google-link-heading">Google sign-in</h2>
						<p>{googleLinked ? 'A Google account is connected to your profile.' : 'Connect Google to sign in to this existing account with Google.'}</p>
					</div>
					{googleLinked
						? <span className="google-linked-status">Connected</span>
						: <button className="profile-download" type="button" onClick={startGoogleLink} disabled={isLoading}>Connect Google</button>}
				</section>

				<section className="profile-section google-link-section" aria-labelledby="facebook-link-heading">
					<div className="profile-section-heading">
						<h2 id="facebook-link-heading">Facebook sign-in</h2>
						<p>{facebookLinked ? 'A Facebook account is connected to your profile.' : 'Connect Facebook to sign in to this existing account with Facebook.'}</p>
					</div>
					{facebookLinked
						? <span className="google-linked-status">Connected</span>
						: <button className="profile-download" type="button" onClick={startFacebookLink} disabled={isLoading}>Connect Facebook</button>}
				</section>

				<section className="profile-section photo-section" aria-labelledby="photo-heading">
					<div className="profile-section-heading">
						<h2 id="photo-heading">Profile photo</h2>
						<p>Choose a clear photo so people can recognize you.</p>
					</div>
					<div className="photo-controls">							
                            {profile.photo ? (
                               <button
                                  type="button"
                                  className="profile-avatar profile-avatar-clickable"
                                  onClick={() => setIsPhotoPreviewOpen(true)}
                                  title="Click to view profile photo"
                                  aria-label="View profile photo"
                                   >
                                  <img src={profile.photo} alt="Profile" />
                               </button>
                            ) : (
                            <div className="profile-avatar" aria-label="No profile photo selected">
                                  <span>{initials || 'W'}</span>
                            </div>
                        )}

						</div>
						<div className="photo-actions">
							<label className="upload-photo-button" htmlFor="profile-photo">
								<svg viewBox="0 0 20 20" aria-hidden="true">
									<path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M3.5 12.5v4h13v-4" />
								</svg>
								Upload photo
								<input
									id="profile-photo"
									type="file"
									accept="image/*"
									onChange={handlePhotoChange}
								/>
							</label>
							{profile.photo && (
								<button className="remove-photo-button" type="button" onClick={removePhoto}>
									Remove photo
								</button>
							)}
							<span className="photo-hint">JPG, PNG or GIF. 3 MB max.</span>
						</div>
					</div>
				</section>

				<form className="profile-section profile-form" onSubmit={saveProfile}>
					<div className="profile-section-heading">
						<h2>Personal information</h2>
						<p>Your name and contact details.</p>
					</div>
					<div className="profile-fields">
						<label className="profile-field" htmlFor="profile-name">
							Full name
							<input
								id="profile-name"
								name="fullName"
								type="text"
								autoComplete="name"
								placeholder="Your full name"
								value={profile.fullName}
								onChange={updateField}
								required
							/>
						</label>
						<label className="profile-field" htmlFor="profile-email">
							Email address
							<input
								id="profile-email"
								name="email"
								type="email"
								autoComplete="email"
								placeholder="you@example.com"
								value={profile.email}
								onChange={updateField}
								required
							/>
						</label>
						<label className="profile-field" htmlFor="profile-phone">
							Phone number
							<input
								id="profile-phone"
								name="phone"
								type="tel"
								autoComplete="tel"
								placeholder="+1 (555) 000-0000"
								value={profile.phone}
								onChange={updateField}
							/>
						</label>
						
                    <div className="profile-field profile-address-field">
                        <label htmlFor="profile-address">Address</label>

                            <input
                               id="profile-address"
                               name="address"
                               type="text"
                               autoComplete="street-address"
                               maxLength="240"
                               placeholder="Enter your address or use current location"
                               value={profile.address}
                               onChange={updateField}
                             />

                        <div className="address-location-actions">
                           <button
                               className="profile-download"
                               type="button"
                               onClick={fillAddressFromCurrentLocation}
                               disabled={isLocating || isLoading}
                              >
                               {isLocating
                                ? 'Finding location…'
                                       : '📍 Use current location'}
                            </button>

                            <span
                               className="address-hint"
                               aria-live="polite"
                               role={isLocationError ? 'alert' : 'status'}
                             >
                               {locationNotice ||
                               'Use your current location to autofill your address.'}
                            </span>
                        </div>
                    </div>

						
						<label className="profile-field" htmlFor="profile-company">
							Company
							<input
								id="profile-company"
								name="company"
								type="text"
								autoComplete="organization"
								placeholder="Company name"
								value={profile.company}
								onChange={updateField}
							/>
						</label>
						<label className="profile-field" htmlFor="profile-title">
							Job title
							<input
								id="profile-title"
								name="jobTitle"
								type="text"
								autoComplete="organization-title"
								placeholder="Your role"
								value={profile.jobTitle}
								onChange={updateField}
							/>
						</label>
						<label className="profile-field profile-bio-field" htmlFor="profile-bio">
							About
							<textarea
								id="profile-bio"
								name="bio"
								rows="4"
								maxLength="240"
								placeholder="A short introduction..."
								value={profile.bio}
								onChange={updateField}
							/>
							<span className="bio-count">{profile.bio.length}/240</span>
						</label>
					</div>
					<div className="profile-form-footer">
						<p className="profile-notice" aria-live="polite">{notice}</p>
						<button className="profile-save-button" type="submit" disabled={isLoading || isSaving}>{isLoading ? 'Loading…' : isSaving ? 'Saving…' : 'Save changes'}</button>
					</div>
				</form>

				<p className="profile-storage-note">Profile changes are saved to your account.</p>

{isPhotoPreviewOpen && profile.photo && (
  <div
    className="profile-photo-modal"
    onClick={() => setIsPhotoPreviewOpen(false)}
  >
    <div
      className="profile-photo-modal-content"
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo preview"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="profile-photo-modal-close"
        onClick={() => setIsPhotoPreviewOpen(false)}
        aria-label="Close photo preview"
      >
        &times;
      </button>

      <img
        src={profile.photo}
        alt="Full-size profile"
        className="profile-photo-full"
      />
    </div>
  </div>
)}

			</div>
			</main>
		</div>
	)
}

export default UserProfile

