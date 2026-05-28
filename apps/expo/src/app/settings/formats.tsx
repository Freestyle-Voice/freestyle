import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getFormatRules,
  addFormatRule,
  deleteFormatRule,
  type FormatRule,
} from "@/lib/db";

export default function FormatsScreen() {
  const theme = useTheme();
  const [rules, setRules] = useState<FormatRule[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  const loadData = useCallback(async () => {
    const data = await getFormatRules();
    setRules(data);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newPattern.trim() || !newInstructions.trim())
      return;
    await addFormatRule({
      label: newLabel,
      app_pattern: newPattern,
      instructions: newInstructions,
    });
    setNewLabel("");
    setNewPattern("");
    setNewInstructions("");
    setIsAdding(false);
    loadData();
  };

  const handleDelete = (id: string, label: string, isDefault: number) => {
    if (isDefault) {
      Alert.alert("Cannot Delete", "Default format rules cannot be deleted.");
      return;
    }
    Alert.alert("Delete Rule", `Remove "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFormatRule(id);
          loadData();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.toolbar}>
        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
          Format rules customize how transcriptions are cleaned based on context.
        </ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setIsAdding(true)}
        >
          <Icon name="plus" size={18} color="#FFF" />
        </Pressable>
      </View>

      {isAdding && (
        <View
          style={[
            styles.addForm,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
        >
          <View style={styles.addFormHeader}>
            <ThemedText style={{ fontWeight: "600" }}>
              Add Format Rule
            </ThemedText>
            <Pressable onPress={() => setIsAdding(false)}>
              <Icon name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.formInput,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Label (e.g., Email)"
            placeholderTextColor={theme.textTertiary}
            value={newLabel}
            onChangeText={setNewLabel}
          />
          <TextInput
            style={[
              styles.formInput,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Pattern (e.g., gmail.com|outlook)"
            placeholderTextColor={theme.textTertiary}
            value={newPattern}
            onChangeText={setNewPattern}
            autoCapitalize="none"
          />
          <TextInput
            style={[
              styles.formInput,
              styles.multilineInput,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Instructions for the LLM..."
            placeholderTextColor={theme.textTertiary}
            value={newInstructions}
            onChangeText={setNewInstructions}
            multiline
            numberOfLines={3}
          />
          <Pressable
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleAdd}
          >
            <ThemedText style={{ color: "#FFF", fontWeight: "600" }}>
              Add Rule
            </ThemedText>
          </Pressable>
        </View>
      )}

      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.ruleCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.ruleHeader}>
              <View style={styles.ruleNameRow}>
                <ThemedText style={{ fontWeight: "600" }}>
                  {item.label}
                </ThemedText>
                {item.is_default === 1 && (
                  <Icon name="lock" size={12} color={theme.textTertiary} />
                )}
              </View>
              {item.is_default !== 1 && (
                <Pressable
                  onPress={() =>
                    handleDelete(item.id, item.label, item.is_default)
                  }
                  hitSlop={8}
                >
                  <Icon name="trash" size={16} color={theme.danger} />
                </Pressable>
              )}
            </View>
            <ThemedText
              type="small"
              themeColor="textTertiary"
              style={{ marginBottom: 4 }}
            >
              {item.app_pattern}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.instructions}
            </ThemedText>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="file" size={40} color={theme.textTertiary} />
            <ThemedText themeColor="textSecondary">
              No format rules configured
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addForm: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.two,
  },
  addFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formInput: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveButton: {
    alignItems: "center",
    paddingVertical: Spacing.two + 2,
    borderRadius: 8,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  ruleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  ruleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
});
