'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from './apiFetch.js'

const DEBOUNCE_MS = 250

// Fetches one page at a time and accumulates, with the search term sent to the
// server rather than applied to whatever happens to be loaded — filtering a
// single page would silently hide matches sitting on page two.
export function usePagedList({ url, key, pageSize = 50, filters = {} }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  // Every request carries a sequence number and only the newest one is allowed
  // to write state. Without this a slow request for "SN" can land after a fast
  // one for "SN-42" and put the wrong rows on screen — the classic
  // search-as-you-type race.
  const seq = useRef(0)

  // Serialised so the effect below re-runs when a filter value changes, not on
  // every render because the object identity is new.
  const filterKey = JSON.stringify(filters)

  // Deliberately not an async function. The effect below calls this directly,
  // and an async body would set the loading flag synchronously inside the
  // effect; every state change here happens in the chain instead, which is the
  // shape the rest of this codebase uses.
  const fetchPage = useCallback((offset, { append }) => {
    const mine = ++seq.current

    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    for (const [k, v] of Object.entries(JSON.parse(filterKey))) {
      if (v !== '' && v !== null && v !== undefined) params.set(k, String(v))
    }
    if (debounced) params.set('q', debounced)

    return Promise.resolve()
      .then(() => {
        if (append) setLoadingMore(true)
        else setLoading(true)
      })
      .then(() => apiFetch(`${url}?${params}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (mine !== seq.current) return      // a newer request already answered
        const rows = data[key] || data.items || []
        setItems((prev) => (append ? [...prev, ...rows] : rows))
        setTotal(Number(data.total ?? rows.length))
        setHasMore(Boolean(data.has_more))
        setError('')
      })
      .catch((err) => {
        if (mine !== seq.current) return
        console.error(`Failed to load ${key}:`, err)
        setError('Could not load this list.')
      })
      .finally(() => {
        if (mine !== seq.current) return
        setLoading(false)
        setLoadingMore(false)
      })
  }, [url, key, pageSize, filterKey, debounced])

  // Typing pauses before the request goes out; one keystroke is not one query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // A new search or filter starts a new list rather than appending to the old.
  useEffect(() => {
    fetchPage(0, { append: false })
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchPage(items.length, { append: true })
  }, [fetchPage, items.length, hasMore, loadingMore])

  const reload = useCallback(() => fetchPage(0, { append: false }), [fetchPage])

  return {
    items, total, hasMore, loading, loadingMore, error,
    query, setQuery, loadMore, reload,
    // True while a search term is typed but its request has not gone out yet,
    // so the count can avoid flashing a stale "50 of 600".
    pending: query.trim() !== debounced,
  }
}
