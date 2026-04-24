import React from 'react';

/** Feather-style 24x24 stroke icons for advisory actions */
const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconArrowUp() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconArrowDown() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

export function IconPencil() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IconArchive() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function IconTrash() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function IconExpand() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

/** RefreshCw — update lifecycle / status change (Lucide-style) */
export function IconRefreshCw() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

/** Clipboard — copy to clipboard actions (Lucide-style) */
export function IconCopy() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v1" fill="none" />
    </svg>
  );
}
