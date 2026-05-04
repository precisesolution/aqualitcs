import type { Fit, Status } from '../types';

const FIT_STYLES: Record<Fit, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MED: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-ink-50 text-ink-500 border-ink-200',
};

const STATUS_STYLES: Record<Status, string> = {
  'To contact': 'bg-ink-100 text-ink-600 border-ink-200',
  'Walk-in planned': 'bg-wave-50 text-wave-700 border-wave-200',
  Emailed: 'bg-violet-50 text-violet-700 border-violet-200',
  Replied: 'bg-sky-50 text-sky-700 border-sky-200',
  Scheduling: 'bg-amber-50 text-amber-700 border-amber-200',
  Scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Met: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'No-go': 'bg-ink-100 text-ink-400 border-ink-200 line-through',
};

export function FitBadge({ fit }: { fit: Fit }) {
  return <span className={`pill ${FIT_STYLES[fit]}`}>{fit}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`pill ${STATUS_STYLES[status]}`}>{status}</span>;
}
