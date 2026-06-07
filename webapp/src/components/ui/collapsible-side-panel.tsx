'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelHeight, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT, MOBILE_BREAKPOINT } from '@/hooks/use-panel-width';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CollapsibleSidePanelProps {
  /** Shown as the panel header title. */
  title: string;
  /** Optional custom title node — replaces the default <h2> when provided. */
  titleContent?: React.ReactNode;
  /** If provided, a back (←) button is shown in the header. */
  onBack?: () => void;
  /** Current controlled width in px — owned by the parent. */
  width: number;
  /** Called while the user drags the resize handle. */
  onWidthChange: (w: number) => void;
  /** Minimum resize width (px). Default 300. */
  minWidth?: number;
  /** Maximum resize width (px). Default 620. */
  maxWidth?: number;
  /** Distance from the top of the viewport (px). Defaults to 68 — just below the nav header. */
  panelTop?: number;
  /** Non-scrolling section shown immediately below the header. */
  alwaysShownContent?: React.ReactNode;
  /** Main scrollable content area. */
  collapsibleContent: React.ReactNode;
  /** Optional footer pinned to the bottom of the panel. */
  footer?: React.ReactNode;
  /** Optional extra content rendered inside the header, below the title row. */
  headerExtra?: React.ReactNode;
  /** Right-aligned actions in the title row (e.g. pace picker). */
  headerActions?: React.ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CollapsibleSidePanel({
  title,
  titleContent,
  onBack,
  width,
  onWidthChange,
  minWidth = 300,
  maxWidth = 620,
  panelTop = 68,
  alwaysShownContent,
  collapsibleContent,
  footer,
  headerExtra,
  headerActions,
}: CollapsibleSidePanelProps) {
  // ── Mobile detection ────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Desktop drag-resize (right edge → width) ────────────────────────────
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

  // ── Mobile drag-resize (top edge → height) ──────────────────────────────
  const [panelHeight, setPanelHeight] = usePanelHeight();
  const isHeightDragging = useRef(false);
  const heightDragStartY = useRef(0);
  const heightDragStartHeight = useRef(0);

  const onTopGripperDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isHeightDragging.current = true;
      heightDragStartY.current = e.clientY;
      heightDragStartHeight.current = panelHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [panelHeight],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!isHeightDragging.current) return;
      const next = heightDragStartHeight.current - (e.clientY - heightDragStartY.current);
      setPanelHeight(Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, next)));
    }
    function onUp() {
      if (!isHeightDragging.current) return;
      isHeightDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [setPanelHeight]);

  // ── Shared header ────────────────────────────────────────────────────────
  const header = (
    <div className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-slate"
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <h2 className="flex-1 min-w-0 text-base font-bold text-slate">{titleContent ?? title}</h2>
        {headerActions}
      </div>
      {headerExtra && <div className="mt-2">{headerExtra}</div>}
    </div>
  );

  // ── Mobile: bottom dock ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-auto bg-white/97 backdrop-blur-sm rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col"
        style={{ height: panelHeight }}
      >
        {/* Top resize handle */}
        <div
          onPointerDown={onTopGripperDown}
          className="shrink-0 h-5 flex justify-center items-center cursor-ns-resize"
          aria-hidden="true"
          title="Drag to resize"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {header}
        {alwaysShownContent && <div className="shrink-0">{alwaysShownContent}</div>}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-5">
          {collapsibleContent}
        </div>
        {footer && <div className="shrink-0 border-t border-gray-100">{footer}</div>}
      </div>
    );
  }

  // ── Desktop: left side panel ────────────────────────────────────────────
  return (
    <div
      className="absolute left-4 z-10 pointer-events-auto bg-white/97 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden flex flex-col"
      style={{ top: panelTop, bottom: 16, width, transition: 'top 200ms ease' }}
    >
      {header}
      {alwaysShownContent && <div className="shrink-0">{alwaysShownContent}</div>}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-5">
        {collapsibleContent}
      </div>
      {footer && <div className="shrink-0 border-t border-gray-100">{footer}</div>}
      {/* Resize handle — right edge */}
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
  );
}
