import move from "@/assets/sounds/move.mp3.asset.json";
import capture from "@/assets/sounds/capture.mp3.asset.json";

const urls = { move: move.url, capture: capture.url };
export type SoundKind = "move" | "capture" | "check";
export class ReviewAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private active: AudioBufferSourceNode | null = null;
  private preparing: Promise<void> | null = null;
  prepare(): Promise<void> {
    if (this.preparing) return this.preparing;
    this.context = new AudioContext();
    const context = this.context;
    this.preparing = Promise.all(Object.entries(urls).map(async ([key, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        this.buffers.set(key, await context.decodeAudioData(await response.arrayBuffer()));
      } catch { /* Optional sound must never prevent a review. */ }
    })).then(() => {});
    return this.preparing;
  }
  unlock() {
    if (!this.context) void this.prepare();
    void this.context?.resume().catch(() => {});
  }
  async play(kind: SoundKind) {
    this.unlock();
    await this.prepare();
    const context = this.context, buffer = this.buffers.get(kind === "check" ? "move" : kind);
    if (!context || !buffer) return;
    try { await context.resume(); } catch { return; }
    this.stop();
    if (kind === "check") this.checkTone(context);
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = 0.6;
    source.connect(gain); gain.connect(context.destination); source.start(); this.active = source;
  }
  /** Short two-note alert (no voice) layered over the move click. */
  private checkTone(context: AudioContext) {
    if (!context.createOscillator) return;
    [880, 1318.5].forEach((frequency, i) => {
      const osc = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + 0.02 + i * 0.07;
      osc.type = "triangle"; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain); gain.connect(context.destination); osc.start(start); osc.stop(start + 0.2);
    });
  }
  ending() {
    const context = this.context;
    if (!context) return;
    this.unlock();
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      const osc = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + i * 0.09;
      osc.type = "sine"; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain); gain.connect(context.destination); osc.start(start); osc.stop(start + 0.26);
    });
  }
  stop() { try { this.active?.stop(); } catch { /* Already stopped. */ } this.active = null; }
  dispose() { this.stop(); void this.context?.close().catch(() => {}); this.context = null; }
}