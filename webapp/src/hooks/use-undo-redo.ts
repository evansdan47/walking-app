import { useCallback, useState } from 'react';

/**
 * Generic pointer-based undo/redo queue.
 *
 * Maintains an ordered list of snapshots and a `pointer` that represents
 * the currently active state. Committing a new snapshot truncates any
 * redo future (commands above the pointer), appends the snapshot, and
 * advances the pointer. Undo decrements the pointer; redo increments it.
 *
 * @param initialState  The initial snapshot (becomes index 0, never removed).
 * @param maxHistory    Maximum number of snapshots to retain (default 100).
 */
export function useUndoRedo<T>(initialState: T, maxHistory = 100) {
  // `snapshots[pointer]` is always the current state.
  const [snapshots, setSnapshots] = useState<T[]>([initialState]);
  const [pointer, setPointer] = useState(0);

  /** The current active state. */
  const present = snapshots[pointer];

  const canUndo = pointer > 0;
  const canRedo = pointer < snapshots.length - 1;

  /**
   * Commit a new state. Truncates the redo stack above the current pointer,
   * appends the new snapshot, and advances the pointer.
   */
  const commit = useCallback(
    (next: T | ((current: T) => T)) => {
      setSnapshots((prev) => {
        const current = prev[pointer];
        const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
        // Truncate redo future, append, cap at maxHistory
        const base = prev.slice(0, pointer + 1);
        const updated = [...base, resolved];
        return updated.length > maxHistory ? updated.slice(updated.length - maxHistory) : updated;
      });
      setPointer((p) => Math.min(p + 1, maxHistory - 1));
    },
    [pointer, maxHistory]
  );

  /** Step back one command. No-op if already at the beginning. */
  const undo = useCallback(() => {
    if (canUndo) setPointer((p) => p - 1);
  }, [canUndo]);

  /** Step forward one command. No-op if already at the latest. */
  const redo = useCallback(() => {
    if (canRedo) setPointer((p) => p + 1);
  }, [canRedo]);

  /** Reset to a new initial state, clearing all history. */
  const reset = useCallback((newInitial: T) => {
    setSnapshots([newInitial]);
    setPointer(0);
  }, []);

  return { present, commit, undo, redo, reset, canUndo, canRedo };
}
