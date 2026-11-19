import clsx from 'clsx';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

/** Inline form-level error banner. Always human-readable text. */
export function AuthAlert({ children, className, style }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={clsx(
        'flex items-start gap-2.5 rounded-control border p-3.5 text-sm font-medium',
        className
      )}
      style={style}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Inline success banner (registration confirmations, saved settings). */
export function AuthSuccess({ children, className, style }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-2.5 rounded-control border p-3.5 text-sm font-medium',
        className
      )}
      style={style}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Neutral inline notice (tips, hints, permission messages). */
export function InfoNote({ children, className, style }) {
  if (!children) return null;
  return (
    <p className={clsx('rounded-control p-3 text-xs', className)} style={style}>
      {children}
    </p>
  );
}
