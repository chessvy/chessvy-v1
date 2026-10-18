import { describe, expect, it, vi } from "vitest";
import { ReviewAudio } from "@/lib/chess/audio";

describe("check audio without voice", () => {
  it("waits for decoding and plays the move click plus a synthesized check tone", async () => {
    const start = vi.fn();
    const gain = { gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    const osc = vi.fn(() => ({ type: "", frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
    const buffer = { duration: 0.45 };
    class Context {
      destination = {};
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
      decodeAudioData = vi.fn(async () => buffer);
      createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start, stop: vi.fn() }));
      createGain = vi.fn(() => gain);
      createOscillator = osc;
      currentTime = 0;
    }
    vi.stubGlobal("AudioContext", Context);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    try {
      const audio = new ReviewAudio();
      const preparing = audio.prepare();
      await audio.play("check");
      await preparing;
      expect(start).toHaveBeenCalledTimes(1);
      expect(osc).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledTimes(2);
      audio.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});