import { useId } from "react";

/** The Kasama Space mark: four tiles on an indigo square. Same drawing as app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4d62c9" />
          <stop offset="1" stopColor="#2a3a85" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradient})`} />
      <rect x="14" y="14" width="16" height="16" rx="4.5" fill="#ffffff" />
      <rect x="34" y="14" width="16" height="16" rx="4.5" fill="#c9d1ff" />
      <rect x="14" y="34" width="16" height="16" rx="4.5" fill="#9fe3cf" />
      <rect x="34" y="34" width="16" height="16" rx="4.5" fill="#ffffff" />
    </svg>
  );
}
