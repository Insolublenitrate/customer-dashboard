'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

// Renders only the rows near the viewport.
//
// Measured before this existed: 600 machines built 6,200 DOM nodes and a page
// 101,700px tall. Paging keeps the wire small, but a list someone keeps loading
// into still grows without bound, so the DOM needs its own ceiling.
//
// useWindowVirtualizer, not useVirtualizer: these lists scroll the page itself.
// An inner scroll container would break the radial nav's reach and put a second
// scrollbar on a phone.
//
// `columns` drives the grid case. The card grid is
// `repeat(auto-fit, minmax(200px, 1fr))`, so the column count depends on the
// container width and has to be measured rather than assumed.
export default function VirtualList({
  items,
  renderItem,
  estimateHeight = 160,
  gap = 16,
  minColumnWidth = null,   // set for a card grid; null renders one per row
  overscan = 6,
  getKey,
}) {
  const parentRef = useRef(null)
  const [columns, setColumns] = useState(1)
  const [ready, setReady] = useState(false)
  // Held in state, not read from the ref during render: the list sits below the
  // page header and filters, and the virtualizer needs that offset to know
  // where row 0 actually starts.
  const [scrollMargin, setScrollMargin] = useState(0)

  // Column count comes from the real element width, kept in step with resizes
  // and orientation changes.
  useLayoutEffect(() => {
    const el = parentRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      if (!width) return
      const next = minColumnWidth
        ? Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
        : 1
      setColumns((prev) => (prev === next ? prev : next))
      const top = el.offsetTop
      setScrollMargin((prev) => (prev === top ? prev : top))
      setReady(true)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [minColumnWidth, gap])

  const rowCount = Math.ceil(items.length / columns)

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => estimateHeight,
    overscan,
    gap,
    scrollMargin,
  })

  // Row heights vary with content, so re-measure when the item count or the
  // column count changes rather than trusting the estimate.
  useEffect(() => {
    virtualizer.measure()
  }, [columns, items.length, scrollMargin, virtualizer])

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {ready && virtualRows.map((row) => {
          const start = row.index * columns
          const rowItems = items.slice(start, start + columns)
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start - scrollMargin}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap,
              }}
            >
              {rowItems.map((item, i) => (
                <div key={getKey ? getKey(item) : start + i} style={{ minWidth: 0 }}>
                  {renderItem(item)}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
