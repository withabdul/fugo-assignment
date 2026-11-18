// Logo file is 578×160. Width and height are set so the page does not shift
// while the image loads.
const LOGO_RATIO = 578 / 160;

export function FugoLogo({ height = 32, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src="/fugo-logo.png"
      alt="Fugo Creative"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`pointer-events-none animate-spin ${className}`}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
