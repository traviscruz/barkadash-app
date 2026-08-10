import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useDeviceColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  paper: string;
  paperDim: string;
  card: string;
  cardBorder: string;
  rule: string;
  ink: string;
  inkSoft: string;
  primary: string;
  tealDark: string;
  emerald: string;
  sky: string;
  sun: string;
  coral: string;
  tape: string;
  tapeBlue: string;
  statusBar: 'light-content' | 'dark-content';
  navBg: string;
  pillBg: string;
  pillBorder: string;
  subtleBg: string;
  tealAccent: string;
  orangeAccent: string;
  redAccent: string;
  lightOrangeBg: string;
  lightRedBg: string;
  lightGreenBg: string;
  lightBlueBg: string;
  good: string;
  mapGreen: string;
  skyDeep: string;
}

export const LightThemeColors: ThemeColors = {
  paper: '#FAF8F5',
  paperDim: '#F0ECE3',
  card: '#FFFFFF',
  cardBorder: '#EAE4D7',
  rule: '#EAE4D7',
  ink: '#1A1D2D',
  inkSoft: '#6E738A',
  primary: '#2A8563',
  tealDark: '#1F4E67',
  emerald: '#2A8563',
  sky: '#4F86C6',
  sun: '#F5A65B',
  coral: '#2A8563',
  tape: '#F3D382',
  tapeBlue: '#9BC4CB',
  statusBar: 'dark-content',
  navBg: '#FAF8F5',
  pillBg: 'rgba(255, 255, 255, 0.92)',
  pillBorder: 'rgba(225, 220, 210, 0.75)',
  subtleBg: '#F5F2EA',
  tealAccent: '#3B7A9E',
  orangeAccent: '#F0A93E',
  redAccent: '#E2604A',
  lightOrangeBg: '#FDEBD3',
  lightRedBg: '#FBE7E1',
  lightGreenBg: '#E4F0EA',
  lightBlueBg: '#E4F0F4',
  good: '#3A8E71',
  mapGreen: '#2E9E5B',
  skyDeep: '#284E7D',
};

export const DarkThemeColors: ThemeColors = {
  paper: '#121212',
  paperDim: '#1C1C1E',
  card: '#1C1C1E',
  cardBorder: '#2C2C2E',
  rule: '#2C2C2E',
  ink: '#F2F2F7',
  inkSoft: '#98989D',
  primary: '#34D399',
  tealDark: '#38BDF8',
  emerald: '#34D399',
  sky: '#60A5FA',
  sun: '#FBBF24',
  coral: '#F87171',
  tape: '#D97706',
  tapeBlue: '#0284C7',
  statusBar: 'light-content',
  navBg: '#121212',
  pillBg: 'rgba(28, 28, 30, 0.94)',
  pillBorder: 'rgba(44, 44, 46, 0.8)',
  subtleBg: '#2C2C2E',
  tealAccent: '#38BDF8',
  orangeAccent: '#FBBF24',
  redAccent: '#F87171',
  lightOrangeBg: '#3A2510',
  lightRedBg: '#3A1818',
  lightGreenBg: '#133528',
  lightBlueBg: '#153042',
  good: '#34D399',
  mapGreen: '#34D399',
  skyDeep: '#1E40AF',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: ThemeColors;
}

const STORAGE_KEY = '@barkadash_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: () => {},
  isDark: false,
  colors: LightThemeColors,
});

const getSystemScheme = (): 'light' | 'dark' => {
  const current = Appearance.getColorScheme();
  return current === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hookScheme = useDeviceColorScheme();
  const [deviceColorScheme, setDeviceColorScheme] = useState<'light' | 'dark'>(getSystemScheme());
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    // Initial sync with OS Appearance
    setDeviceColorScheme(getSystemScheme());

    // Listen for live OS theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setDeviceColorScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    // Load persisted theme preference from AsyncStorage
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch(() => {});

    return () => subscription.remove();
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  };

  const detectedOsMode = (hookScheme === 'dark' || hookScheme === 'light')
    ? hookScheme
    : (deviceColorScheme || getSystemScheme());

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && detectedOsMode === 'dark');

  const colors = isDark ? DarkThemeColors : LightThemeColors;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
