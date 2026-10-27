import { useThemedStyles } from '../lib/AppearanceContext';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import { useAppearance } from '../lib/AppearanceContext';
import { FONT_SCALES, FontSizeKey, THEMES, ThemeId } from '../lib/appearanceStore';

const THEME_OPTIONS: { id: ThemeId; title: string; subtitle: string; previewBadge: string }[] = [
  {
    id: 'hunter-neon',
    title: 'Hunter Neon',
    subtitle: 'Classic dark navy HUD with high-contrast cyan and purple highlights.',
    previewBadge: 'CYAN ACCENT',
  },
  {
    id: 'obsidian',
    title: 'Obsidian',
    subtitle: 'Restrained, stealthy monochrome with grayscale tone mapping.',
    previewBadge: 'MONOCHROME',
  },
  {
    id: 'crimson',
    title: 'Crimson Dungeon',
    subtitle: 'Intense red dungeon raid styling with deep shadow surfaces.',
    previewBadge: 'CRIMSON ACCENT',
  },
  {
    id: 'light-training',
    title: 'Light Training',
    subtitle: 'High-contrast light interface optimized for daylight outdoor sessions.',
    previewBadge: 'LIGHT MODE',
  },
];

const FONT_OPTIONS: { key: FontSizeKey; label: string; desc: string }[] = [
  { key: 'small', label: 'Small', desc: 'Compact HUD layout fitting more data on screen.' },
  { key: 'default', label: 'Default', desc: 'Calibrated standard typography for HunterOS.' },
  { key: 'large', label: 'Large', desc: 'Enlarged text elements for enhanced legibility during workouts.' },
];

