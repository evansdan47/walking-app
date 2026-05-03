'use client';

import { createContext, useContext, useState } from 'react';

interface PreviewContextValue {
  isPreviewing: boolean;
  setIsPreviewing: (v: boolean) => void;
}

const PreviewContext = createContext<PreviewContextValue>({
  isPreviewing: false,
  setIsPreviewing: () => {},
});

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  return (
    <PreviewContext.Provider value={{ isPreviewing, setIsPreviewing }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  return useContext(PreviewContext);
}
