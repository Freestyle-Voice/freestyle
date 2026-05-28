import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#60646C",
    textTertiary: "#9CA3AF",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    primary: "#208AEF",
    primaryLight: "#E6F4FE",
    danger: "#EF4444",
    dangerLight: "#FEE2E2",
    success: "#22C55E",
    successLight: "#DCFCE7",
    warning: "#F59E0B",
    border: "#E5E7EB",
    cardBackground: "#FFFFFF",
  },
  dark: {
    text: "#ffffff",
    textSecondary: "#B0B4BA",
    textTertiary: "#6B7280",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    primary: "#208AEF",
    primaryLight: "#1A2A3D",
    danger: "#EF4444",
    dangerLight: "#3D1A1A",
    success: "#22C55E",
    successLight: "#1A3D2A",
    warning: "#F59E0B",
    border: "#2E3135",
    cardBackground: "#161618",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
