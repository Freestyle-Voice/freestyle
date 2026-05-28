import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const FEEDBACK_TYPES = [
  { id: "general", label: "General" },
  { id: "bug", label: "Bug Report" },
  { id: "feature", label: "Feature Request" },
] as const;

export default function FeedbackScreen() {
  const theme = useTheme();
  const [type, setType] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = () => {
    if (!message.trim()) {
      Alert.alert("Required", "Please enter your feedback message.");
      return;
    }
    Alert.alert(
      "Thank you!",
      "Your feedback has been noted. In a future update, this will be sent to our servers.",
    );
    setMessage("");
    setEmail("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
      >
        <ThemedText type="small" themeColor="textSecondary">
          We'd love to hear from you. Let us know what's working and what could
          be better.
        </ThemedText>

        <View style={styles.typeRow}>
          {FEEDBACK_TYPES.map((ft) => (
            <Pressable
              key={ft.id}
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    type === ft.id ? theme.primary : theme.backgroundElement,
                },
              ]}
              onPress={() => setType(ft.id)}
            >
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: type === ft.id ? "#FFF" : theme.text,
                }}
              >
                {ft.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[
            styles.messageInput,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          placeholder="Your feedback..."
          placeholderTextColor={theme.textTertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TextInput
          style={[
            styles.emailInput,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          placeholder="Email (optional)"
          placeholderTextColor={theme.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Pressable
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
        >
          <ThemedText style={{ color: "#FFF", fontWeight: "600", fontSize: 15 }}>
            Send Feedback
          </ThemedText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    alignItems: "center",
  },
  messageInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    fontSize: 15,
    minHeight: 150,
  },
  emailInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
  },
  submitButton: {
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderRadius: 12,
  },
});
