import move from "@/assets/sounds/move.mp3.asset.json";
import capture from "@/assets/sounds/capture.mp3.asset.json";
import check from "@/assets/sounds/check.mp3.asset.json";

const urls = { move: move.url, capture: capture.url, check: check.url };
export class ReviewAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private active: AudioBufferSourceNode | null = null;
  async prepare() {
    if (this.context) return;
    this.context = new AudioContext();
    const context = this.context;
    await Promise.all(Object.entries(urls).map(async ([key, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        this.buffers.set(key, await context.decodeAudioData(await response.arrayBuffer()));
      } catch { /* Optional sound must never prevent a review. */ }
    }));
  }
  unlock() { void this.context?.resume().catch(() => {}); }
  play(kind: keyof typeof urls) {
    const context = this.context, buffer = this.buffers.get(kind);
    if (!context || !buffer) return;
    this.unlock(); this.stop();
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = kind === "check" ? 0.85 : 0.6;
    source.connect(gain); gain.connect(context.destination); source.start(); this.active = source;
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
  dispose() { this.stop(); void this.context?.close().catch(() => {}); }
}