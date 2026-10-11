import { useEffect, useRef, useState } from 'react'
import type { Spot } from '../spot.ts'
import { SHARE, handOver, shareUrl } from './shareView.ts'
import type { Handed } from './shareView.ts'

interface ShareSpotProps {
  spot: Spot
}

/**
 * The line a spot is handed on from, as a link: the button, then what came
 * of the last tap. The link is to the address the page is on.
 */
export function ShareSpot({ spot }: ShareSpotProps) {
  const [handed, setHanded] = useState<Handed | null>(null)

  // A share sheet that closes after the screen is gone sets nothing.
  const gone = useRef(false)
  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
    }
  }, [])

  const url = shareUrl(spot, window.location.origin)
  const share = () => {
    handOver(navigator, spot.name, url).then((how) => {
      if (!gone.current) setHanded(how)
    })
  }

  return (
    <p className="caption share-spot">
      <button type="button" className="text-button" onClick={share}>
        {SHARE.share}
      </button>{' '}
      {/* Always rendered, so a screen reader is told when the line changes. */}
      <span role="status">
        {handed === 'copied' && SHARE.copied}
        {handed === 'show' && (
          <>
            {SHARE.copyThis} <span className="share-link">{url}</span>
          </>
        )}
      </span>
    </p>
  )
}
