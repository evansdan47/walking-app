import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shared/app-header';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type AccountScreenProps = {
  title: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  scrollable?: boolean;
};

export function AccountScreen({
  title,
  children,
  contentStyle,
  scrollable = true,
}: AccountScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={title} onBack={() => router.back()} />
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xl },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.scroll,
            styles.content,
            { flex: 1, paddingBottom: insets.bottom + Spacing.xl },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
});
