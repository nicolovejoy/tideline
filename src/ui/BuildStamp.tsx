import { BUILD } from '../build.ts'
import { deviceTimeZone } from '../time.ts'
import { WORDS } from './addSpotView.ts'
import { buildStamp } from './buildStamp.ts'

/** Which build this is, small, at the foot of the page. */
export function BuildStamp() {
  const stamp = buildStamp(BUILD, deviceTimeZone())
  if (!stamp) return null
  return (
    <footer className="build-stamp">
      {stamp.words}
      {stamp.commit && (
        <>
          {' '}
          <span aria-hidden="true">{WORDS.separator}</span>{' '}
          <a href={stamp.commit.url} aria-label={stamp.commit.label}>
            {stamp.commit.short}
          </a>
        </>
      )}
    </footer>
  )
}
