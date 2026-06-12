import { useRef, type MutableRefObject } from 'react';

import { useAppAuth } from '@/hooks/use-app-auth';

/** Survives component remounts (e.g. bottom-sheet tab switches). */
const globalQueryCache = new Map<string, unknown>();
/** Once a list query has shown real rows, never flash back to skeleton for this session. */
const warmListKeys = new Set<string>();

export type StableQueryOptions = {
  cacheKey?: string;
  retainNull?: boolean;
  retainEmptyWhenHadData?: boolean;
  ignoreEmptyUntilAuthenticated?: boolean;
};

type AuthState = {
  authLoading: boolean;
  isAuthenticated: boolean;
};

function readCache<T>(cacheKey?: string): T | undefined {
  if (!cacheKey) return undefined;
  return globalQueryCache.get(cacheKey) as T | undefined;
}

function writeCache<T>(cacheKey: string | undefined, value: T): void {
  if (!cacheKey) return;
  globalQueryCache.set(cacheKey, value);
  if (Array.isArray(value) && value.length > 0) {
    warmListKeys.add(cacheKey);
  } else if (value != null && typeof value === 'object') {
    warmListKeys.add(cacheKey);
  }
}

function clearCache(cacheKey: string | undefined): void {
  if (!cacheKey) return;
  globalQueryCache.delete(cacheKey);
  warmListKeys.delete(cacheKey);
}

/** Keep cached rows during JWT refresh; drop cache on real sign-out. */
function shouldRetainNull<T>(
  previous: T | undefined | null,
  options: StableQueryOptions | undefined,
  auth: AuthState,
): boolean {
  return (
    options?.retainNull === true &&
    previous != null &&
    (auth.authLoading || auth.isAuthenticated)
  );
}

function shouldSkipValue<T>(
  value: T,
  previous: T | undefined | null,
  options: StableQueryOptions | undefined,
  auth: AuthState,
): boolean {
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  const hadArrayData = Array.isArray(previous) && previous.length > 0;
  const skipEmptyBlip = isEmptyArray && hadArrayData && options?.retainEmptyWhenHadData;
  const skipUnauthEmpty =
    isEmptyArray &&
    options?.ignoreEmptyUntilAuthenticated &&
    (auth.authLoading || !auth.isAuthenticated);

  return Boolean(skipEmptyBlip || skipUnauthEmpty);
}

function resolveStableValue<T>(
  value: T | undefined | null,
  stableRef: MutableRefObject<T | undefined | null>,
  options: StableQueryOptions | undefined,
  auth: AuthState,
): T | undefined | null {
  if (value === undefined) {
    return stableRef.current !== undefined ? stableRef.current : value;
  }

  if (
    value !== null &&
    shouldSkipValue(value, stableRef.current, options, auth)
  ) {
    return stableRef.current ?? value;
  }

  if (value === null && shouldRetainNull(stableRef.current, options, auth)) {
    return stableRef.current;
  }

  return value;
}

function commitStableValue<T>(
  value: T | undefined | null,
  stableRef: MutableRefObject<T | undefined | null>,
  options: StableQueryOptions | undefined,
  auth: AuthState,
): boolean {
  if (value === undefined) return false;

  if (shouldSkipValue(value, stableRef.current, options, auth)) {
    return Array.isArray(stableRef.current) && stableRef.current.length > 0;
  }

  if (value === null && shouldRetainNull(stableRef.current, options, auth)) {
    return stableRef.current != null;
  }

  stableRef.current = value;
  if (value === null) {
    clearCache(options?.cacheKey);
  } else {
    writeCache(options?.cacheKey, value);
  }
  return true;
}

export function useStableQueryValue<T>(
  value: T | undefined | null,
  options?: StableQueryOptions,
): T | undefined | null {
  const { authLoading, isAuthenticated } = useAppAuth();
  const auth: AuthState = { authLoading, isAuthenticated };
  const stableRef = useRef<T | undefined | null>(readCache<T>(options?.cacheKey) ?? undefined);

  commitStableValue(value, stableRef, options, auth);

  return resolveStableValue(value, stableRef, options, auth);
}

export type StableQueryResult<T> = {
  data: T | undefined | null;
  isPending: boolean;
  showEmpty: boolean;
};

export function useStableQuery<T>(
  value: T | undefined | null,
  options: StableQueryOptions,
): StableQueryResult<T> {
  const { authLoading, isAuthenticated } = useAppAuth();
  const auth: AuthState = { authLoading, isAuthenticated };
  const cacheKey = options.cacheKey;
  const cached = readCache<T>(cacheKey);
  const stableRef = useRef<T | undefined | null>(cached ?? undefined);
  const hasResolvedRef = useRef(cached !== undefined);

  const committed = commitStableValue(value, stableRef, options, auth);
  if (committed) {
    hasResolvedRef.current = true;
  }

  const data = resolveStableValue(value, stableRef, options, auth);
  const listData = Array.isArray(data) ? data : [];
  const isWarm = cacheKey != null && warmListKeys.has(cacheKey);
  const hasListData = listData.length > 0;

  const awaitingAuth =
    options.ignoreEmptyUntilAuthenticated && (authLoading || !isAuthenticated);

  const isPending =
    !isWarm &&
    !hasListData &&
    (value === undefined || awaitingAuth);

  const showEmpty =
    !isWarm &&
    !hasListData &&
    !isPending &&
    hasResolvedRef.current &&
    value !== undefined &&
    isAuthenticated &&
    !authLoading;

  return { data, isPending, showEmpty };
}
