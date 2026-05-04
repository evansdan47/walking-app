'use client';

import { useCallback, useState } from 'react';

const COOKIE_KEY = 'rambleio_panel_width';

export const PANEL_MIN_WIDTH = 300;
export const PANEL_MAX_WIDTH = 620;
const DEFAULT_WIDTH = 380;

export function clampPanelWidth(v: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, v));
}

function readCookie(): number {
  if (typeof document === 'undefined') return DEFAULT_WIDTH;
  const match = document.cookie.match(/(?:^|; )rambleio_panel_width=([^;]*)/);
  if (!match) return DEFAULT_WIDTH;
  const val = Number(match[1]);
  return isNaN(val) ? DEFAULT_WIDTH : clampPanelWidth(val);
}

function writeCookie(value: number): void {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Returns [width, setWidth] where width is initialised from (and persisted to)
 * a client-side cookie shared across all side-panels in the app.
 */
export function usePanelWidth(): [number, (w: number) => void] {
  const [width, setWidth] = useState<number>(readCookie);

  const onChange = useCallback((w: number) => {
    const clamped = clampPanelWidth(w);
    setWidth(clamped);
    writeCookie(clamped);
  }, []);

  return [width, onChange];
}

// ── Bottom-dock height ─────────────────────────────────────────────────────────

/** Window width breakpoint below which panels dock to the bottom of the screen. */
export const MOBILE_BREAKPOINT = 800;

const HEIGHT_COOKIE_KEY = 'rambleio_panel_height';
export const PANEL_MIN_HEIGHT = 200;
export const PANEL_MAX_HEIGHT = 700;
const DEFAULT_HEIGHT = 400;

export function clampPanelHeight(v: number): number {
  return Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, v));
}

function readHeightCookie(): number {
  if (typeof document === 'undefined') return DEFAULT_HEIGHT;
  const match = document.cookie.match(/(?:^|; )rambleio_panel_height=([^;]*)/);
  if (!match) return DEFAULT_HEIGHT;
  const val = Number(match[1]);
  return isNaN(val) ? DEFAULT_HEIGHT : clampPanelHeight(val);
}

function writeHeightCookie(value: number): void {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${HEIGHT_COOKIE_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Returns [height, setHeight] where height is initialised from (and persisted to)
 * a client-side cookie shared across all side-panels in the app (bottom-dock mode).
 */
export function usePanelHeight(): [number, (h: number) => void] {
  const [height, setHeight] = useState<number>(readHeightCookie);

  const onChange = useCallback((h: number) => {
    const clamped = clampPanelHeight(h);
    setHeight(clamped);
    writeHeightCookie(clamped);
  }, []);

  return [height, onChange];
}
