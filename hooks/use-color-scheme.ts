import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

/**
 * Wraps React Native's Appearance API with an explicit change listener so
 * the hook reliably re-renders on all platforms when the system theme changes,
 * even if the component was mounted before the change occurred.
 */
export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: cs }) => {
      setColorScheme(cs);
    });
    return () => subscription.remove();
  }, []);

  return colorScheme;
}
