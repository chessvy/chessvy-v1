import { describe, expect, it, vi } from "vitest";
import { ReviewAudio } from "@/lib/chess/audio";

describe("preloaded check audio", () => {
  it("waits for decoding and starts the check buffer at audible gain", async () => {
    const start = vi.fn();
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const buffer = { duration: 0.45 };
    class Context {
      destination = {};
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {});
      decodeAudioData = vi.fn(async () => buffer);
      createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start, stop: vi.fn() }));
      createGain = vi.fn(() => gain);
    }
    vi.stubGlobal("AudioContext", Context);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    try {
      const audio = new ReviewAudio();
      const preparing = audio.prepare();
      await audio.play("check");
      await preparing;
      expect(start).toHaveBeenCalledTimes(1);
      expect(gain.gain.value).toBe(2.5);
      audio.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});