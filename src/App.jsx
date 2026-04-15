import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import logoImg from './assets/logo.png'
import { listings as initialListings } from './data/listings'
import { getCurrentBrowserLocation } from './lib/location'
import { supabase } from './lib/supabase'
import HomePage from './pages/HomePage'
import ListingDetailPage from './pages/ListingDetailPage'
import ListingsPage from './pages/ListingsPage'
import MyListingsPage from './pages/MyListingsPage'
import './App.css'

const parsePriceInput = (rawPrice) => {
  const cleaned = String(rawPrice || '').trim().replace(/\$/g, '')
  const [amountPart, unitPart] = cleaned.split('/')
  const amount = Number.parseFloat((amountPart || '').replace(/,/g, ''))

  return {
    priceAmount: Number.isFinite(amount) ? amount : 0,
    priceUnit: (unitPart || 'day').trim().toLowerCase(),
  }
}

const formatPrice = (amount, unit) => {
  if (!Number.isFinite(Number(amount))) {
    return '$0/day'
  }

  const safeAmount = Number(amount)
  const whole = Number.isInteger(safeAmount)
  const amountText = whole ? String(safeAmount) : safeAmount.toFixed(2)
  const safeUnit = String(unit || 'day').trim().toLowerCase()
  return `$${amountText}/${safeUnit}`
}

const parseCoordinate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const LEGACY_DISTANCE_SCHEMA_MESSAGE =
  'Distance unavailable (run latest schema.sql to enable location sorting)'

const mapOfferRowToListing = (row) => ({
  id: String(row.id),
  title: row.title || 'Untitled listing',
  type: row.offer_type || 'Rental',
  category: row.category || 'General',
  ownerId: row.owner_user_id || '',
  ownerName: row.owner_name || 'Neighbor',
  price: formatPrice(row.price_amount, row.price_unit),
  distance:
    row.distance_text && row.distance_text !== LEGACY_DISTANCE_SCHEMA_MESSAGE
      ? row.distance_text
      : 'Distance unavailable',
  latitude: parseCoordinate(row.location_lat),
  longitude: parseCoordinate(row.location_lng),
  description: row.description || '',
  imageUrl: row.image_url || '',
})

