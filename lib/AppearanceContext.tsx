import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppearancePrefs,
  FONT_SCALES,
  FontSizeKey,
  THEMES,
  ThemeColors,
  ThemeId,
  TypographyScale,
  loadAppearancePrefs,
  saveAppearancePrefs,
} from './appearanceStore';

interface AppearanceContextValue {
  themeId: ThemeId;
  fontSize: FontSizeKey;
  theme: ThemeColors;
  typography: TypographyScale;
  setThemeId: (id: ThemeId) => Promise<void>;
  setFontSize: (size: FontSizeKey) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('hunter-neon');
  const [fontSize, setFontSizeState] = useState<FontSizeKey>('default');

  useEffect(() => {
    let mounted = true;
    loadAppearancePrefs().then((prefs) => {
      if (mounted) {
        setThemeIdState(prefs.themeId);
        setFontSizeState(prefs.fontSize);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeId = async (id: ThemeId) => {
    setThemeIdState(id);
    await saveAppearancePrefs({ themeId: id, fontSize });
  };

  const setFontSize = async (size: FontSizeKey) => {
    setFontSizeState(size);
    await saveAppearancePrefs({ themeId, fontSize: size });
  };

  const theme = THEMES[themeId]?.colors ?? THEMES['hunter-neon'].colors;
  const typography = FONT_SCALES[fontSize] ?? FONT_SCALES.default;

  return (
    <AppearanceContext.Provider
      value={{
        themeId,
        fontSize,
        theme,
        typography,
        setThemeId,
        setFontSize,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    // Provide a safe fallback if used outside provider, though it should always be inside provider
    return {
      themeId: 'hunter-neon',
      fontSize: 'default',
      theme: THEMES['hunter-neon'].colors,
      typography: FONT_SCALES.default,
      setThemeId: async () => {},
      setFontSize: async () => {},
    };
  }
  return ctx;
}

const COLOR_TOKEN_BY_LEGACY_HEX: Record<string, keyof ThemeColors> = {
  '#fff': 'textPrimary',
  '#040b14': 'background', '#050b14': 'background',
  '#071626': 'surface', '#071810': 'surface', '#091828': 'surface', '#091827': 'surface',
  '#0a1d30': 'surfaceAlt', '#0b1d30': 'surfaceAlt', '#0b1e30': 'surfaceAlt', '#0b233a': 'surfaceAlt',
  '#0c1f33': 'surfaceAlt', '#0e2035': 'surfaceAlt', '#102030': 'border', '#102438': 'border',
  '#ffffff': 'textPrimary', '#f5e6e8': 'textPrimary', '#f0f0f0': 'textPrimary', '#e6f6ff': 'textPrimary',
  '#c8dff0': 'textPrimary', '#d9eaf5': 'textPrimary', '#a8c5df': 'textPrimary',
  '#7094b2': 'textSecondary', '#4e7392': 'textSecondary', '#4f7288': 'textSecondary', '#557c9c': 'textSecondary',
  '#527c9c': 'textSecondary', '#557f9f': 'textSecondary', '#5f88a9': 'textSecondary', '#7fa3bf': 'textSecondary',
  '#00f3ff': 'accent', '#00dce8': 'accent', '#00cbd4': 'accent', '#38ef7d': 'success', '#22c99a': 'success', '#52b788': 'success', '#6fcf97': 'success',
  '#fbb03b': 'warning', '#f2c94c': 'warning', '#f4a261': 'warning', '#d97706': 'warning',
  '#ff5376': 'error', '#eb5757': 'error', '#e63946': 'error', '#dc2626': 'error',
  '#c084fc': 'purple', '#bb86fc': 'purple', '#d4a5b5': 'purple', '#7c3aed': 'purple',
  '#5686a4': 'textSecondary', '#7197aa': 'textSecondary',
  '#163b5e': 'border', '#183652': 'border', '#183654': 'border', '#1c3d5e': 'border', '#1a3c5e': 'border',
  '#00f3ff22': 'accentDim',
};

function retintStyleValue(
  value: unknown,
  theme: ThemeColors,
  typographyScale: number,
  property = '',
  styleName = ''
): unknown {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    const styleLabel = styleName.toLowerCase();
    if (styleLabel.includes('input')) {
      if (property === 'backgroundColor') return theme.inputBackground;
      if (property.toLowerCase().includes('border')) return theme.inputBorder;
      if (property === 'color') return theme.textPrimary;
    }
    if (property.toLowerCase().includes('border')) {
      if (/complete|success|done/.test(styleLabel)) return theme.success;
      if (/today|active|selected/.test(styleLabel)) return theme.borderActive;
      if (/error|danger|failed/.test(styleLabel)) return theme.error;
      if (/warning|fallback/.test(styleLabel)) return theme.warning;
    }
    const token = COLOR_TOKEN_BY_LEGACY_HEX[normalized];
    if (
      property === 'color' &&
      token === 'textPrimary' &&
      /primary|submit|confirm|send|start|finish/.test(styleLabel)
    ) {
      return theme.buttonText;
    }
    if (property === 'color' && /btn|button|action|send|submit|confirm|start/.test(styleLabel) && /^#[\da-f]{6}$/i.test(normalized)) {
      const red = parseInt(normalized.slice(1, 3), 16);
      const green = parseInt(normalized.slice(3, 5), 16);
      const blue = parseInt(normalized.slice(5, 7), 16);
      const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
      if (brightness < 80) return theme.buttonText;
    }
    if (token) {
      const normalizedProperty = property.toLowerCase();
      if (normalizedProperty === 'backgroundcolor') {
        if (token === 'textPrimary') return theme.surface;
        if (token === 'textSecondary') return theme.surfaceAlt;
      }
      if (normalizedProperty === 'color' || normalizedProperty.includes('placeholder')) {
        if (token === 'background' || token === 'surface' || token === 'surfaceAlt' || token === 'inputBackground' || token === 'inputBorder' || token === 'border') {
          return theme.textSecondary;
        }
      }
      return theme[token];
    }

    const rgba = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (rgba) {
      const [, r, g, b, alpha = '1'] = rgba;
      const rgb = `${Number(r)},${Number(g)},${Number(b)}`;
      const rgbaToken: Record<string, keyof ThemeColors> = {
        '0,243,255': 'accent', '0,220,232': 'accent', '0,217,232': 'accent',
        '192,132,252': 'purple', '56,239,125': 'success',
        '34,201,154': 'success', '255,83,118': 'error', '251,176,59': 'warning',
      };
      const rgbaColor = rgbaToken[rgb];
      if (rgbaColor) {
        const hex = theme[rgbaColor];
        const converted = hex.length === 9 ? hex.slice(1, 7) : hex.slice(1);
        const red = parseInt(converted.slice(0, 2), 16);
        const green = parseInt(converted.slice(2, 4), 16);
        const blue = parseInt(converted.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      }
    }

    const withAlpha = normalized.match(/^(#[\da-f]{6})([\da-f]{2})$/i);
    if (withAlpha) {
      const alphaToken = COLOR_TOKEN_BY_LEGACY_HEX[withAlpha[1]];
      if (alphaToken && alphaToken !== 'accentDim') return `${theme[alphaToken]}${withAlpha[2]}`;
    }
    if (/^#[\da-f]{6}$/i.test(normalized)) {
      const red = parseInt(normalized.slice(1, 3), 16);
      const green = parseInt(normalized.slice(3, 5), 16);
      const blue = parseInt(normalized.slice(5, 7), 16);
      const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
      if (property.toLowerCase().includes('border')) return theme.border;
      if (property.toLowerCase().includes('background') && brightness < 105) {
        return brightness < 24 ? theme.background : theme.surfaceAlt;
      }
      if ((property === 'color' || property.toLowerCase().includes('placeholder')) && brightness < 80) {
        return theme.textSecondary;
      }
      if (property === 'color' && brightness > 235) return theme.textPrimary;
      if (property === 'color') {
        const max = Math.max(red, green, blue) / 255;
        const min = Math.min(red, green, blue) / 255;
        const delta = max - min;
        if (delta > 0.18) {
          let hue = 0;
          if (max === red / 255) hue = ((green - blue) / 255 / delta) % 6;
          else if (max === green / 255) hue = (blue - red) / 255 / delta + 2;
          else hue = (red - green) / 255 / delta + 4;
          hue = (hue * 60 + 360) % 360;
          if (hue < 18 || hue >= 345) return theme.error;
          if (hue < 65) return theme.warning;
          if (hue < 165) return theme.success;
          if (hue < 265) return theme.accent;
          return theme.purple;
        }
      }
      if (property === 'color' || property.toLowerCase().includes('placeholder')) {
        return theme.textSecondary;
      }
    }
    return value;
  }
  if (typeof value === 'number' && (property === 'fontSize' || property === 'lineHeight')) {
    return Math.round(value * typographyScale * 10) / 10;
  }
  if (Array.isArray(value)) return value.map((item) => retintStyleValue(item, theme, typographyScale, property, styleName));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        retintStyleValue(item, theme, typographyScale, key, styleName || key),
      ])
    );
  }
  return value;
}

/** Recolors legacy StyleSheet definitions using the active shared theme tokens. */
export function useThemedStyles<T extends object>(styles: T): T {
  const { theme, typography } = useAppearance();
  const typographyScale = typography.body / FONT_SCALES.default.body;
  return useMemo(
    () => retintStyleValue(styles, theme, typographyScale) as T,
    [styles, theme, typographyScale]
  );
}
