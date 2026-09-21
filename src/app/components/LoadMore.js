'use client'

// The foot of a paged list. Always says where you are, because a list that
// simply stops looks identical to a list that has ended.
export default function LoadMore({ hasMore, loading, onClick, showing, total }) {
  if (!hasMore) {
    return total > 0 ? (
      <p className="load-more-end" role="status">
        All {total.toLocaleString()} shown
      </p>
    ) : null
  }
  return (
    <div className="load-more">
      <button type="button" className="btn btn-secondary" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : `Load more (${showing.toLocaleString()} of ${total.toLocaleString()})`}
      </button>
    </div>
  )
}
