import { useUser } from '@clerk/expo';
import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { BetaBadge } from '@/components/account/beta-badge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  assetToDataUrl,
  nativeMediaUnavailableMessage,
  validateAvatarAsset,
} from '@/lib/avatar-upload';
import { RAMBLEIO_AVATAR_PRESETS } from '@/lib/rambleio-avatars';

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function ProfileScreenContent() {
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const accountSummary = useAppQuery(api.users.getAccountSummary);
  const updateProfile = useMutation(api.users.updateProfile);
  const recordAvatarUpdated = useMutation(api.users.recordAvatarUpdated);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [capturePresetSvg, setCapturePresetSvg] = useState<string | null>(null);

  const captureViewRef = useRef<View>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const imageUrl = user?.imageUrl;
  const displayName = user?.fullName ?? user?.firstName ?? 'Walker';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (user) {
      setName(user.fullName ?? user.firstName ?? accountSummary?.name ?? '');
    }
  }, [user, accountSummary?.name]);

  const applyProfileImageDataUrl = useCallback(
    async (dataUrl: string) => {
      if (!user) return;

      setAvatarBusy(true);
      setAvatarError(null);
      try {
        await user.setProfileImage({ file: dataUrl });
        await user.reload();
        await recordAvatarUpdated({ hasAvatar: true });
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : 'Could not update avatar');
      } finally {
        setAvatarBusy(false);
      }
    },
    [user, recordAvatarUpdated],
  );

  useEffect(() => {
    if (!capturePresetSvg) return;

    void (async () => {
      try {
        const { captureRef } = await import('react-native-view-shot');
        await new Promise((resolve) => setTimeout(resolve, 80));
        const uri = await captureRef(captureViewRef, {
          format: 'png',
          quality: 1,
          width: 256,
          height: 256,
        });
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        await applyProfileImageDataUrl(`data:image/png;base64,${base64}`);
      } catch (err) {
        setAvatarError(
          nativeMediaUnavailableMessage(err) ||
            'Could not apply this avatar. Try again or upload your own.',
        );
      } finally {
        setCapturePresetSvg(null);
      }
    })();
  }, [capturePresetSvg, applyProfileImageDataUrl]);

  async function handlePickImage() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setAvatarError('Photo library access is required to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const validationError = validateAvatarAsset(asset);
      if (validationError) {
        setAvatarError(validationError);
        return;
      }

      setSelectedPresetId(null);
      await applyProfileImageDataUrl(assetToDataUrl(asset));
    } catch (err) {
      setAvatarError(nativeMediaUnavailableMessage(err));
    }
  }

  function handlePresetSelect(presetId: string, svg: string) {
    if (avatarBusy) return;
    setSelectedPresetId(presetId);
    setAvatarError(null);
    setCapturePresetSvg(svg);
  }

  async function handleSaveName() {
    if (!user) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const trimmed = name.trim();
    const { firstName, lastName } = splitDisplayName(trimmed);

    try {
      await user.update({ firstName, lastName });
      await updateProfile(trimmed ? { name: trimmed } : {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View>
        <ThemedText type="bodySemiBold">Profile</ThemedText>
        <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
          Your avatar syncs across devices via your account.
        </ThemedText>
      </View>

      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.secondaryMuted }]}>
              <ThemedText style={{ fontFamily: Typography.fontBold, fontSize: Typography.sizes.xl }}>
                {initial}
              </ThemedText>
            </View>
          )}
          {avatarBusy ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </View>
        <View style={styles.avatarMeta}>
          <BetaBadge />
          <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: Spacing.xs }}>
            Pick a Rambleio icon or upload your own photo.
          </ThemedText>
        </View>
      </View>

      {avatarError ? (
        <ThemedText type="caption" style={{ color: '#b91c1c' }}>
          {avatarError}
        </ThemedText>
      ) : null}

      <View>
        <ThemedText type="bodyMed" style={styles.sectionLabel}>
          Rambleio icons
        </ThemedText>
        <View style={styles.presetGrid}>
          {RAMBLEIO_AVATAR_PRESETS.map((preset) => {
            const selected = selectedPresetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                disabled={avatarBusy}
                onPress={() => handlePresetSelect(preset.id, preset.svg)}
                style={[
                  styles.presetCell,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primaryMuted : colors.backgroundCard,
                  },
                ]}
              >
                <SvgXml xml={preset.svg} width={48} height={48} />
                <ThemedText type="caption" numberOfLines={1} style={styles.presetLabel}>
                  {preset.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        disabled={avatarBusy}
        onPress={() => void handlePickImage()}
        style={[
          styles.uploadButton,
          { borderColor: colors.primary, opacity: avatarBusy ? 0.5 : 1 },
        ]}
      >
        <ThemedText type="bodyMed" style={{ color: colors.primary }}>
          Upload your own image
        </ThemedText>
      </Pressable>
      <ThemedText type="caption" style={{ color: colors.textMuted }}>
        JPEG, PNG, WebP or GIF · max 5 MB
      </ThemedText>

      <View style={[styles.section, { borderTopColor: colors.border }]}>
        <ThemedText type="bodyMed" style={styles.fieldLabel}>
          Display name
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundCard },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          maxLength={80}
          editable={!saving}
        />

        <ThemedText type="bodyMed" style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
          Email
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            styles.readOnlyInput,
            { color: colors.textMuted, borderColor: colors.border, backgroundColor: colors.backgroundMuted },
          ]}
          value={email}
          editable={false}
        />
        <ThemedText type="caption" style={{ color: colors.textMuted, marginTop: Spacing.xs }}>
          Email is managed by your sign-in provider.
        </ThemedText>

        {saveError ? (
          <ThemedText type="caption" style={{ color: '#b91c1c', marginTop: Spacing.sm }}>
            {saveError}
          </ThemedText>
        ) : null}

        <View style={styles.saveRow}>
          <Pressable
            onPress={() => void handleSaveName()}
            disabled={saving || !user}
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary, opacity: saving || !user ? 0.5 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <ThemedText type="bodyMed" style={{ color: colors.textInverse }}>
                Save name
              </ThemedText>
            )}
          </Pressable>
          {saved ? (
            <ThemedText type="caption" style={{ color: colors.success }}>
              Saved
            </ThemedText>
          ) : null}
        </View>
      </View>

      {capturePresetSvg ? (
        <View ref={captureViewRef} style={styles.captureView} collapsable={false}>
          <SvgXml xml={capturePresetSvg} width={256} height={256} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMeta: { flex: 1, minWidth: 0 },
  sectionLabel: { marginBottom: Spacing.sm },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  presetCell: {
    width: '30%',
    flexGrow: 1,
    maxWidth: '33%',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  presetLabel: { textAlign: 'center' },
  uploadButton: {
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  section: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { marginBottom: Spacing.xs },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
  },
  readOnlyInput: {},
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minWidth: 120,
    alignItems: 'center',
  },
  captureView: {
    position: 'absolute',
    left: -9999,
    width: 256,
    height: 256,
    opacity: 0,
  },
});
