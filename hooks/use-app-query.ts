import { useQuery as useConvexQuery } from 'convex/react';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { getFunctionName } from 'convex/server';

import { useStableQueryValue } from '@/hooks/use-stable-query-value';

const DEFAULT_STABLE_OPTIONS = {
  retainNull: true,
  retainEmptyWhenHadData: true,
  ignoreEmptyUntilAuthenticated: true,
} as const;

function cacheKeyForQuery(
  query: FunctionReference<'query'>,
  args: FunctionArgs<FunctionReference<'query'>> | 'skip' | undefined,
): string {
  const argsPart = args === 'skip' ? '@skip' : JSON.stringify(args ?? {});
  return `query:${getFunctionName(query)}:${argsPart}`;
}

/**
 * Drop-in replacement for `useQuery` that retains the last good result during
 * Convex JWT refresh / reconnect blips (null, undefined, or empty []).
 */
export function useAppQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: keyof FunctionArgs<Query> extends never
    ? [args?: FunctionArgs<Query> | 'skip']
    : [args: FunctionArgs<Query> | 'skip']
): FunctionReturnType<Query> | undefined | null {
  const queryArgs = args[0];
  const raw = useConvexQuery(query, queryArgs as 'skip');
  return useStableQueryValue(raw, {
    ...DEFAULT_STABLE_OPTIONS,
    cacheKey: cacheKeyForQuery(query, queryArgs),
  });
}
