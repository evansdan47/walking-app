import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type AccountMenuRoute =
  | '/account/settings'
  | '/account/permissions'
  | '/account/developer'
  | '/account/diagnostics'
  | '/account/help';

type AccountHamburgerMenuProps = {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: AccountMenuRoute) => void;
  onSignOut: () => void;
};

type MenuItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: AccountMenuRoute;
  destructive?: boolean;
  onPress?: () => void;
  adminOnly?: boolean;
};

export function AccountHamburgerMenu({
  visible,
  onClose,
  onNavigate,
  onSignOut,
}: AccountHamburgerMenuProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const summary = useAppQuery(api.users.getAccountSummary);
  const isAdmin = summary?.isAdmin === true;

  const items: MenuItem[] = [
    { id: 'account', label: 'Account', icon: 'person-outline', route: '/account/settings' },
    { id: 'permissions', label: 'Permissions', icon: 'shield-checkmark-outline', route: '/account/permissions' },
    ...(__DEV__
      ? ([
          { id: 'developer', label: 'Developer', icon: 'code-slash-outline', route: '/account/developer' },
          { id: 'diagnostics', label: 'Diagnostics', icon: 'bug-outline', route: '/account/diagnostics' },
        ] as MenuItem[])
      : []),
    { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', route: '/account/help' },
    {
      id: 'admin',
      label: 'Admin',
      icon: 'construct-outline',
      route: '/account/settings',
      adminOnly: true,
    },
    { id: 'signout', label: 'Sign out', icon: 'log-out-outline', destructive: true, onPress: onSignOut },
  ];

  const visibleItems = items.filter((item) => !item.adminOnly || isAdmin);

  function handleItemPress(item: MenuItem) {
    onClose();
    if (item.onPress) {
      item.onPress();
      return;
    }
    if (item.route) {
      onNavigate(item.route);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              marginTop: insets.top + Spacing.sm,
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText type="subtitle" style={styles.sheetTitle}>
            Account menu
          </ThemedText>
          <ScrollView bounces={false}>
            {visibleItems.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  styles.row,
                  index < visibleItems.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => handleItemPress(item)}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? '#dc2626' : colors.icon}
                />
                <ThemedText
                  style={[
                    styles.rowLabel,
                    {
                      color: item.destructive ? '#dc2626' : colors.text,
                      fontFamily: Typography.fontMedium,
                    },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: Spacing.base,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    maxWidth: 320,
  },
  sheetTitle: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    fontSize: Typography.sizes.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  rowLabel: {
    fontSize: Typography.sizes.base,
  },
});
