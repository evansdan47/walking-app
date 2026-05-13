/**
 * Lightweight event bus used to imperatively open a named bottom sheet
 * from anywhere in the app (e.g. the recording indicator bar → record sheet).
 */

type SheetTab = 'record' | 'explore' | 'sessions' | 'profile';
type Listener = (sheet: SheetTab) => void;

const listeners = new Set<Listener>();

export const sheetEvents = {
  open(sheet: SheetTab) {
    listeners.forEach((l) => l(sheet));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
