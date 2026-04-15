import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { distanceMilesBetween, formatMilesAway, getCurrentBrowserLocation } from '../lib/location'

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function ListingsPage({ listings }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [viewerLocation, setViewerLocation] = useState(null)

  useEffect(() => {
    let active = true

    const detectLocation = async () => {
      try {
        const coords = await getCurrentBrowserLocation()
        if (active) {
          setViewerLocation(coords)
        }
      } catch {
        if (active) {
          setViewerLocation(null)
        }
      }
    }

    detectLocation()

    return () => {
      active = false
    }
  }, [])

  const rawQuery = (searchParams.get('q') || '').trim()
  const query = normalizeText(rawQuery)
  const queryTokens = query ? query.split(' ').filter(Boolean) : []

  const typeOptions = ['all', ...new Set(listings.map((listing) => listing.type || 'Rental'))]
  const categoryOptions = ['all', ...new Set(listings.map((listing) => listing.category || 'Uncategorized'))]

  const selectedTypeRaw = searchParams.get('type') || 'all'
  const selectedCategoryRaw = searchParams.get('category') || 'all'

  const selectedType =
    selectedTypeRaw === 'all' || typeOptions.includes(selectedTypeRaw) ? selectedTypeRaw : 'all'
  const selectedCategory =
    selectedCategoryRaw === 'all' || categoryOptions.includes(selectedCategoryRaw)
      ? selectedCategoryRaw
      : 'all'

  const updateSearchParams = (updates) => {
    const next = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      const text = String(value || '').trim()
      if (!text || text === 'all') {
        next.delete(key)
      } else {
        next.set(key, text)
      }
    })

    const queryString = next.toString()
    navigate(queryString ? `/listings?${queryString}` : '/listings')
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const value = String(formData.get('q') || '').trim()
    updateSearchParams({ q: value })
    setSearchInput('')
  }

  const handleTypeChange = (event) => {
    updateSearchParams({ type: event.target.value })
  }

  const handleCategoryChange = (event) => {
    updateSearchParams({ category: event.target.value })
  }

  const handleViewAll = () => {
    setSearchInput('')
    navigate('/listings')
  }

  const filteredListings = listings.filter((listing) => {
    const listingType = listing.type || 'Rental'
    const listingCategory = listing.category || 'Uncategorized'

    if (selectedType !== 'all' && listingType !== selectedType) {
      return false
    }

    if (selectedCategory !== 'all' && listingCategory !== selectedCategory) {
      return false
    }

    if (queryTokens.length === 0) {
      return true
    }

    const searchableText = normalizeText(
      [
        listing.title,
        listing.type,
        listing.category,
        listing.description,
        listing.ownerName,
        listing.price,
        listing.distance,
      ].join(' '),
    )

    return queryTokens.every((token) => searchableText.includes(token))
  })

  const nearestFirstListings = useMemo(() => {
    if (!viewerLocation) {
      return filteredListings
    }

    return [...filteredListings].sort((a, b) => {
      const aMiles = distanceMilesBetween(viewerLocation, {
        latitude: a.latitude,
        longitude: a.longitude,
      })
      const bMiles = distanceMilesBetween(viewerLocation, {
        latitude: b.latitude,
        longitude: b.longitude,
      })

      const aHasDistance = Number.isFinite(aMiles)
      const bHasDistance = Number.isFinite(bMiles)

      if (aHasDistance && bHasDistance) {
        return aMiles - bMiles
      }

      if (aHasDistance) {
        return -1
      }

      if (bHasDistance) {
        return 1
      }

      return 0
    })
  }, [filteredListings, viewerLocation])

  return (
    <section className="page-section">
      <div className="page-heading">
        <h1>Browse Listings and Small Jobs</h1>
        <p>
          {query || selectedType !== 'all' || selectedCategory !== 'all'
            ? `Showing results for "${searchParams.get('q')}" in your area.`
            : 'Showing nearby rentals and small jobs in your area.'}
        </p>
      </div>

      <div className="listing-controls">
        <form className="listing-search-form" onSubmit={handleSearchSubmit}>
          <input
            key={searchParams.toString()}
            name="q"
            type="search"
            placeholder="Search listings"
            defaultValue={searchParams.get('q') || searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" className="auth-button auth-button-primary">
            Search
          </button>
        </form>
        <div className="listing-filter-row">
          <label className="listing-filter">
            Type
            <select value={selectedType} onChange={handleTypeChange}>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All types' : type}
                </option>
              ))}
            </select>
          </label>
          <label className="listing-filter">
            Category
            <select value={selectedCategory} onChange={handleCategoryChange}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" className="auth-button auth-button-secondary" onClick={handleViewAll}>
          Clear filters
        </button>
      </div>

      {nearestFirstListings.length === 0 ? (
        <div className="empty-state">
          <h2>No listings found</h2>
          <p>Try a different search or browse all nearby listings.</p>
          <Link className="text-link" to="/listings">
            View all listings
          </Link>
        </div>
      ) : (
        <div className="listings-grid">
          {nearestFirstListings.map((listing) => {
            const miles = viewerLocation
              ? distanceMilesBetween(viewerLocation, {
                  latitude: listing.latitude,
                  longitude: listing.longitude,
                })
              : null

            return (
              <article className="listing-card" key={listing.id}>
                {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} className="listing-image" />}
                <span className="listing-type-tag">{listing.type || 'Rental'}</span>
                <span className="listing-tag">{listing.category}</span>
                <h2>{listing.title}</h2>
                <p>{listing.description}</p>
                <div className="listing-meta">
                  <strong>{listing.price}</strong>
                  <span>{Number.isFinite(miles) ? formatMilesAway(miles) : listing.distance}</span>
                </div>
                <Link className="text-link" to={`/listings/${listing.id}`}>
                  View details
                </Link>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ListingsPage
