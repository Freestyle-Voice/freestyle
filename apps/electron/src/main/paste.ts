import { exec, execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { clipboard } from "electron";
import { getNativeBinaryPath } from "./native-binary";

/** Timing breakdown for the most recent paste operation */
export interface PasteTiming {
  clipboardWriteMs: number;
  clipboardVerifyMs: number;
  keystrokeInjectMs: number;
  settleMs: number;
  clipboardRestoreMs: number;
  totalMs: number;
  method: "native" | "legacy";
  platform: string;
}

let lastPasteTiming: PasteTiming | null = null;

/** Returns the timing breakdown of the most recent paste, or null if none. */
export function getLastPasteTiming(): PasteTiming | null {
  return lastPasteTiming;
}

function execAsync(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

function execFileAsync(path: string, args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(path, args, (err) => {
      if (err) {
        const exitCode =
          typeof (err as { status?: unknown }).status === "number"
            ? (err as { status: number }).status
            : typeof err.code === "number"
              ? err.code
              : undefined;
        if (exitCode !== undefined) {
          resolve(exitCode);
        } else {
          reject(err);
        }
      } else {
        resolve(0);
      }
    });
  });
}

async function pasteMac(): Promise<"native" | "legacy"> {
  const binaryPath = getNativeBinaryPath("macos-fast-paste");
  if (binaryPath) {
    const exitCode = await execFileAsync(binaryPath);
    if (exitCode === 2) {
      console.warn(
        "[paste] No accessibility permission (native binary exit 2), falling back to osascript",
      );
      await execAsync(
        `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
      );
      return "legacy";
    } else if (exitCode !== 0) {
      throw new Error(`macos-fast-paste exited with code ${exitCode}`);
    }
    return "native";
  }
  await execAsync(
    `osascript -e 'tell application "System Events" to keystroke "v" using {command down}'`,
  );
  return "legacy";
}

async function pasteWindows(): Promise<"native" | "legacy"> {
  const binaryPath = getNativeBinaryPath("windows-fast-paste");
  if (binaryPath) {
    const exitCode = await execFileAsync(binaryPath);
    if (exitCode !== 0) {
      throw new Error(`windows-fast-paste exited with code ${exitCode}`);
    }
    return "native";
  }
  await execAsync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`,
  );
  return "legacy";
}

async function pasteLinux(): Promise<"native" | "legacy"> {
  const binaryPath = getNativeBinaryPath("linux-fast-paste");
  if (binaryPath) {
    const args: string[] = [];
    if (process.env.XDG_SESSION_TYPE === "wayland") {
      args.push("--portal");
    }
    const exitCode = await execFileAsync(binaryPath, args);
    if (exitCode !== 0) {
      console.warn(
        `[paste] Native paste failed (exit ${exitCode}), falling back to xdotool/wtype`,
      );
      await pasteLinuxLegacy();
      return "legacy";
    }
    return "native";
  }
  await pasteLinuxLegacy();
  return "legacy";
}

async function pasteLinuxLegacy(): Promise<void> {
  try {
    await execAsync("xdotool key ctrl+v");
  } catch {
    await execAsync("wtype -M ctrl -P v -p v -m ctrl");
  }
}

const PASTE_SETTLE_MS: Record<string, number> = {
  darwin: 150,
  win32: 150,
  linux: 100,
};

const PASTE_SETTLE_LEGACY_MS: Record<string, number> = {
  darwin: 500,
  win32: 600,
  linux: 300,
};

export async function pasteIntoFocusedApp(text: string): Promise<void> {
  if (!text?.trim()) return;

  const t0 = performance.now();

  // 1. Clipboard write
  const prior = clipboard.readText();
  clipboard.writeText(text);
  const tClipWrite = performance.now();

  // 2. Clipboard verify
  for (let i = 0; i < 5; i++) {
    if (clipboard.readText() === text) break;
    await new Promise((r) => setTimeout(r, 10));
    clipboard.writeText(text);
  }
  const tClipVerify = performance.now();

  let method: "native" | "legacy" = "legacy";

  try {
    // 3. Keystroke injection
    switch (process.platform) {
      case "darwin":
        method = await pasteMac();
        break;
      case "win32":
        method = await pasteWindows();
        break;
      default:
        method = await pasteLinux();
        break;
    }
    const tKeystroke = performance.now();

    // 4. Settle wait
    const settleTable =
      method === "native" ? PASTE_SETTLE_MS : PASTE_SETTLE_LEGACY_MS;
    const settleMs = settleTable[process.platform] ?? 500;
    await new Promise((r) => setTimeout(r, settleMs));
    const tSettle = performance.now();

    // 5. Clipboard restore
    clipboard.writeText(prior);
    const tRestore = performance.now();

    // Record timing breakdown
    lastPasteTiming = {
      clipboardWriteMs: round(tClipWrite - t0),
      clipboardVerifyMs: round(tClipVerify - tClipWrite),
      keystrokeInjectMs: round(tKeystroke - tClipVerify),
      settleMs: round(tSettle - tKeystroke),
      clipboardRestoreMs: round(tRestore - tSettle),
      totalMs: round(tRestore - t0),
      method,
      platform: process.platform,
    };

    // Log timing in dev mode
    if (process.env.NODE_ENV !== "production") {
      const t = lastPasteTiming;
      console.log(
        `[paste] ${t.method} | total: ${t.totalMs}ms | ` +
          `write: ${t.clipboardWriteMs}ms, verify: ${t.clipboardVerifyMs}ms, ` +
          `inject: ${t.keystrokeInjectMs}ms, settle: ${t.settleMs}ms, ` +
          `restore: ${t.clipboardRestoreMs}ms`,
      );
    }
  } catch (err) {
    clipboard.writeText(prior);
    throw err;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
