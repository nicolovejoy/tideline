import { useEffect, useRef } from 'react'
import { HELP } from './helpText.ts'

interface HelpSheetProps {
  onClose: () => void
}

/**
 * The sheet that explains the panels, over them. Its heading takes focus
 * on open; Escape, Close and a tap on the page behind close it. The page
 * does not scroll under it. The words are in `helpText.ts`.
 */
export function HelpSheet({ onClose }: HelpSheetProps) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="help-title" ref={heading} tabIndex={-1}>
            {HELP.title}
          </h2>
          <button type="button" className="text-button" onClick={onClose}>
            {HELP.close}
          </button>
        </header>
        {HELP.sections.map((section) => (
          <section key={section.heading} className="sheet-section">
            <h3>{section.heading}</h3>
            {section.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </section>
        ))}
      </section>
    </div>
  )
}
