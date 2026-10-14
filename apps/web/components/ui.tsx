'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { formatMoney } from '@dripwell/shared/v2';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    pulse: <path d="M2 12h5l3-8 4 16 3-8h5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    settings: (
      <>
        <path d="m12 3 2 3 4-.2.2 4L21 12l-3 2 .2 4-4 .2L12 21l-2-3-4 .2-.2-4L3 12l3-2-.2-4 4-.2Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
        <path d="M20 2v4M18 4h4" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    upload: (
      <>
        <path d="m7 8 5-5 5 5M12 3v12M4 14v6h16v-6" />
      </>
    ),
    download: (
      <>
        <path d="m7 11 5 5 5-5M12 3v13M4 17v4h16v-4" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m9 10 6-3M9 14l6 3" />
      </>
    ),
    archive: (
      <>
        <path d="M4 7v14h16V7M3 3h18v4H3zM9 12h6" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M19 21v-3a6 6 0 0 0-3-5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v18h17M8 16v-4M13 16V8M18 16V5" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    exit: (
      <>
        <path d="M9 3H3v18h6M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    file: (
      <>
        <path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h8" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 9h20M6 15h4" />
      </>
    ),
    back: <path d="m15 5-7 7 7 7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.file}
    </svg>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  icon = 'pulse',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function ErrorBanner({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <span>{message}</span>
      {retry ? (
        <button className="button button-small button-ghost" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      className="modal"
      aria-labelledby={titleId}
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Money({
  cents,
  currency = 'USD',
}: {
  cents: number | null | undefined;
  currency?: string;
}) {
  if (cents == null) return <span className="muted">Price needed</span>;
  return <span className="money">{formatMoney(cents, currency)}</span>;
}

export function friendlyDate(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Celebrate({ active, onEnd }: { active: boolean; onEnd: () => void }) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(onEnd, 2200);
    return () => window.clearTimeout(timer);
  }, [active, onEnd]);
  if (!active) return null;
  return (
    <div className="celebration" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 41) % 100}%`,
            animationDelay: `${(i % 5) * 0.08}s`,
            background: ['#1e7b73', '#ed947f', '#b2d8d0', '#d6b477'][i % 4],
          }}
        />
      ))}
    </div>
  );
}
