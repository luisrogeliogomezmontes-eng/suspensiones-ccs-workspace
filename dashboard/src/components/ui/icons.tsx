import type { SVGProps } from "react";

// Iconos de línea (currentColor). Trazo de instrumento, no emoji.
const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IconThermo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" />
    <path d="M12 9v6.5" />
  </svg>
);

export const IconFan = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2" />
    <path d="M12 10c0-3 .5-6-1.5-6S7 7 12 10Z" />
    <path d="M14 12c3 0 6 .5 6-1.5S17 7 14 12Z" />
    <path d="M12 14c0 3-.5 6 1.5 6s2.5-3-1.5-6Z" />
    <path d="M10 12c-3 0-6-.5-6 1.5S7 17 10 12Z" />
  </svg>
);

export const IconSat = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21a9 9 0 0 0-9-9" />
    <path d="M12 17a5 5 0 0 0-5-5" />
    <circle cx="6" cy="18" r="1.4" />
    <path d="M14 3l7 7M9.5 7.5l7 7M17 3l4 4M7 10l7 7" />
  </svg>
);

export const IconBattery = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="8" width="15" height="9" rx="2" />
    <path d="M21 11v3" />
  </svg>
);

export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const IconSignal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12.5a10 10 0 0 1 14 0" />
    <path d="M8 15.5a6 6 0 0 1 8 0" />
    <path d="M12 18.5h.01" />
  </svg>
);

export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5 9-11" />
  </svg>
);
