import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getHistory,
  getHistoryStats,
  deleteHistoryEntry,
  type HistoryEntry,
  type HistoryStats,
} from "@/lib/db";

export default function HistoryScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [historyData, statsData] = await Promise.all([
      getHistory({ search: search || undefined }),
      getHistoryStats(),
    ]);
    setEntries(historyData);
    setStats(statsData);
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    loadData();
  }, [search, loadData]);

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData();
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr + "Z");
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const renderEntry = ({ item }: { item: HistoryEntry }) => {
    const displayText = item.cleaned_text || item.raw_text;
    const isExpanded = expandedId === item.id;

    return (
      <Pressable
        style={[
          styles.entryCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
      >
        <View style={styles.entryHeader}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTimeAgo(item.created_at)}
          </ThemedText>
          <View style={styles.entryMeta}>
            <ThemedText
              type="small"
              themeColor="textTertiary"
              style={styles.modelBadge}
            >
              {item.voice_model.split("/").pop()}
            </ThemedText>
            <ThemedText type="small" themeColor="textTertiary">
              {formatDuration(item.duration_ms)}
            </ThemedText>
          </View>
        </View>

        <ThemedText
          numberOfLines={isExpanded ? undefined : 3}
          style={styles.entryText}
        >
          {displayText}
        </ThemedText>

        {isExpanded && (
          <View style={styles.entryActions}>
            <Pressable
              style={[
                styles.entryAction,
                { backgroundColor: theme.primaryLight },
              ]}
              onPress={() => handleCopy(displayText)}
            >
              <Icon name="copy" size={14} color={theme.primary} />
              <ThemedText style={{ color: theme.primary, fontSize: 13 }}>
                Copy
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.entryAction,
                { backgroundColor: theme.dangerLight },
              ]}
              onPress={() => handleDelete(item.id)}
            >
              <Icon name="trash" size={14} color={theme.danger} />
              <ThemedText style={{ color: theme.danger, fontSize: 13 }}>
                Delete
              </ThemedText>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.header}>
        <ThemedText type="subtitle">History</ThemedText>
      </View>

      {stats && stats.total_sessions > 0 && (
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Sessions
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {stats.total_sessions}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Today
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {stats.today_sessions}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
            >
              Time saved
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {Math.round(stats.total_duration_ms / 1000)}s
            </ThemedText>
          </View>
        </View>
      )}

      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}
      >
        <Icon name="search" size={16} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search transcriptions..."
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="clock" size={48} color={theme.textTertiary} />
            <ThemedText
              themeColor="textSecondary"
              style={styles.emptyText}
            >
              No transcriptions yet
            </ThemedText>
            <ThemedText
              themeColor="textTertiary"
              style={styles.emptySubtext}
            >
              Go to the Record tab and start dictating
            </ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.two,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    gap: Spacing.two,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  entryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.two,
  },
  entryMeta: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  modelBadge: {
    fontSize: 11,
  },
  entryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  entryActions: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  entryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.six,
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
