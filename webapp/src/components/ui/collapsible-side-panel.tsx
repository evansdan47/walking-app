'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CollapsibleSidePanelProps {
  /** Shown as the panel header title. */
  title: string;
  /** Optional custom title node — replaces the default <h2> when provided. */
  titleContent?: React.ReactNode;
  /** Tooltip text on the circular collapsed button, e.g. "Custom route info". */
  collapsedTooltip: string;
  /** Icon rendered inside the circular collapsed button. */
  collapsedIcon: React.ReactNode;
  /** Current controlled width in px — owned by the parent. */
  width: number;
  /** Called while the user drags the resize handle. */
  onWidthChange: (w: number) => void;
  /** Minimum resize width (px). Default 260. */
  minWidth?: number;
  /** Maximum resize width (px). Default 600. */
  maxWidth?: number;
  /** Distance from the top of the viewport (px). Dynamically avoids toolbar overlap. */
  panelTop?: number;
  /**
   * Content always visible when the panel is open (below the header).
   * Displayed even when the panel is rolled up.
   */
  alwaysShownContent: React.ReactNode;
  /**
   * Content hidden when the panel is rolled up.
   * Rendered inside an overflow-y-auto scrollable area.
   */
  collapsibleContent: React.ReactNode;
  /** Optional footer, always visible when panel is open. */
  footer?: React.ReactNode;
  /** Optional content rendered below the title, still inside the header border. */
  headerExtra?: React.ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CollapsibleSidePanel({
  title,
  titleContent,
  collapsedTooltip,
  collapsedIcon,
  width,
  onWidthChange,
  minWidth = 260,
  maxWidth = 600,
  panelTop,
  alwaysShownContent,
  collapsibleContent,
  footer,
  headerExtra,
}: CollapsibleSidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [rolledUp, setRolledUp] = useState(false);

  // ── Drag-resize ────────────────────────────────────────────────────────────

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!isDragging.current) return;
      const next = dragStartWidth.current + (e.clientX - dragStartX.current);
      onWidthChange(Math.min(maxWidth, Math.max(minWidth, next)));
    }
    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [onWidthChange, minWidth, maxWidth]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    // Outer positioning column — always reserves the left slot at the current width.
    <div
      className="absolute left-4 bottom-4 z-10 pointer-events-none"
      style={{ width, top: panelTop !== undefined ? panelTop : 128, transition: 'top 200ms ease' }}
    >
      {/* ── Sliding panel ── */}
      <div
        className="absolute top-0 left-0 right-0 flex flex-col bg-white/97 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden pointer-events-auto"
        style={{
          transform: collapsed ? 'translateX(calc(-100% - 1.5rem))' : 'translateX(0)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header — always visible */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {/* Collapse-to-side button */}
            <button
              onClick={() => setCollapsed(true)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-slate"
              title={`Hide ${title}`}
              aria-label={`Collapse ${title} panel`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>

            {/* Title — centred between the two buttons */}
            <h2 className="flex-1 min-w-0 text-base font-bold text-slate">{titleContent ?? title}</h2>

            {/* Roll-up / roll-down toggle */}
            <button
              onClick={() => setRolledUp((v) => !v)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-slate"
              title={rolledUp ? `Expand ${title}` : `Roll up ${title}`}
              aria-label={rolledUp ? 'Expand panel' : 'Roll up panel'}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {/* ↑ when expanded (click to roll up), ↓ when rolled up (click to expand) */}
                <path d={rolledUp ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
              </svg>
            </button>
          </div>
          {headerExtra && <div className="mt-2">{headerExtra}</div>}
        </div>

        {/* Always-shown content — visible even when rolled up */}
        <div className="shrink-0">
          {alwaysShownContent}
        </div>

        {/* Collapsible section — CSS grid trick for smooth height animation */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: rolledUp ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className="overflow-y-auto px-5 py-4 flex flex-col gap-5"
              style={{ maxHeight: 'calc(100dvh - 26rem)' }}
            >
              {collapsibleContent}
            </div>
          </div>
        </div>

        {/* Footer — always visible */}
        {footer && (
          <div className="shrink-0 border-t border-gray-100">
            {footer}
          </div>
        )}

        {/* Resize handle */}
        <div
          onPointerDown={onResizePointerDown}
          className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-ew-resize group rounded-r-2xl"
          aria-hidden="true"
          title="Drag to resize"
        >
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-400" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Circular info button — shown when panel is collapsed ── */}
      <button
        onClick={() => setCollapsed(false)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white shadow-xl border border-gray-200 flex items-center justify-center pointer-events-auto"
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title={collapsedTooltip}
        aria-label={`Show ${title}`}
      >
        {collapsedIcon}
      </button>
    </div>
  );
}
