import { Link, useParams } from 'react-router-dom'

function ListingDetailPage({ listings, currentUser, onRequireSignIn }) {
  const { listingId } = useParams()
  const listing = listings.find((item) => item.id === listingId)
  const isOwner = Boolean(currentUser && listing && listing.ownerId === currentUser.id)

  if (!listing) {
    return (
      <section className="page-section">
        <div className="empty-state">
          <h1>Listing not found</h1>
          <p>This listing may have been removed or the link is incorrect.</p>
          <Link className="text-link" to="/listings">
            Back to listings
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-section">
      <article className="detail-card">
        {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} className="detail-image" />}
        <span className="listing-type-tag">{listing.type || 'Rental'}</span>
        <span className="listing-tag">{listing.category}</span>
        <h1>{listing.title}</h1>
        <p>{listing.description}</p>
        <div className="detail-meta">
          <strong>{listing.price}</strong>
          <span>{listing.distance}</span>
        </div>
        <div className="detail-actions">
          {isOwner ? (
            <button type="button" className="auth-button auth-button-secondary" disabled>
              This is your listing
            </button>
          ) : (
            <button
              type="button"
              className="auth-button auth-button-primary"
              onClick={currentUser ? undefined : onRequireSignIn}
            >
              {currentUser
                ? listing.type === 'Small Job'
                  ? 'Request this job'
                  : 'Request to rent'
                : listing.type === 'Small Job'
                  ? 'Sign in to request job'
                  : 'Sign in to rent'}
            </button>
          )}
          <Link className="text-link" to="/listings">
            Back to listings
          </Link>
        </div>
      </article>
    </section>
  )
}

export default ListingDetailPage
