import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getSetting, setSetting } from "@/lib/db";
import { LANGUAGES } from "@/lib/storage";

export default function GeneralSettingsScreen() {
  const theme = useTheme();
  const [language, setLanguage] = useState("auto");
  const [llmCleanup, setLlmCleanup] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    async function load() {
      const lang = await getSetting("language");
      if (lang) setLanguage(lang);
      const cleanup = await getSetting("llm_cleanup");
      setLlmCleanup(cleanup === "true");
    }
    load();
  }, []);

  const handleLanguageChange = async (code: string) => {
    setLanguage(code);
    await setSetting("language", code);
    setShowLanguagePicker(false);
  };

  const handleCleanupToggle = async (value: boolean) => {
    setLlmCleanup(value);
    await setSetting("llm_cleanup", value ? "true" : "false");
  };

  const selectedLanguage =
    LANGUAGES.find((l) => l.code === language)?.name ?? "Auto Detect";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.settingCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}
      >
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingLabel}>Language</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Speech recognition language
            </ThemedText>
          </View>
          <Pressable
            style={[
              styles.dropdown,
              { backgroundColor: theme.backgroundElement },
            ]}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          >
            <ThemedText style={{ fontSize: 14 }}>{selectedLanguage}</ThemedText>
          </Pressable>
        </View>

        {showLanguagePicker && (
          <ScrollView
            style={[
              styles.pickerList,
              { borderTopColor: theme.border },
            ]}
            nestedScrollEnabled
          >
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[
                  styles.pickerItem,
                  language === lang.code && {
                    backgroundColor: theme.primaryLight,
                  },
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <ThemedText
                  style={[
                    { fontSize: 14 },
                    language === lang.code && { color: theme.primary },
                  ]}
                >
                  {lang.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View
        style={[
          styles.settingCard,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}
      >
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <ThemedText style={styles.settingLabel}>
              LLM Post-Processing
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Clean up transcriptions with an LLM (removes filler words, fixes
              grammar)
            </ThemedText>
          </View>
          <Switch
            value={llmCleanup}
            onValueChange={handleCleanupToggle}
            trackColor={{ false: theme.backgroundElement, true: theme.primary }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  settingCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    gap: Spacing.three,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  dropdown: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  pickerList: {
    borderTopWidth: 1,
    maxHeight: 300,
  },
  pickerItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
});
