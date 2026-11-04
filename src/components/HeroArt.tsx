// Decorative illustration for the violet hero: a checklist window, a sticky
// note and a progress ring.
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" fill="none" aria-hidden className={className}>
      <g stroke="#1e1b3a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <rect x="40" y="30" width="230" height="200" rx="6" fill="#e7e5fd" />
        <path d="M40 66h230" />
        {/* checklist */}
        <rect x="62" y="86" width="22" height="22" rx="6" fill="#7262ea" />
        <path d="M67 97l4 4 8-8" stroke="#fff" />
        <path d="M98 97h96" />
        <rect x="62" y="124" width="22" height="22" rx="6" fill="#7262ea" />
        <path d="M67 135l4 4 8-8" stroke="#fff" />
        <path d="M98 135h70" />
        <rect x="62" y="162" width="22" height="22" rx="6" fill="#fff" />
        <path d="M98 173h84" />
        {/* sticky note */}
        <path d="M206 128h86v78l-18 18h-68z" fill="#f5c84b" />
        <path d="M274 224v-18h18" fill="#e0ad2e" />
        <path d="M220 152h50M220 168h38M220 184h44" strokeWidth="2" />
        {/* progress ring */}
        <circle cx="300" cy="78" r="34" fill="#fff" />
        <circle cx="300" cy="78" r="22" stroke="#e7e5fd" strokeWidth="9" />
        <path d="M300 56a22 22 0 1 1-21 28" stroke="#f08a4b" strokeWidth="9" />
      </g>
      <g fill="#1e1b3a">
        <circle cx="58" cy="48" r="5" fill="#f5c84b" />
        <circle cx="74" cy="48" r="5" fill="#f08a4b" />
        <circle cx="90" cy="48" r="5" fill="#7262ea" />
      </g>
      <g stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round">
        <path d="M338 130l16-6M332 150l18 8M320 30l6-18" />
        <path d="M18 120c-10-12 4-26 14-16 6 6-2 16-8 10" fill="none" />
      </g>
    </svg>
  );
}
