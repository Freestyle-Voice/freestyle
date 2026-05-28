import { version } from "expo/package.json";
import { Image } from "expo-image";
import { StyleSheet, useColorScheme } from "react-native";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText
        type="code"
        themeColor="textSecondary"
        style={styles.versionText}
      >
        v{version}
      </ThemedText>
      <Image
        source={
          scheme === "dark"
            ? require("@/assets/images/expo-badge-white.png")
            : require("@/assets/images/expo-badge.png")
        }
        style={styles.badgeImage}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.five,
    alignItems: "center",
    gap: Spacing.two,
  },
  versionText: {
    textAlign: "center",
  },
  badgeImage: {
    width: 123,
    aspectRatio: 123 / 24,
  },
});
