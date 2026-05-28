import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Check, Eye, EyeOff, Key, Trash2 } from "lucide-react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getApiKey,
  setApiKey,
  deleteApiKey,
  PROVIDERS,
} from "@/lib/storage";

export default function ApiKeysScreen() {
  const theme = useTheme();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showKey, setShowKey] = useState(false);

  const loadKeys = useCallback(async () => {
    const loaded: Record<string, string> = {};
    for (const provider of PROVIDERS) {
      const key = await getApiKey(provider.id);
      if (key) loaded[provider.id] = key;
    }
    setKeys(loaded);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleSave = async (providerId: string) => {
    if (!inputValue.trim()) return;
    await setApiKey(providerId, inputValue.trim());
    setEditingProvider(null);
    setInputValue("");
    setShowKey(false);
    loadKeys();
  };

  const handleDelete = (providerId: string, providerName: string) => {
    Alert.alert(
      "Delete API Key",
      `Remove the ${providerName} API key?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteApiKey(providerId);
            loadKeys();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {PROVIDERS.map((provider) => {
        const hasKey = !!keys[provider.id];
        const isEditing = editingProvider === provider.id;

        return (
          <View
            key={provider.id}
            style={[
              styles.providerCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.providerHeader}>
              <View style={styles.providerInfo}>
                <View style={styles.providerNameRow}>
                  <ThemedText style={styles.providerName}>
                    {provider.name}
                  </ThemedText>
                  {hasKey && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: theme.successLight },
                      ]}
                    >
                      <Check size={10} color={theme.success} />
                      <ThemedText
                        style={{ color: theme.success, fontSize: 11 }}
                      >
                        Configured
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {provider.description}
                </ThemedText>
              </View>
            </View>

            {isEditing ? (
              <View style={styles.editSection}>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={provider.keyPlaceholder}
                    placeholderTextColor={theme.textTertiary}
                    value={inputValue}
                    onChangeText={setInputValue}
                    secureTextEntry={!showKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setShowKey(!showKey)}>
                    {showKey ? (
                      <EyeOff size={18} color={theme.textSecondary} />
                    ) : (
                      <Eye size={18} color={theme.textSecondary} />
                    )}
                  </Pressable>
                </View>
                <View style={styles.editActions}>
                  <Pressable
                    style={[
                      styles.editButton,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                    onPress={() => {
                      setEditingProvider(null);
                      setInputValue("");
                      setShowKey(false);
                    }}
                  >
                    <ThemedText style={{ fontSize: 14 }}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.editButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleSave(provider.id)}
                  >
                    <ThemedText style={{ color: "#FFF", fontSize: 14 }}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <Pressable
                  style={[
                    styles.configButton,
                    {
                      backgroundColor: hasKey
                        ? theme.backgroundElement
                        : theme.primary,
                    },
                  ]}
                  onPress={() => {
                    setEditingProvider(provider.id);
                    setInputValue(keys[provider.id] ?? "");
                    setShowKey(false);
                  }}
                >
                  <Key
                    size={14}
                    color={hasKey ? theme.text : "#FFF"}
                  />
                  <ThemedText
                    style={{
                      fontSize: 13,
                      color: hasKey ? theme.text : "#FFF",
                    }}
                  >
                    {hasKey ? "Update Key" : "Add Key"}
                  </ThemedText>
                </Pressable>
                {hasKey && (
                  <Pressable
                    style={[
                      styles.deleteButton,
                      { backgroundColor: theme.dangerLight },
                    ]}
                    onPress={() => handleDelete(provider.id, provider.name)}
                  >
                    <Trash2 size={14} color={theme.danger} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  providerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.two,
  },
  providerInfo: { flex: 1 },
  providerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: 2,
  },
  providerName: { fontSize: 16, fontWeight: "600" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  editSection: { gap: Spacing.two },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  input: { flex: 1, fontSize: 14 },
  editActions: { flexDirection: "row", gap: Spacing.two, justifyContent: "flex-end" },
  editButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  configButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  deleteButton: {
    padding: Spacing.two,
    borderRadius: 8,
  },
});
