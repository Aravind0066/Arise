/**
 * appearanceStore.ts
 * Defines the four HunterOS themes and three typography sizes.
 * Handles AsyncStorage persistence independently of the profile.
 *
 * Screens that consume this: app/settings.tsx (fully themed), app/_layout.tsx (provider).
 * All other existing screens retain hardcoded styles — see Step 11 migration notes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────
// 1. Theme IDs
// ─────────────────────────────────────────────────────────
export type ThemeId = 'hunter-neon' | 'obsidian' | 'crimson' | 'light-training';

export type FontSizeKey = 'small' | 'default' | 'large';

// ─────────────────────────────────────────────────────────
// 2. Semantic colour tokens
// ─────────────────────────────────────────────────────────
export interface ThemeColors {
  /** Page / screen background */
  background: string;
  /** Card / panel surface */
  surface: string;
  /** Slightly elevated surface (inputs, inner panels) */
  surfaceAlt: string;
  /** Input fill and outline */
  inputBackground: string;
  inputBorder: string;
  /** Primary action fill and its readable foreground */
  buttonBackground: string;
  buttonText: string;
  /** Primary readable text */
  textPrimary: string;
  /** Secondary / muted text */
  textSecondary: string;
  /** Accent — interactive elements, highlights */
  accent: string;
  /** Accent with low opacity for tinted backgrounds */
  accentDim: string;
  /** Border colour */
  border: string;
  /** Active / selected border */
  borderActive: string;
  /** Success colour */
  success: string;
  /** Warning colour */
  warning: string;
  /** Error / danger colour */
  error: string;
  /** Purple accent (rank badges, secondary accent) */
  purple: string;
  /** Status-bar style: 'light' or 'dark' */
  statusBar: 'light' | 'dark';
}

// ─────────────────────────────────────────────────────────
// 3. Typography scale
// ─────────────────────────────────────────────────────────
export interface TypographyScale {
  /** Large page title */
  heading: number;
  /** Section / card title */
  title: number;
  /** Body / paragraph text */
  body: number;
  /** Secondary / caption text */
  caption: number;
  /** Tiny label / badge text */
  label: number;
  /** Button text */
  button: number;
}

// ─────────────────────────────────────────────────────────
// 4. Theme definitions
// ─────────────────────────────────────────────────────────
export const THEMES: Record<ThemeId, { id: ThemeId; name: string; colors: ThemeColors }> = {
  'hunter-neon': {
    id: 'hunter-neon',
    name: 'Hunter Neon',
    colors: {
      background:   '#040b14',
      surface:      '#071626',
      surfaceAlt:   '#0c1f33',
      inputBackground: '#0c1f33',
      inputBorder:  '#163b5e',
      buttonBackground: '#00f3ff',
      buttonText:   '#02111d',
      textPrimary:  '#ffffff',
      textSecondary:'#7094b2',
      accent:       '#00f3ff',
      accentDim:    '#00f3ff22',
      border:       '#163b5e',
      borderActive: '#00f3ff',
      success:      '#38ef7d',
      warning:      '#fbb03b',
      error:        '#ff5376',
      purple:       '#c084fc',
      statusBar:    'light',
    },
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    colors: {
      background:   '#0d0d0d',
      surface:      '#181818',
      surfaceAlt:   '#222222',
      inputBackground: '#222222',
      inputBorder:  '#2e2e2e',
      buttonBackground: '#a3a3a3',
      buttonText:   '#0d0d0d',
      textPrimary:  '#f0f0f0',
      textSecondary:'#8a8a8a',
      accent:       '#a3a3a3',
      accentDim:    '#a3a3a322',
      border:       '#2e2e2e',
      borderActive: '#a3a3a3',
      success:      '#6fcf97',
      warning:      '#f2c94c',
      error:        '#eb5757',
      purple:       '#bb86fc',
      statusBar:    'light',
    },
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Dungeon',
    colors: {
      background:   '#0e0506',
      surface:      '#1a0b0d',
      surfaceAlt:   '#260f12',
      inputBackground: '#260f12',
      inputBorder:  '#3d1518',
      buttonBackground: '#e63946',
      buttonText:   '#ffffff',
      textPrimary:  '#f5e6e8',
      textSecondary:'#a07078',
      accent:       '#e63946',
      accentDim:    '#e6394622',
      border:       '#3d1518',
      borderActive: '#e63946',
      success:      '#52b788',
      warning:      '#f4a261',
      error:        '#e63946',
      purple:       '#d4a5b5',
      statusBar:    'light',
    },
  },
  'light-training': {
    id: 'light-training',
    name: 'Light Training',
    colors: {
      background:   '#f4f6f8',
      surface:      '#ffffff',
      surfaceAlt:   '#eef1f5',
      inputBackground: '#eef1f5',
      inputBorder:  '#cbd5e1',
      buttonBackground: '#0284c7',
      buttonText:   '#ffffff',
      textPrimary:  '#111827',
      textSecondary:'#6b7280',
      accent:       '#0284c7',
      accentDim:    '#0284c722',
      border:       '#cbd5e1',
      borderActive: '#0284c7',
      success:      '#16a34a',
      warning:      '#d97706',
      error:        '#dc2626',
      purple:       '#7c3aed',
      statusBar:    'dark',
    },
  },
};

// ─────────────────────────────────────────────────────────
// 5. Typography scales
// ─────────────────────────────────────────────────────────
export const FONT_SCALES: Record<FontSizeKey, TypographyScale> = {
  small: {
    heading: 18,
    title:   12,
    body:    11,
    caption: 9,
    label:   8,
    button:  10,
  },
  default: {
    heading: 22,
    title:   14,
    body:    13,
    caption: 11,
    label:   9,
    button:  12,
  },
  large: {
    heading: 26,
    title:   17,
    body:    15,
    caption: 13,
    label:   11,
    button:  14,
  },
};

// ─────────────────────────────────────────────────────────
// 6. Persistence
// ─────────────────────────────────────────────────────────
const APPEARANCE_KEY = 'hunteros.appearance.v1';

export interface AppearancePrefs {
  themeId: ThemeId;
  fontSize: FontSizeKey;
}

const DEFAULT_PREFS: AppearancePrefs = {
  themeId: 'hunter-neon',
  fontSize: 'default',
};

export async function loadAppearancePrefs(): Promise<AppearancePrefs> {
  try {
    const raw = await AsyncStorage.getItem(APPEARANCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
      return {
        themeId: parsed.themeId && parsed.themeId in THEMES ? parsed.themeId : DEFAULT_PREFS.themeId,
        fontSize: parsed.fontSize && parsed.fontSize in FONT_SCALES ? parsed.fontSize : DEFAULT_PREFS.fontSize,
      };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PREFS;
}

export async function saveAppearancePrefs(prefs: AppearancePrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Failed to save appearance prefs:', err);
  }
}
