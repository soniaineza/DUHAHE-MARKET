interface IconProps {
  className?: string;
  size?: number;
}

const base = (className?: string, size = 20) => ({
  className,
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function BasketIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M3 8h18l-1.5 12a2 2 0 0 1-2 1.8h-11a2 2 0 0 1-2-1.8L3 8Z" />
      <path d="M8 8l3.5-5" />
      <path d="M16 8l-3.5-5" />
      <path d="M3 8l1-0.5h16L21 8" />
      <path d="M9 12v4" />
      <path d="M15 12v4" />
    </svg>
  );
}

export function GridIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function CartIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6" />
    </svg>
  );
}

export function TagIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M12 2H4v8l8 8 8-8-8-8Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

export function TrendUpIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function TrendDownIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </svg>
  );
}

export function MoneyIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5" />
      <path d="M18 9.5v5" />
    </svg>
  );
}

export function TruckIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M1 5h13v11H1z" />
      <path d="M14 8h4l4 4v4h-2" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </svg>
  );
}

export function StarIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19l1-5.8-4.2-4.1 5.9-.9Z" />
    </svg>
  );
}

export function SearchIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ArrowLeftIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export function LogoutIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function DownIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LeafIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M5 21c0-9 5-15 15-17-2 10-7 15-13 17" />
      <path d="M5 21c0-6 4-10 9-12" />
    </svg>
  );
}

export function UsersIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 3.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5" />
    </svg>
  );
}

export function BellIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

export function TrashIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function PlusIcon({ className, size }: IconProps) {
  return (
    <svg {...base(className, size)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}