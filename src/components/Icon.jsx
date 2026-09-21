/**
 * Inline SVG icons.
 *
 * Hand-rolled rather than pulling an icon package: Phase 1 needs ten glyphs,
 * and these inherit `currentColor` so they follow the design tokens for free.
 */

const PATHS = {
  grid: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3Zm10 0A1.5 1.5 0 0 1 15.5 4h3A1.5 1.5 0 0 1 20 5.5v3A1.5 1.5 0 0 1 18.5 10h-3A1.5 1.5 0 0 1 14 8.5v-3ZM4 15.5A1.5 1.5 0 0 1 5.5 14h3A1.5 1.5 0 0 1 10 15.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3Zm10 0A1.5 1.5 0 0 1 15.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3Z',
  building: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M6 21h12M9 7h2m4 0h-2m0 4h2M9 11h2m0 4h-2m6 0h-2m-1 6v-4',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m6.5-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75',
  user: 'M18 20v-1a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v1m8-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  receipt: 'M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Zm2 5h6m-6 4h6m-6 4h3',
  bell: 'M15 17h5l-1.4-1.7A2 2 0 0 1 18 14V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v3a2 2 0 0 1-.6 1.3L4 17h5m6 0a3 3 0 0 1-6 0m6 0H9',
  activity: 'M22 12h-4l-3 8-4-16-3 8H4',
  sliders: 'M4 6h11m4 0h1M4 12h5m4 0h7M4 18h9m4 0h3m-9-14v4m-4 6v4m8-8v4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  logout: 'M15 17l5-5-5-5m5 5H9m3 8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 11a8 8 0 0 0-14-4.5L4 9m0-5v5h5m-5 3a8 8 0 0 0 14 4.5l2-2.5m0 5v-5h-5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'M5 13l4 4L19 7',
};

export function Icon({ name, className = 'size-5', strokeWidth = 1.75 }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
