'use client'

import { Search, X } from 'lucide-react'

// Filter-as-you-type over a list that is already loaded.
//
// Earns its place by measurement: 600 machines render a page 101,700px tall —
// about 240 phone screens — with no way to reach a specific unit. Filtering
// client-side is instant because the rows are already here, and it keeps every
// existing filter working alongside it.
export default function ListSearch({ value, onChange, placeholder, showing, total }) {
  const filtering = value.trim().length > 0
  return (
    <div className="list-search-wrap">
      <div className="list-search">
        <Search size={16} className="list-search-icon" aria-hidden="true" />
        <input
          className="input list-search-input"
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={placeholder}
        />
        {filtering && (
          <button
            type="button"
            className="list-search-clear"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>
      {/* A count, always — otherwise "nothing here" is ambiguous between an
          empty list and a search that matched nothing. */}
      <p className="list-search-count" role="status">
        {filtering ? `${showing} of ${total}` : `${total} total`}
      </p>
    </div>
  )
}
