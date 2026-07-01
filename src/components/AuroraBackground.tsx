/** Soft, slow, minimal gradient wash. Purely decorative, adapts to the active theme. */
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
    </div>
  );
}

export default AuroraBackground;
