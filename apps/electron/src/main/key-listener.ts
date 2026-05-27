/**
 * Native Key Listener
 *
 * Wraps the platform-specific native key listener binary. Spawns the binary
 * as a child process and parses its stdout for key events.
 *
 * Replaces the node-global-key-listener npm package with purpose-built
 * native binaries that provide:
 *   - macOS: Globe/Fn key + modifier detection via Cocoa/CGEvent
 *   - Windows: True push-to-talk via WH_KEYBOARD_LL hook
 *   - Linux: /dev/input event monitoring for X11 and Wayland
 */

import { type ChildProcess, spawn } from "node:child_process";
import { getNativeBinaryPath } from "./native-binary";

type KeyEventCallback = () => void;

interface KeyListenerOptions {
  /** Electron-style hotkey accelerator, e.g. "Alt+Space" */
  hotkey: string;
  onKeyDown: KeyEventCallback;
  onKeyUp: KeyEventCallback;
  onError?: (error: string) => void;
  onReady?: () => void;
}

const BINARY_NAMES: Record<string, string> = {
  darwin: "macos-key-listener",
  win32: "windows-key-listener",
  linux: "linux-key-listener",
};

/**
 * Convert an Electron accelerator to the format expected by the native binary.
 * macOS key listener doesn't take a hotkey arg (it reports all modifier events
 * and the main process filters). Windows and Linux take the hotkey directly.
 */
function formatHotkeyForBinary(hotkey: string): string {
  // The native binaries accept Electron-style accelerator format directly
  // (e.g., "Alt+Space", "CommandOrControl+Shift+F11")
  return hotkey;
}

export class NativeKeyListener {
  private process: ChildProcess | null = null;
  private options: KeyListenerOptions;
  private destroyed = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempts = 0;
  private static readonly MAX_RESTART_ATTEMPTS = 5;
  private static readonly RESTART_DELAY_MS = 2000;

  constructor(options: KeyListenerOptions) {
    this.options = options;
  }

  /**
   * Start the native key listener binary.
   * Returns true if the binary was found and spawned.
   */
  start(): boolean {
    if (this.destroyed) return false;

    const binaryName = BINARY_NAMES[process.platform];
    if (!binaryName) {
      this.options.onError?.(`Unsupported platform: ${process.platform}`);
      return false;
    }

    const binaryPath = getNativeBinaryPath(binaryName);
    if (!binaryPath) {
      this.options.onError?.(
        `Native key listener binary not found: ${binaryName}`,
      );
      return false;
    }

    const args: string[] = [];

    // macOS key listener doesn't need hotkey arg -- it reports all events
    // and the main process filters. Windows and Linux take the hotkey.
    if (process.platform !== "darwin") {
      args.push(formatHotkeyForBinary(this.options.hotkey));
    }

    try {
      this.process = spawn(binaryPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        // Detach on Unix so the child gets its own process group
        detached: process.platform !== "win32",
      });
    } catch (err) {
      this.options.onError?.(
        `Failed to spawn key listener: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }

    let lineBuffer = "";

    this.process.stdout?.on("data", (data: Buffer) => {
      lineBuffer += data.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        this.handleLine(line.trim());
      }
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[key-listener] ${data.toString().trim()}`);
      }
    });

    this.process.on("close", (code) => {
      this.process = null;
      if (!this.destroyed && code !== 0) {
        this.scheduleRestart();
      }
    });

    this.process.on("error", (err) => {
      this.options.onError?.(`Key listener process error: ${err.message}`);
      this.process = null;
      if (!this.destroyed) {
        this.scheduleRestart();
      }
    });

    return true;
  }

  private handleLine(line: string): void {
    switch (line) {
      case "READY":
        this.restartAttempts = 0;
        this.options.onReady?.();
        break;
      case "KEY_DOWN":
        this.options.onKeyDown();
        break;
      case "KEY_UP":
        this.options.onKeyUp();
        break;
      case "FN_DOWN":
        // On macOS, if the hotkey is Fn/Globe, treat FN_DOWN as KEY_DOWN
        if (this.isFnHotkey()) {
          this.options.onKeyDown();
        }
        break;
      case "FN_UP":
        if (this.isFnHotkey()) {
          this.options.onKeyUp();
        }
        break;
      default:
        // Handle RIGHT_MOD_DOWN/UP, MODIFIER_UP, MOUSE_BUTTON_DOWN/UP
        // These are forwarded as-is for future use (hotkey recording, etc.)
        break;
    }
  }

  private isFnHotkey(): boolean {
    const hotkey = this.options.hotkey.toLowerCase();
    return hotkey === "fn" || hotkey === "globe";
  }

  private scheduleRestart(): void {
    if (this.restartAttempts >= NativeKeyListener.MAX_RESTART_ATTEMPTS) {
      this.options.onError?.(
        "Key listener exceeded max restart attempts. Give up.",
      );
      return;
    }

    this.restartAttempts++;
    const delay = NativeKeyListener.RESTART_DELAY_MS * this.restartAttempts;

    this.restartTimer = setTimeout(() => {
      if (!this.destroyed) {
        this.start();
      }
    }, delay);
  }

  /**
   * Stop the key listener and clean up.
   */
  stop(): void {
    this.destroyed = true;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.process) {
      try {
        // Send SIGTERM for graceful shutdown
        this.process.kill("SIGTERM");
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }
  }

  /**
   * Update the hotkey. Restarts the listener with the new hotkey.
   */
  updateHotkey(hotkey: string): void {
    this.options.hotkey = hotkey;
    const wasDestroyed = this.destroyed;
    this.stop();
    this.destroyed = wasDestroyed;
    if (!this.destroyed) {
      this.destroyed = false;
      this.restartAttempts = 0;
      this.start();
    }
  }

  get isRunning(): boolean {
    return this.process !== null;
  }
}
