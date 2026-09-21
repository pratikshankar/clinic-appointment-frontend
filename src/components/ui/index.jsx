/**
 * Small reusable UI kit.
 *
 * Kept in one file deliberately: these are short primitives that are always
 * used together, and a single import keeps pages readable. Anything that grows
 * past ~40 lines should graduate to its own module.
 */

import { Link } from 'react-router-dom';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/* --------------------------------- Button -------------------------------- */
const BUTTON_VARIANTS = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300',
  secondary:
    'bg-white text-ink-800 ring-1 ring-inset ring-ink-300 hover:bg-ink-50 disabled:text-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-ink-700 hover:bg-ink-100 disabled:text-ink-400',
};

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  // A bare <button> defaults to type="submit", so any action button placed
  // inside a form silently submits it. Defaulting to "button" means only the
  // buttons that explicitly ask to submit ever do.
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="xs" />}
      {children}
    </button>
  );
}

/* --------------------------------- Spinner ------------------------------- */
export function Spinner({ size = 'md', className }) {
  const dimensions = { xs: 'size-3.5', sm: 'size-4', md: 'size-6', lg: 'size-8' }[size];
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        dimensions,
        className
      )}
    />
  );
}

/* ---------------------------------- Card -------------------------------- */
export function Card({ children, className, ...props }) {
  return (
    <div
      className={cx(
        'rounded-xl bg-white ring-1 ring-ink-200/70 shadow-sm shadow-ink-900/[0.03]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- StatCard ------------------------------ */
export function StatCard({ label, value, hint, tone = 'default', loading = false }) {
  const tones = {
    default: 'text-ink-900',
    brand: 'text-brand-700',
    positive: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  };
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-ink-100" />
      ) : (
        <p className={cx('numeric mt-1 text-2xl font-semibold', tones[tone])}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}

/* --------------------------------- Badge -------------------------------- */
const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ children, tone = 'neutral', className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent',
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Consistent colour for a role wherever it appears. */
export function RoleBadge({ role }) {
  const tone = { SUPERADMIN: 'brand', ADMIN: 'info', CLINIC_USER: 'neutral' }[role] ?? 'neutral';
  const label = { SUPERADMIN: 'Superadmin', ADMIN: 'Admin', CLINIC_USER: 'Clinic User' }[role];
  return <Badge tone={tone}>{label ?? role}</Badge>;
}

export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Disabled' }) {
  return (
    <Badge tone={active ? 'success' : 'danger'}>{active ? activeLabel : inactiveLabel}</Badge>
  );
}

/* --------------------------------- Alert -------------------------------- */
const ALERT_TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
};

export function Alert({ tone = 'info', title, children, onDismiss }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('rounded-lg px-4 py-3 text-sm ring-1 ring-inset', ALERT_TONES[tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Fields ------------------------------- */
export function Field({ label, htmlFor, error, hint, required, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>
      )}
    </div>
  );
}

const CONTROL_CLASS =
  'block w-full rounded-lg bg-white px-3 py-2 text-sm text-ink-900 ring-1 ring-inset ' +
  'ring-ink-300 placeholder:text-ink-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 ' +
  'disabled:bg-ink-50 disabled:text-ink-500';

export function Input({ className, invalid, ...props }) {
  return (
    <input
      className={cx(CONTROL_CLASS, invalid && 'ring-red-400 focus:ring-red-500', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }) {
  return (
    <select
      className={cx(CONTROL_CLASS, invalid && 'ring-red-400 focus:ring-red-500', className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

/* --------------------------------- Table -------------------------------- */
export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('min-w-full divide-y divide-ink-200 text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = 'left' }) {
  return (
    <th
      scope="col"
      className={cx(
        'whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500',
        align === 'right' ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = 'left' }) {
  return (
    <td
      className={cx(
        'px-4 py-3 text-ink-800',
        align === 'right' ? 'text-right numeric' : 'text-left',
        className
      )}
    >
      {children}
    </td>
  );
}

/* ------------------------------ Empty states ---------------------------- */
export function EmptyState({ title, description, action, icon = '—' }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder for a route whose backend endpoints belong to a later phase. */

/* ------------------------------- Page header ---------------------------- */
/**
 * `backTo` renders an explicit back link above the title. Breadcrumbs alone are
 * easy to miss, and a detail page reached by saving a form otherwise leaves no
 * obvious way out.
 */
export function PageHeader({ title, description, breadcrumb, action, backTo, backLabel }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {backTo && (
          <Link
            to={backTo}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-500 transition-colors hover:text-brand-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M19 12H5m7-7l-7 7 7 7" />
            </svg>
            {backLabel ?? 'Back'}
          </Link>
        )}
        {breadcrumb && (
          <nav className="mb-1 text-xs text-ink-500">
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.label}>
                {index > 0 && <span className="mx-1.5 text-ink-300">/</span>}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-brand-700">
                    {crumb.label}
                  </Link>
                ) : (
                  crumb.label
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* --------------------------------- Modal -------------------------------- */
/**
 * Dialog with a fixed header and footer and a scrolling body.
 *
 * The body is capped and scrolls rather than the dialog growing past the
 * viewport: a tall form (the session form, the reschedule slot picker) would
 * otherwise push its own footer off-screen, leaving the save button unreachable
 * with no way to scroll to it.
 *
 * `size` widens the dialog for content that needs it. `dismissOnBackdrop`
 * exists because closing by mis-click must not be possible where closing has
 * consequences.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
}) {
  if (!open) return null;

  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-ink-950/40"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-xl bg-white shadow-xl',
          widths[size] ?? widths.md
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-ink-400 hover:text-ink-700"
          >
            &times;
          </button>
        </div>

        {/* The only scrolling region, so the footer stays reachable. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
