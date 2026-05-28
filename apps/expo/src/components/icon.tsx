import { StyleSheet, Text, View } from "react-native";

const ICONS: Record<string, string> = {
  mic: "🎙",
  clock: "🕐",
  settings: "⚙",
  copy: "📋",
  share: "↗",
  close: "✕",
  check: "✓",
  plus: "＋",
  trash: "🗑",
  search: "🔍",
  key: "🔑",
  eye: "👁",
  "eye-off": "◌",
  chevronRight: "›",
  globe: "🌐",
  cpu: "⚡",
  book: "📖",
  file: "📄",
  message: "💬",
  lock: "🔒",
  wand: "✦",
  languages: "🗣",
};

interface IconProps {
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 18, color }: IconProps) {
  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size * 0.85,
          lineHeight: size,
          width: size,
          height: size,
          color: color ?? "#000",
        },
      ]}
    >
      {ICONS[name] ?? "?"}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    textAlign: "center",
  },
});
