/* The app mark: a heartbeat line on the blue–teal gradient */
export function Logo({ className = "logo" }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2.5-6 4 12 3-8 1.5 2H22" />
      </svg>
    </span>
  );
}
