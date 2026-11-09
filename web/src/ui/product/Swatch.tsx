/** A content colour swatch: the person's list, tag or calendar colour, not an interface colour. */
export function Swatch({ colour }: { colour: string }) {
  return <span className="sw" style={{ background: `var(--${colour})` }} aria-hidden="true" />;
}
