'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variant controls the confirm button colour. Defaults to 'danger'. */
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable modal confirmation dialog.
 * Traps focus, closes on Escape, and blocks pointer events on the map behind it.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel on open (safer default)
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmCls =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-400 text-white'
      : 'bg-brand hover:bg-brand-dark focus-visible:ring-brand text-white';

  return (
    /* Backdrop — pointer-events-auto so clicks don't fall through to the map */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className={`h-1 w-full ${variant === 'danger' ? 'bg-red-500' : 'bg-brand'}`} />

        <div className="px-6 pt-5 pb-6">
          {/* Icon + title */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                variant === 'danger' ? 'bg-red-50' : 'bg-orange-50'
              }`}
            >
              {variant === 'danger' ? (
                <svg
                  className="w-4.5 h-4.5 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              ) : (
                <svg
                  className="w-4.5 h-4.5 text-brand"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div>
              <h2
                id="confirm-dialog-title"
                className="text-base font-bold text-slate leading-snug"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-light leading-relaxed">{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end mt-5">
            <button
              ref={cancelRef}
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${confirmCls}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
