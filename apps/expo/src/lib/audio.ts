import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";

export type MicPermissionStatus = "granted" | "denied" | "undetermined";

export async function checkMicPermission(): Promise<MicPermissionStatus> {
  const { status } = await AudioModule.getRecordingPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function requestMicPermission(): Promise<MicPermissionStatus> {
  const { status } = await AudioModule.requestRecordingPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function enableRecordingMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}

export async function disableRecordingMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
  });
}

export interface RecordingResult {
  uri: string;
  durationMs: number;
}

const MIN_RECORDING_DURATION_MS = 500;

export function isRecordingTooShort(durationMs: number): boolean {
  return durationMs < MIN_RECORDING_DURATION_MS;
}

export { RecordingPresets };
