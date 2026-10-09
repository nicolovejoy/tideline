interface TidesHiddenProps {
  /** The one line that stands in for the tide. */
  words: string
  onShow: () => void
}

/** Where the tide panel would be, when the spot hides it. */
export function TidesHidden({ words, onShow }: TidesHiddenProps) {
  return (
    <p className="notice tides-hidden">
      <span>{words}</span>
      <button type="button" className="tides-toggle" onClick={onShow}>
        Show tides
      </button>
    </p>
  )
}
