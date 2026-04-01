import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ---------------------------------------------------------------------------
// Preset palette — curated for route visualisation
// ---------------------------------------------------------------------------

const PRESETS: string[] = [
  // Greens (positive / fast / descent)
  '#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#66BB6A', '#A5D6A7',
  // Teals / Cyans
  '#004D40', '#00695C', '#00897B', '#26A69A', '#4DB6AC', '#80CBC4',
  // Blues
  '#0D47A1', '#1565C0', '#1976D2', '#2196F3', '#64B5F6', '#BBDEFB',
  // Greys (neutral / flat)
  '#212121', '#424242', '#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0',
  // Oranges / Ambers
  '#BF360C', '#E64A19', '#FF7043', '#FF9800', '#FFC107', '#FFD54F',
  // Reds (negative / slow / ascent)
  '#7F0000', '#B71C1C', '#C62828', '#D32F2F', '#E53935', '#EF9A9A',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

function normaliseHex(input: string): string {
  const s = input.trim().toUpperCase();
  return s.startsWith('#') ? s : `#${s}`;
}

// ---------------------------------------------------------------------------
// RouteColourPicker
// ---------------------------------------------------------------------------

interface RouteColourPickerProps {
  /** Human-readable label, e.g. "Positive (green)" */
  label: string;
  /** Current hex colour, e.g. "#43A047" */
  colour: string;
  /** Called with the new hex string only when the user confirms. */
  onChange: (hex: string) => void;
}

/**
 * A tappable colour swatch that opens a modal picker. The picker provides:
 * - A large real-time colour preview
 * - A hex TextInput for precision entry
 * - A curated 6×6 preset grid spanning greens → teals → blues → greys → oranges → reds
 * - Cancel / Done buttons (Done is disabled for invalid hex)
 */
export function RouteColourPicker({ label, colour, onChange }: RouteColourPickerProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(colour);
  const [inputText, setInputText] = useState(colour);

  const handleOpen = () => {
    setDraft(colour);
    setInputText(colour);
    setOpen(true);
  };

  const handleSelect = (hex: string) => {
    setDraft(hex);
    setInputText(hex);
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const normalised = normaliseHex(text);
    if (isValidHex(normalised)) setDraft(normalised);
  };

  const handleDone = () => {
    const normalised = normaliseHex(inputText);
    if (isValidHex(normalised)) {
      onChange(normalised);
    }
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const inputValid = isValidHex(normaliseHex(inputText));

  return (
    <>
      {/* Inline swatch trigger */}
      <Pressable style={styles.trigger} onPress={handleOpen} hitSlop={8}>
        <View
          style={[
            styles.triggerSwatch,
            { backgroundColor: colour, borderColor: colors.border },
          ]}
        />
        <View style={styles.triggerText}>
          <Text style={[styles.triggerLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.triggerHex, { color: colors.textMuted }]}>{colour}</Text>
        </View>
      </Pressable>

      {/* Picker modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={handleCancel}>
        <Pressable style={styles.backdrop} onPress={handleCancel}>
          {/* Inner Pressable prevents taps inside the card from closing it */}
          <Pressable
            style={[
              styles.card,
              { backgroundColor: colors.backgroundCard, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {label}
            </Text>

            {/* Preview */}
            <View
              style={[
                styles.preview,
                { backgroundColor: draft, borderColor: colors.border },
              ]}
            />

            {/* Hex input */}
            <TextInput
              style={[
                styles.hexInput,
                {
                  color: colors.text,
                  borderColor: inputValid ? colors.border : '#E53935',
                  backgroundColor: colors.background,
                  fontFamily: Typography.fontRegular,
                },
              ]}
              value={inputText}
              onChangeText={handleTextChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              placeholder="#000000"
              placeholderTextColor={colors.textMuted}
            />

            {/* Preset grid */}
            <View style={styles.grid}>
              {PRESETS.map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => handleSelect(hex)}
                  style={[
                    styles.presetSwatch,
                    {
                      backgroundColor: hex,
                      borderColor: draft === hex ? colors.text : 'transparent',
                      borderWidth: draft === hex ? 2 : 1,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.btn, { borderColor: colors.border }]}
                onPress={handleCancel}
              >
                <Text style={[styles.btnText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  { backgroundColor: inputValid ? colors.primary : colors.border },
                ]}
                onPress={handleDone}
                disabled={!inputValid}
              >
                <Text style={[styles.btnText, styles.btnTextPrimary]}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const SWATCH_SIZE = 36;
const PRESET_SIZE = 36;
const GRID_COLUMNS = 6;

const styles = StyleSheet.create({
  // Trigger row
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  triggerSwatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  triggerText: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  triggerHex: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
    marginTop: 2,
  },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontMedium,
    marginBottom: Spacing.xs,
  },

  // Colour preview
  preview: {
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  // Hex input
  hexInput: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: Typography.sizes.base,
    letterSpacing: 1,
  },

  // Preset grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
    marginVertical: Spacing.xs,
  },
  presetSwatch: {
    width: PRESET_SIZE,
    height: PRESET_SIZE,
    borderRadius: Radius.sm,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  btnTextPrimary: {
    color: '#fff',
  },
});
