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
  getDictionary,
  addDictionaryEntry,
  deleteDictionaryEntry,
  type DictionaryEntry,
} from "@/lib/db";

export default function DictionaryScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const loadData = useCallback(async () => {
    const data = await getDictionary({ search: search || undefined });
    setEntries(data);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await addDictionaryEntry(newKey, newValue);
    setNewKey("");
    setNewValue("");
    setIsAdding(false);
    loadData();
  };

  const handleDelete = (id: string, key: string) => {
    Alert.alert("Delete Entry", `Remove "${key}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDictionaryEntry(id);
          loadData();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search dictionary..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
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
              Add Word Replacement
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
            placeholder="Word to match (e.g., reactjs)"
            placeholderTextColor={theme.textTertiary}
            value={newKey}
            onChangeText={setNewKey}
            autoCapitalize="none"
          />
          <TextInput
            style={[
              styles.formInput,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
            placeholder="Replace with (e.g., ReactJS)"
            placeholderTextColor={theme.textTertiary}
            value={newValue}
            onChangeText={setNewValue}
          />
          <Pressable
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleAdd}
          >
            <ThemedText style={{ color: "#FFF", fontWeight: "600" }}>
              Add Entry
            </ThemedText>
          </Pressable>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.entryRow,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.entryInfo}>
              <ThemedText style={{ fontWeight: "600" }}>
                {item.key}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {item.value}
              </ThemedText>
            </View>
            <View style={styles.entryMeta}>
              <ThemedText
                type="small"
                themeColor="textTertiary"
                style={{ fontSize: 11 }}
              >
                Used {item.usage_count}x
              </ThemedText>
              <Pressable
                onPress={() => handleDelete(item.id, item.key)}
                hitSlop={8}
              >
                <Icon name="trash" size={16} color={theme.danger} />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="book" size={40} color={theme.textTertiary} />
            <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              No dictionary entries yet
            </ThemedText>
            <ThemedText
              themeColor="textTertiary"
              type="small"
              style={{ textAlign: "center" }}
            >
              Add custom word replacements to improve transcription accuracy
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
    padding: Spacing.four,
    gap: Spacing.two,
  },
  searchBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInput: { fontSize: 14 },
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
  saveButton: {
    alignItems: "center",
    paddingVertical: Spacing.two + 2,
    borderRadius: 8,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  entryInfo: { flex: 1 },
  entryMeta: {
    alignItems: "flex-end",
    gap: Spacing.one,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
});
