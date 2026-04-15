import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function MyListingsPage({ currentUser, onRequireSignIn, listings, onCreateListing, onDeleteListing }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Rental')
  const [category, setCategory] = useState('Tool Rental')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const fileInputRef = useRef(null)

  if (!currentUser) {
    return (
      <section className="page-section">
        <div className="empty-state">
          <h1>Sign in to view your listings</h1>
          <p>A temporary local account is enough to access your My Listings dashboard.</p>
          <div className="detail-actions">
            <button type="button" className="auth-button auth-button-primary" onClick={onRequireSignIn}>
              Sign in
            </button>
            <Link className="text-link" to="/listings">
              Browse all listings
            </Link>
          </div>
        </div>
      </section>
    )
  }

  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const created = await onCreateListing({
      title: title.trim(),
      type,
      category,
      price: price.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      imageFile,
    })

    if (!created) {
      return
    }

    setTitle('')
    setType('Rental')
    setCategory('Tool Rental')
    setPrice('')
    setDescription('')
    setImageUrl('')
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <h1>My Listings</h1>
        <p>Manage items posted by your temporary account.</p>
      </div>

      <form className="manage-form" onSubmit={handleSubmit}>
        <h2>Add a listing</h2>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option>Rental</option>
            <option>Small Job</option>
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Tool Rental</option>
            <option>Event Rental</option>
            <option>Vehicle Rental</option>
            <option>Home Equipment</option>
            <option>Home Services</option>
            <option>Handyman Help</option>
          </select>
        </label>
        <label>
          Price
          <input
            placeholder="$25/day"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
        </label>
        <p className="form-helper-text">Distance is calculated automatically from your location.</p>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <label>
          Image URL (optional)
          <input
            type="url"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        </label>
        <label>
          Or upload image (optional)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" className="auth-button auth-button-primary">
          Add listing
        </button>
      </form>

      {myListings.length === 0 ? (
        <div className="empty-state">
          <h2>No listings yet</h2>
          <p>You are signed in, but no listings are attached to this account yet.</p>
          <Link className="text-link" to="/listings">
            Explore nearby listings
          </Link>
        </div>
      ) : (
        <div className="listings-grid">
          {myListings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              {listing.imageUrl && (
                <img src={listing.imageUrl} alt={listing.title} className="listing-image" />
              )}
              <span className="listing-type-tag">{listing.type}</span>
              <span className="listing-tag">{listing.category}</span>
              <h2>{listing.title}</h2>
              <p>{listing.description}</p>
              <div className="listing-meta">
                <strong>{listing.price}</strong>
                <span>{listing.distance}</span>
              </div>
              <div className="card-actions">
                <Link className="text-link" to={`/listings/${listing.id}`}>
                  View details
                </Link>
                <button
                  type="button"
                  className="auth-button auth-button-secondary auth-button-danger"
                  onClick={() => onDeleteListing(listing.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default MyListingsPage
