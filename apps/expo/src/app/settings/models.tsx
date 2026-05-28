import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icon";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  addModelConfig,
  deleteModelConfig,
  getModelConfigs,
  setDefaultModel,
  type ModelConfig,
} from "@/lib/db";
import { hasApiKey, VOICE_MODELS, LLM_MODELS } from "@/lib/storage";

export default function ModelsScreen() {
  const theme = useTheme();
  const [voiceConfigs, setVoiceConfigs] = useState<ModelConfig[]>([]);
  const [llmConfigs, setLlmConfigs] = useState<ModelConfig[]>([]);
  const [availableVoice, setAvailableVoice] = useState<typeof VOICE_MODELS[number][]>([]);
  const [availableLLM, setAvailableLLM] = useState<typeof LLM_MODELS[number][]>([]);

  const loadData = useCallback(async () => {
    const [voice, llm] = await Promise.all([
      getModelConfigs("voice"),
      getModelConfigs("llm"),
    ]);
    setVoiceConfigs(voice);
    setLlmConfigs(llm);

    const configuredVoiceIds = new Set(voice.map((m) => m.model_id));
    const configuredLLMIds = new Set(llm.map((m) => m.model_id));

    const filteredVoice: typeof VOICE_MODELS[number][] = [];
    for (const model of VOICE_MODELS) {
      if (!configuredVoiceIds.has(model.model_id) && await hasApiKey(model.provider)) {
        filteredVoice.push(model);
      }
    }
    setAvailableVoice(filteredVoice);

    const filteredLLM: typeof LLM_MODELS[number][] = [];
    for (const model of LLM_MODELS) {
      if (!configuredLLMIds.has(model.model_id) && await hasApiKey(model.provider)) {
        filteredLLM.push(model);
      }
    }
    setAvailableLLM(filteredLLM);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (
    model: { provider: string; model_id: string; model_name: string },
    type: "voice" | "llm",
  ) => {
    const configs = type === "voice" ? voiceConfigs : llmConfigs;
    await addModelConfig({
      ...model,
      type,
      is_default: configs.length === 0,
    });
    loadData();
  };

  const handleSetDefault = async (id: string, type: "voice" | "llm") => {
    await setDefaultModel(id, type);
    loadData();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Remove Model", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteModelConfig(id);
          loadData();
        },
      },
    ]);
  };

  const renderModelCard = (config: ModelConfig, type: "voice" | "llm") => (
    <View
      key={config.id}
      style={[
        styles.modelCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: config.is_default ? theme.primary : theme.border,
          borderWidth: config.is_default ? 2 : 1,
        },
      ]}
    >
      <View style={styles.modelInfo}>
        <View style={styles.modelNameRow}>
          <ThemedText style={styles.modelName}>
            {config.model_name}
          </ThemedText>
          {config.is_default === 1 && (
            <View
              style={[
                styles.defaultBadge,
                { backgroundColor: theme.primaryLight },
              ]}
            >
              <ThemedText style={{ color: theme.primary, fontSize: 11 }}>
                Default
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {config.provider}
        </ThemedText>
      </View>
      <View style={styles.modelActions}>
        {config.is_default !== 1 && (
          <Pressable
            style={[
              styles.iconButton,
              { backgroundColor: theme.primaryLight },
            ]}
            onPress={() => handleSetDefault(config.id, type)}
          >
            <Icon name="check" size={14} color={theme.primary} />
          </Pressable>
        )}
        <Pressable
          style={[
            styles.iconButton,
            { backgroundColor: theme.dangerLight },
          ]}
          onPress={() => handleDelete(config.id, config.model_name)}
        >
          <Icon name="trash" size={14} color={theme.danger} />
        </Pressable>
      </View>
    </View>
  );

  const renderAvailableModel = (
    model: { provider: string; model_id: string; model_name: string },
    type: "voice" | "llm",
  ) => (
    <Pressable
      key={model.model_id}
      style={[
        styles.addModelRow,
        { backgroundColor: theme.backgroundElement },
      ]}
      onPress={() => handleAdd(model, type)}
    >
      <View style={styles.modelInfo}>
        <ThemedText style={{ fontSize: 14 }}>{model.model_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {model.provider}
        </ThemedText>
      </View>
      <Icon name="plus" size={18} color={theme.primary} />
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <ThemedText style={styles.sectionTitle}>Voice Models</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
        Select which model transcribes your speech.
      </ThemedText>

      {voiceConfigs.map((c) => renderModelCard(c, "voice"))}

      {availableVoice.length > 0 && (
        <>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.addHeader}
          >
            Available to add
          </ThemedText>
          {availableVoice.map((m) => renderAvailableModel(m, "voice"))}
        </>
      )}

      <View
        style={[styles.divider, { backgroundColor: theme.border }]}
      />

      <ThemedText style={styles.sectionTitle}>LLM Models</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionDesc}>
        Select which model cleans up your transcriptions.
      </ThemedText>

      {llmConfigs.map((c) => renderModelCard(c, "llm"))}

      {availableLLM.length > 0 && (
        <>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.addHeader}
          >
            Available to add
          </ThemedText>
          {availableLLM.map((m) => renderAvailableModel(m, "llm"))}
        </>
      )}

      {voiceConfigs.length === 0 && llmConfigs.length === 0 && (
        <View style={styles.emptyState}>
          <ThemedText themeColor="textSecondary" style={{ textAlign: "center" }}>
            Add API keys in Settings first, then models will appear here.
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  sectionDesc: { marginBottom: Spacing.three },
  modelCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  modelInfo: { flex: 1 },
  modelNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: 2,
  },
  modelName: { fontSize: 15, fontWeight: "600" },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modelActions: { flexDirection: "row", gap: Spacing.one },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addHeader: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
  },
  addModelRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.one,
  },
  divider: { height: 1, marginVertical: Spacing.four },
  emptyState: {
    paddingVertical: Spacing.five,
    alignItems: "center",
  },
});
