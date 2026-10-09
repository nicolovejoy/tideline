import type { TonightWords } from './dayList.ts'

interface TonightStripProps {
  /** What to say about today at the spot. */
  words: TonightWords
}

/**
 * Tonight at a glance: sunset and the moon. The coloured bars beside "Sunset"
 * and "Moon" are the key to the vertical lines of the same colours in the
 * panels below.
 */
export function TonightStrip({ words }: TonightStripProps) {
  return (
    <section className="tonight" aria-label="Tonight">
      <div className="tonight-sun">
        <h2 className="key key-sunset">Sunset</h2>
        <p className="tonight-time">{words.sunset}</p>
      </div>
      <div className="tonight-moon">
        <h2 className="key key-moonrise">Moon</h2>
        <p>{words.moon}</p>
        <p>{words.moonrise}</p>
      </div>
      {words.flag !== null && <p className="tonight-flag">{words.flag}</p>}
    </section>
  )
}
