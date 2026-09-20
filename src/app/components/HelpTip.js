'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

const GUTTER = 8

// A help note attached to a label or figure.
//
// Opens on click rather than hover, because the people using this open it on a
// phone: there is no hover on touch, so a `title` attribute or a :hover popover
// is invisible to the primary user. Click works for both, and the same control
// is reachable by keyboard.
export default function HelpTip({ text, label = 'What this means' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const bubbleEl = useRef(null)
  const id = useId()

  // The bubble is positioned in script rather than by CSS alone. Anchoring it to
  // the trigger with `right: 0` sends it off the left edge whenever the trigger
  // sits near the left of a narrow screen — measured at x=-5.5px on a 390px
  // viewport and -16.6px at 320px. Only measuring both boxes can keep it inside.
  const place = useCallback((node) => {
    const el = node || bubbleEl.current
    const trigger = wrapRef.current?.getBoundingClientRect()
    if (!el || !trigger) return
    const bubble = el.getBoundingClientRect()

    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight

    // Prefer the bubble's right edge against the trigger's, then clamp into the
    // viewport so it can never hang off either side.
    let left = trigger.right - bubble.width
    left = Math.min(Math.max(left, GUTTER), Math.max(GUTTER, vw - bubble.width - GUTTER))

    // Below the trigger, unless that would run off the bottom and there is more
    // room above.
    let top = trigger.bottom + 6
    if (top + bubble.height > vh - GUTTER && trigger.top - bubble.height - 6 > GUTTER) {
      top = trigger.top - bubble.height - 6
    }

    setPos({ left, top })
  }, [])

  // Measured from a ref callback rather than an effect: the node is attached and
  // laid out by the time this runs, and it keeps the measurement out of an
  // effect that would only be setting state anyway.
  const attachBubble = useCallback((node) => {
    bubbleEl.current = node
    if (node) place(node)
  }, [place])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !bubbleEl.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // The bubble is fixed to the viewport, so it has to follow the trigger when
    // the page moves. Closing on scroll instead would make a tip near the bottom
    // of the screen impossible to read: tapping it scrolls it into view, and
    // that same scroll would dismiss it.
    const replace = () => place()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', replace, true)
    window.addEventListener('resize', replace)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', replace, true)
      window.removeEventListener('resize', replace)
    }
  }, [open, place])

  const toggle = () => {
    setPos(null)
    setOpen((v) => !v)
  }

  return (
    <span className="helptip" ref={wrapRef}>
      <button
        type="button"
        className="helptip-trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
      >
        <HelpCircle size={15} />
      </button>
      {open && (
        <span
          className="helptip-bubble"
          id={id}
          role="tooltip"
          ref={attachBubble}
          // Hidden for the first paint only, while it is measured at its natural
          // position — otherwise it visibly jumps into place.
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
