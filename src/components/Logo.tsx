import { Link } from "react-router-dom";

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className={`logo${small ? " logo-sm" : ""}`} aria-label="Carpool Planner home">
      <svg viewBox="0 0 32 32" aria-hidden width={small ? 22 : 30} height={small ? 22 : 30}>
        <rect width="32" height="32" rx="8" fill="var(--tomato)" />
        <rect x="9" y="5" width="14" height="22" rx="6" fill="var(--paper)" />
        <rect x="11" y="9" width="10" height="4" rx="1.5" fill="var(--ink)" />
        <rect x="11" y="16" width="4" height="4" rx="1" fill="var(--mustard)" />
        <rect x="17" y="16" width="4" height="4" rx="1" fill="var(--teal)" />
      </svg>
      <span>Carpool<b>Planner</b></span>
    </Link>
  );
}
