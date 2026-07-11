export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="40" height="40" rx="11" fill="url(#logo-gradient)" />
      <path
        d="M11 14.5C11 12.567 12.567 11 14.5 11H25.5C27.433 11 29 12.567 29 14.5V25.5C29 27.433 27.433 29 25.5 29H14.5C12.567 29 11 27.433 11 25.5V14.5Z"
        stroke="white"
        strokeOpacity="0.9"
        strokeWidth="1.6"
      />
      <path d="M11 16.2H29M11 23.8H29" stroke="white" strokeOpacity="0.9" strokeWidth="1.6" />
      <path d="M15.5 11V16.2M15.5 23.8V29M24.5 11V16.2M24.5 23.8V29" stroke="white" strokeOpacity="0.9" strokeWidth="1.6" />
      <path d="M18 18.6L23 20L18 21.4V18.6Z" fill="white" />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f58838" />
          <stop offset="1" stopColor="#bc380e" />
        </linearGradient>
      </defs>
    </svg>
  );
}
