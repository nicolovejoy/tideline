import type { AddSpotProps } from './AddSpot.tsx'
import { WORDS } from './addSpotView.ts'

/**
 * In the add screen's place when its code could not be fetched. It takes
 * the add screen's props, so it can stand in for it, and needs only Cancel.
 */
export function AddSpotUnavailable({ onCancel }: AddSpotProps) {
  return (
    <section className="add-spot">
      <p className="notice" role="status">
        {WORDS.addUnavailable}
      </p>
      <div className="add-actions">
        <button type="button" className="text-button" onClick={onCancel}>
          {WORDS.cancel}
        </button>
      </div>
    </section>
  )
}