export default function SettingsScreen() {
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const { theme, themeId, fontSize, typography, setThemeId, setFontSize } = useAppearance();

  return (
    <View style={[themedStyles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          {/* Header */}
          <View style={themedStyles.header}>
            <Pressable
              style={[themedStyles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.back()}
            >
              <Text style={[themedStyles.backBtnText, { color: theme.accent, fontSize: typography.button }]}>
                ← BACK
              </Text>
            </Pressable>
            <View style={themedStyles.headerTextBlock}>
              <Text style={[themedStyles.systemTag, { color: theme.accent, fontSize: typography.label }]}>
                SYSTEM // CONFIGURATION
              </Text>
              <Text style={[themedStyles.pageTitle, { color: theme.textPrimary, fontSize: typography.heading }]}>
                APPEARANCE
              </Text>
            </View>
          </View>

          {/* Current Status Overview */}
          <View
            style={[
              themedStyles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: theme.accent, borderLeftWidth: 4 },
            ]}
          >
            <Text style={[themedStyles.cardTag, { color: theme.accent, fontSize: typography.label }]}>
              ACTIVE CONFIGURATION
            </Text>
            <View style={themedStyles.configRow}>
              <View>
                <Text style={[themedStyles.configLabel, { color: theme.textSecondary, fontSize: typography.caption }]}>
                  CURRENT THEME
                </Text>
                <Text style={[themedStyles.configValue, { color: theme.textPrimary, fontSize: typography.title }]}>
                  {THEMES[themeId]?.name ?? 'Hunter Neon'}
                </Text>
              </View>
              <View style={themedStyles.configDivider} />
              <View>
                <Text style={[themedStyles.configLabel, { color: theme.textSecondary, fontSize: typography.caption }]}>
                  TYPOGRAPHY
                </Text>
                <Text style={[themedStyles.configValue, { color: theme.accent, fontSize: typography.title }]}>
                  {fontSize.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Theme Selection */}
          <View style={themedStyles.section}>
            <Text style={[themedStyles.sectionHeading, { color: theme.accent, fontSize: typography.label }]}>
              SELECT VISUAL THEME
            </Text>
            <Text style={[themedStyles.sectionSub, { color: theme.textSecondary, fontSize: typography.caption }]}>
              Themes change surface tones, borders, and accents instantly across the system.
            </Text>

            <View style={themedStyles.optionsList}>
              {THEME_OPTIONS.map((opt) => {
                const isSelected = themeId === opt.id;
                const optTheme = THEMES[opt.id].colors;

                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      themedStyles.themeCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSelected ? theme.accent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setThemeId(opt.id)}
                  >
                    <View style={themedStyles.themeCardHeader}>
                      <View style={themedStyles.themeTitleRow}>
                        <View
                          style={[
                            themedStyles.radioCircle,
                            { borderColor: isSelected ? theme.accent : theme.border },
                          ]}
                        >
                          {isSelected && <View style={[themedStyles.radioFill, { backgroundColor: theme.accent }]} />}
                        </View>
                        <Text style={[themedStyles.themeCardTitle, { color: theme.textPrimary, fontSize: typography.title }]}>
                          {opt.title}
                        </Text>
                      </View>
                      <View
                        style={[
                          themedStyles.badge,
                          {
                            backgroundColor: isSelected ? theme.accentDim : theme.surfaceAlt,
                            borderColor: isSelected ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            themedStyles.badgeText,
                            { color: isSelected ? theme.accent : theme.textSecondary, fontSize: typography.label },
                          ]}
                        >
                          {isSelected ? '✓ ACTIVE' : opt.previewBadge}
                        </Text>
                      </View>
                    </View>

                    <Text style={[themedStyles.themeCardSub, { color: theme.textSecondary, fontSize: typography.body }]}>
                      {opt.subtitle}
                    </Text>

                    {/* Color Swatch Preview */}
                    <View style={themedStyles.swatchRow}>
                      <View style={[themedStyles.swatch, { backgroundColor: optTheme.background }]} />
                      <View style={[themedStyles.swatch, { backgroundColor: optTheme.surface }]} />
                      <View style={[themedStyles.swatch, { backgroundColor: optTheme.accent }]} />
                      <View style={[themedStyles.swatch, { backgroundColor: optTheme.border }]} />
                      <View style={[themedStyles.swatch, { backgroundColor: optTheme.purple }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Typography Scale Selection */}
          <View style={themedStyles.section}>
            <Text style={[themedStyles.sectionHeading, { color: theme.accent, fontSize: typography.label }]}>
              GLOBAL TYPOGRAPHY SCALE
            </Text>
            <Text style={[themedStyles.sectionSub, { color: theme.textSecondary, fontSize: typography.caption }]}>
              Adjust text scaling to ensure rapid scan-ability and readability in any environment.
            </Text>

            <View style={themedStyles.optionsList}>
              {FONT_OPTIONS.map((fOpt) => {
                const isSelected = fontSize === fOpt.key;
                const sampleScale = FONT_SCALES[fOpt.key];

                return (
                  <Pressable
                    key={fOpt.key}
                    style={[
                      themedStyles.fontCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSelected ? theme.accent : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setFontSize(fOpt.key)}
                  >
                    <View style={themedStyles.fontCardTop}>
                      <View style={themedStyles.themeTitleRow}>
                        <View
                          style={[
                            themedStyles.radioCircle,
                            { borderColor: isSelected ? theme.accent : theme.border },
                          ]}
                        >
                          {isSelected && <View style={[themedStyles.radioFill, { backgroundColor: theme.accent }]} />}
                        </View>
                        <Text style={[themedStyles.fontCardTitle, { color: theme.textPrimary, fontSize: typography.title }]}>
                          {fOpt.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          themedStyles.badge,
                          {
                            backgroundColor: isSelected ? theme.accentDim : theme.surfaceAlt,
                            borderColor: isSelected ? theme.accent : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            themedStyles.badgeText,
                            { color: isSelected ? theme.accent : theme.textSecondary, fontSize: typography.label },
                          ]}
                        >
                          {isSelected ? '✓ ACTIVE' : `${sampleScale.body}px BODY`}
                        </Text>
                      </View>
                    </View>

                    <Text style={[themedStyles.fontCardDesc, { color: theme.textSecondary, fontSize: typography.body }]}>
                      {fOpt.desc}
                    </Text>

                    {/* Live preview line at target scale */}
                    <View style={[themedStyles.sampleBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={[themedStyles.sampleTitle, { color: theme.textPrimary, fontSize: sampleScale.title }]}>
                        DIRECTIVE PREVIEW [{fOpt.label.toUpperCase()}]
                      </Text>
                      <Text style={[themedStyles.sampleBody, { color: theme.textSecondary, fontSize: sampleScale.body }]}>
                        Physical stats and mental stamina calibrate at 100% capacity.
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Interactive Live Component Preview */}
          <View style={themedStyles.section}>
            <Text style={[themedStyles.sectionHeading, { color: theme.accent, fontSize: typography.label }]}>
              LIVE COMPONENT PREVIEW
            </Text>
            <View
              style={[
                themedStyles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[themedStyles.cardTag, { color: theme.accent, fontSize: typography.label }]}>
                HUD SAMPLE CARD
              </Text>
              <Text style={[themedStyles.previewHeading, { color: theme.textPrimary, fontSize: typography.heading }]}>
                SHADOW WORKOUT PROTOCOL
              </Text>
              <Text style={[themedStyles.previewBody, { color: theme.textSecondary, fontSize: typography.body }]}>
                Verifying system contrast and typography hierarchy with current theme and scale settings.
              </Text>

              <View style={themedStyles.statusChipsRow}>
                <View style={[themedStyles.statusChip, { backgroundColor: `${theme.success}22`, borderColor: theme.success }]}>
                  <Text style={[themedStyles.statusChipText, { color: theme.success, fontSize: typography.label }]}>
                    ● SUCCESS (+80 XP)
                  </Text>
                </View>
                <View style={[themedStyles.statusChip, { backgroundColor: `${theme.warning}22`, borderColor: theme.warning }]}>
                  <Text style={[themedStyles.statusChipText, { color: theme.warning, fontSize: typography.label }]}>
                    ▲ WARNING
                  </Text>
                </View>
                <View style={[themedStyles.statusChip, { backgroundColor: `${theme.error}22`, borderColor: theme.error }]}>
                  <Text style={[themedStyles.statusChipText, { color: theme.error, fontSize: typography.label }]}>
                    ■ CRITICAL
                  </Text>
                </View>
              </View>

              <Pressable style={[themedStyles.previewButton, { backgroundColor: theme.accent }]}>
                <Text style={[themedStyles.previewButtonText, { color: theme.background, fontSize: typography.button }]}>
                  EXECUTE DIRECTIVE ➔
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
        <BottomNavigation active="system" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  backBtnText: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerTextBlock: {
    flex: 1,
  },
  systemTag: {
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  pageTitle: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTag: {
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  configDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#33415533',
  },
  configLabel: {
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  configValue: {
    fontWeight: '900',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionSub: {
    lineHeight: 16,
    marginBottom: 12,
  },
  optionsList: {
    gap: 10,
  },
  themeCard: {
    borderRadius: 12,
    padding: 14,
  },
  themeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  themeCardTitle: {
    fontWeight: '900',
  },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  themeCardSub: {
    lineHeight: 18,
    marginBottom: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swatch: {
    width: 24,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ffffff33',
  },
  fontCard: {
    borderRadius: 12,
    padding: 14,
  },
  fontCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fontCardTitle: {
    fontWeight: '900',
  },
  fontCardDesc: {
    lineHeight: 18,
    marginBottom: 10,
  },
  sampleBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  sampleTitle: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sampleBody: {
    lineHeight: 18,
  },
  previewHeading: {
    fontWeight: '900',
    marginBottom: 6,
  },
  previewBody: {
    lineHeight: 18,
    marginBottom: 12,
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  statusChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusChipText: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  previewButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewButtonText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
});