function App() {
  const [activeModal, setActiveModal] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [signUpName, setSignUpName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [allListings, setAllListings] = useState(initialListings)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const navigate = useNavigate()

  const openSignIn = () => setActiveModal('signin')
  const openSignUp = () => setActiveModal('signup')
  const closeModal = () => setActiveModal(null)

  const handleSearchSubmit = (event) => {
    event.preventDefault()

    const query = searchInput.trim()
    if (query) {
      navigate(`/listings?q=${encodeURIComponent(query)}`)
    } else {
      navigate('/listings')
    }
  }

  const syncUserProfile = useCallback(async (authUser, fallbackName) => {
    if (!authUser) {
      setCurrentUser(null)
      return
    }

    const metadataName = String(authUser.user_metadata?.display_name || '').trim()
    const effectiveName = fallbackName || metadataName || authUser.email?.split('@')[0] || 'Neighbor'

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUser.id,
          display_name: effectiveName,
        },
        { onConflict: 'id' },
      )
      .select('display_name, bio, profile_photo_url')
      .single()

    if (profileError) {
      setStatusMessage('Signed in, but profile setup failed. Check table and RLS in supabase/schema.sql.')
    }

    setCurrentUser({
      id: authUser.id,
      name: profileRow?.display_name || effectiveName,
      email: authUser.email || '',
      bio: profileRow?.bio || '',
      profilePhotoUrl: profileRow?.profile_photo_url || '',
    })
  }, [])

  const loadOffers = useCallback(async () => {
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: false })

    if (error) {
      setStatusMessage('Could not load offers from Supabase. Run supabase/schema.sql and verify RLS policies.')
      setAllListings(initialListings)
      return
    }

    setAllListings(data.map(mapOfferRowToListing))
  }, [])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setStatusMessage('Failed to load auth session from Supabase.')
      }

      if (!active) {
        return
      }

      await syncUserProfile(sessionData.session?.user || null)
      await loadOffers()

      if (active) {
        setIsBootstrapping(false)
      }
    }

    bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return
      }

      // Keep auth callback non-blocking so Supabase's internal lock can release quickly.
      void syncUserProfile(session?.user || null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadOffers, syncUserProfile])

  const handleSignInSubmit = async (event) => {
    event.preventDefault()
    const email = signInEmail.trim().toLowerCase()
    const password = signInPassword

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = String(error.message || '')

      if (/invalid\s+login\s+credentials/i.test(message)) {
        setStatusMessage('Email or password is incorrect. If this is a new email, create an account first.')
        return
      }

      if (/email\s+not\s+confirmed/i.test(message)) {
        setStatusMessage('Email not confirmed yet. Check your inbox and confirm your account before signing in.')
        return
      }

      setStatusMessage(message || 'Sign in failed.')
      return
    }

    const signedInName = data.user.email?.split('@')[0] || 'Neighbor'
    await syncUserProfile(data.user)
    await loadOffers()
    setStatusMessage(`Signed in as ${signedInName}.`)
    setSignInEmail('')
    setSignInPassword('')
    closeModal()
  }

  const handleSignUpSubmit = async (event) => {
    event.preventDefault()
    const name = signUpName.trim() || 'Neighbor'
    const email = signUpEmail.trim().toLowerCase()
    const password = signUpPassword

    if (password.length < 6) {
      setStatusMessage('Password must be at least 6 characters.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        },
      },
    })

    if (error) {
      const message = String(error.message || '')
      const duplicateUser =
        error.status === 422 && /already\s+registered|already\s+exists|registered/i.test(message)

      if (duplicateUser) {
        setStatusMessage(
          `That email is already registered (${email}). Use a different email to create another account, or switch to Sign in.`,
        )
        return
      }

      if (error.status === 422) {
        setStatusMessage(
          message
            ? `Sign up was rejected for ${email}: ${message}. Try a different email if you are creating another account.`
            : `Sign up was rejected for ${email}. Try a different email if you are creating another account.`,
        )
        return
      }

      setStatusMessage(message || 'Sign up failed.')
      return
    }

    if (data.user) {
      await syncUserProfile(data.user, name)
      await loadOffers()
    }

    if (data.session) {
      setStatusMessage(`Welcome ${name}. Your account is ready.`)
    } else {
      setStatusMessage('Sign up complete. Check your email for verification, then sign in.')
    }

    setSignUpName('')
    setSignUpEmail('')
    setSignUpPassword('')
    closeModal()
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setStatusMessage(error.message)
      return
    }

    setCurrentUser(null)
    setStatusMessage('Signed out.')
    navigate('/listings')
  }

  const handleCreateListing = async (listingInput) => {
    if (!currentUser) {
      setStatusMessage('Sign in to create a listing.')
      openSignIn()
      return false
    }

    let uploadedImageUrl = String(listingInput.imageUrl || '').trim()

    if (listingInput.imageFile) {
      const safeFileName = String(listingInput.imageFile.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-')
      const storagePath = `${currentUser.id}/${Date.now()}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(storagePath, listingInput.imageFile)

      if (uploadError) {
        setStatusMessage(`Image upload failed: ${uploadError.message}`)
        return false
      }

      const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(storagePath)
      uploadedImageUrl = urlData.publicUrl
    }

    const { priceAmount, priceUnit } = parsePriceInput(listingInput.price)

    let location = null
    try {
      location = await getCurrentBrowserLocation()
    } catch {
      // Creating a listing should still work when location permission is denied.
      location = null
    }

    const insertPayload = {
      owner_user_id: currentUser.id,
      owner_name: currentUser.name,
      offer_type: listingInput.type || 'Rental',
      title: listingInput.title,
      description: listingInput.description,
      category: listingInput.category,
      price_amount: priceAmount,
      price_unit: priceUnit,
      distance_text: location ? 'Distance calculated from your location' : 'Location unavailable',
      location_lat: location?.latitude ?? null,
      location_lng: location?.longitude ?? null,
      image_url: uploadedImageUrl,
      status: 'ACTIVE',
    }

    let { data: createdRow, error } = await supabase
      .from('offers')
      .insert(insertPayload)
      .select('*')
      .single()

    let usedLocationFallback = false
    if (error && /location_(lat|lng)|schema cache/i.test(String(error.message || ''))) {
      const fallbackPayload = {
        ...insertPayload,
        distance_text: 'Distance unavailable',
      }
      delete fallbackPayload.location_lat
      delete fallbackPayload.location_lng

      const fallbackInsert = await supabase.from('offers').insert(fallbackPayload).select('*').single()
      createdRow = fallbackInsert.data
      error = fallbackInsert.error

      if (!error) {
        usedLocationFallback = true
      }
    }

    if (error) {
      setStatusMessage(`Could not create listing: ${error.message}`)
      return false
    }

    setAllListings((prev) => [mapOfferRowToListing(createdRow), ...prev])
    setStatusMessage(
      usedLocationFallback
        ? 'Listing created. Run supabase/schema.sql to enable automatic nearest-distance sorting.'
        : 'Listing created.',
    )
    return true
  }

  const handleDeleteListing = async (listingId) => {
    if (!currentUser) {
      setStatusMessage('Sign in to manage listings.')
      openSignIn()
      return
    }

    const { error } = await supabase
      .from('offers')
      .delete()
      .eq('id', listingId)
      .eq('owner_user_id', currentUser.id)

    if (error) {
      setStatusMessage(`Could not delete listing: ${error.message}`)
      return
    }

    setAllListings((prev) => prev.filter((listing) => listing.id !== listingId))
    setStatusMessage('Listing deleted.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={logoImg} alt="Simply Neighbor" className="brand-logo" />
        </div>

        <div className="header-search-wrap">
          <form
            className="header-search"
            role="search"
            aria-label="Search listings"
            onSubmit={handleSearchSubmit}
          >
            <input
              type="search"
              placeholder="Search tools, vehicles, party gear, and more"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <Link className="auth-button auth-button-secondary" to="/listings">
            View all
          </Link>
        </div>

        <div className="auth-actions" aria-label="Authentication actions">
          {currentUser ? (
            <>
              <span className="signed-in-label">Hi, {currentUser.name}</span>
              <Link className="auth-button auth-button-secondary" to="/my-listings">
                My listings
              </Link>
              <button
                type="button"
                className="auth-button auth-button-primary"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="auth-button auth-button-secondary"
                onClick={openSignIn}
              >
                Sign in
              </button>
              <button
                type="button"
                className="auth-button auth-button-primary"
                onClick={openSignUp}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>

      {isBootstrapping && (
        <p className="status-banner" role="status">
          Connecting to Supabase...
        </p>
      )}

      {statusMessage && (
        <p className="status-banner" role="status">
          {statusMessage}
        </p>
      )}

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage listings={allListings} />} />
          <Route
            path="/listings/:listingId"
            element={
              <ListingDetailPage
                listings={allListings}
                currentUser={currentUser}
                onRequireSignIn={openSignIn}
              />
            }
          />
          <Route
            path="/my-listings"
            element={
              <MyListingsPage
                currentUser={currentUser}
                onRequireSignIn={openSignIn}
                listings={allListings}
                onCreateListing={handleCreateListing}
                onDeleteListing={handleDeleteListing}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {activeModal && (
        <div className="modal-overlay" onClick={closeModal} role="presentation">
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeModal === 'signin' ? 'Sign in' : 'Sign up'}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={closeModal}>
              Close
            </button>

            {statusMessage && (
              <p className="modal-status" role="status">
                {statusMessage}
              </p>
            )}

            {activeModal === 'signin' ? (
              <>
                <h2>Sign in</h2>
                <p>Welcome back. Sign in to manage your rentals and listings.</p>

                <form className="modal-form" onSubmit={handleSignInSubmit}>
                  <label>
                    Email
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={signInEmail}
                      onChange={(event) => setSignInEmail(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={signInPassword}
                      onChange={(event) => setSignInPassword(event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="auth-button auth-button-primary modal-submit">
                    Sign in
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2>Create account</h2>
                <p>Create your profile to rent, list items, and connect with neighbors.</p>

                <form className="modal-form" onSubmit={handleSignUpSubmit}>
                  <label>
                    Full name
                    <input
                      type="text"
                      placeholder="Your name"
                      value={signUpName}
                      onChange={(event) => setSignUpName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={signUpEmail}
                      onChange={(event) => setSignUpEmail(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      placeholder="Create password"
                      value={signUpPassword}
                      onChange={(event) => setSignUpPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                  </label>
                  <button type="submit" className="auth-button auth-button-primary modal-submit">
                    Create account
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default App
