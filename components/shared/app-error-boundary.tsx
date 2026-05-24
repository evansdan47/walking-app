import { appLog } from '@/lib/diagnostics/logger';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the error and a retry callback. */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Root error boundary that prevents uncaught render errors (including those
 * thrown by Convex hooks) from crashing the entire app. Renders a minimal
 * fallback UI with a retry button instead.
 *
 * Note: this does NOT catch async errors or unhandled promise rejections —
 * those are transport-layer issues handled by the Convex client itself.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Persist to SQLite so the error survives past the dev session and is
    // visible in the Stats & State debug panel even on a production build.
    appLog('error', 'render', error.message, error, {
      componentStack: info.componentStack?.slice(0, 500) ?? null,
    });
    if (__DEV__) {
      console.error('[AppErrorBoundary] Caught render error:', error, info.componentStack);
    }
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.retry);
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message} numberOfLines={4}>{error.message}</Text>
        <Pressable style={styles.button} onPress={this.retry}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f7f6f3',
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1917',
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#a43700',
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
