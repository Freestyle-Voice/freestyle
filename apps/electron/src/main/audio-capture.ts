/**
 * Native audio capture using RtAudio (via audify).
 *
 * Runs in the Electron main process.  Captures PCM16 mono audio at the
 * device's native sample rate (typically 48 kHz) and downsamples to
 * 16 kHz for the STT pipeline.  Exposes start/stop with ~10 ms latency
 * and proper OS mic-indicator lifecycle.
 *
 * Usage:
 *   const capture = new AudioCapture();
 *   capture.openStream();                       // pre-warm the device
 *   capture.start((pcm16: Buffer) => { … });    // begin capturing (16 kHz)
 *   capture.stop();                             // stop, mic indicator off
 *   capture.destroy();                          // release all resources
 */

import { RtAudio } from "audify";

const TARGET_RATE = 16_000;
const CHANNELS = 1;
// RtAudioFormat.RTAUDIO_SINT16 = 0x2 — can't reference const enum with isolatedModules
const RTAUDIO_SINT16 = 0x2;

// Sample rates to try, in order of preference.  48 kHz is universally
// supported on macOS CoreAudio, Windows WASAPI, and Linux ALSA.
const PREFERRED_RATES = [48_000, 44_100, 16_000];

/** Nearest-neighbour downsample from `srcRate` to 16 kHz PCM16. */
function downsample(src: Buffer, srcRate: number): Buffer {
  if (srcRate === TARGET_RATE) return src;
  const ratio = srcRate / TARGET_RATE;
  const srcSamples = src.length / 2;
  const outSamples = Math.floor(srcSamples / ratio);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const srcIdx = Math.round(i * ratio);
    out.writeInt16LE(src.readInt16LE(srcIdx * 2), i * 2);
  }
  return out;
}

export class AudioCapture {
  private rtAudio: RtAudio;
  private opened = false;
  private running = false;
  private captureRate = TARGET_RATE;
  private onData: ((pcm16: Buffer) => void) | null = null;

  constructor() {
    this.rtAudio = new RtAudio();
  }

  /** List available input devices. */
  getDevices(): { id: number; name: string; isDefault: boolean }[] {
    const devices = this.rtAudio.getDevices();
    const defaultId = this.rtAudio.getDefaultInputDevice();
    return devices
      .filter((d) => d.inputChannels > 0)
      .map((d, i) => ({
        id: i,
        name: d.name,
        isDefault: i === defaultId,
      }));
  }

  /** Pre-warm the audio device without starting capture. */
  openStream(deviceId?: number): void {
    if (this.opened) return;

    const inputDeviceId = deviceId ?? this.rtAudio.getDefaultInputDevice();

    // Try preferred sample rates until one works.
    for (const rate of PREFERRED_RATES) {
      const frameSize = Math.round((rate * 80) / 1000); // ~80 ms
      try {
        this.rtAudio.openStream(
          null, // no output
          {
            deviceId: inputDeviceId,
            nChannels: CHANNELS,
            firstChannel: 0,
          },
          RTAUDIO_SINT16,
          rate,
          frameSize,
          "freestyle",
          (pcm) => {
            if (!this.onData) return;
            const buf = pcm as Buffer;
            this.onData(
              this.captureRate === TARGET_RATE
                ? buf
                : downsample(buf, this.captureRate),
            );
          },
          null, // no frame output callback
        );
        this.captureRate = rate;
        this.opened = true;
        console.log(
          `[audio] Opened capture stream at ${rate} Hz (device ${inputDeviceId})`,
        );
        return;
      } catch (err) {
        console.warn(`[audio] Failed to open at ${rate} Hz:`, err);
        // Try next rate
      }
    }

    console.error(
      "[audio] Could not open audio stream at any supported sample rate",
    );
  }

  /** Begin capturing audio.  Calls `cb` with 16 kHz PCM16 buffers. */
  start(cb: (pcm16: Buffer) => void): void {
    if (!this.opened) this.openStream();
    this.onData = cb;
    if (!this.running && this.opened) {
      this.rtAudio.start();
      this.running = true;
    }
  }

  /** Stop capturing.  The device handle stays open for fast restart. */
  stop(): void {
    if (this.running) {
      try {
        this.rtAudio.stop();
      } catch {}
      this.running = false;
    }
    this.onData = null;
  }

  /** Compute RMS volume (0..1) from a PCM16 buffer. */
  static volume(pcm16: Buffer): number {
    const samples = pcm16.length / 2;
    if (samples === 0) return 0;
    let sum = 0;
    for (let i = 0; i < pcm16.length; i += 2) {
      const s = pcm16.readInt16LE(i) / 32768;
      sum += s * s;
    }
    return Math.min(1, Math.sqrt(sum / samples) * 3);
  }

  /** Release all resources. */
  destroy(): void {
    this.stop();
    if (this.opened) {
      try {
        this.rtAudio.closeStream();
      } catch {}
      this.opened = false;
    }
  }
}
