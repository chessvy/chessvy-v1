// App-hosted, pinned Stockfish 18 lite, single-threaded WASM.
import { commonDepthLines, parseEngineLine } from "./engine-lines";
import { AnalysisCache } from "./analysis-cache";
import script from "@/assets/engine/stockfish.js.asset.json";
import wasm from "@/assets/engine/stockfish.wasm.asset.json";

export interface EngineLine {
  move: string; // UCI
  score: number; // cp, side-to-move perspective (mate mapped to +/-MATE_SCORE)
  mate: number | null;
  depth?: number;
}

export class Engine {
  private worker: Worker | null = null;
  private objectUrl: string | null = null;
  private disposed = false;
  private ready: Promise<void>;
  private handler: ((l: string) => void) | null = null;
  private fail: ((error: Error) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private cache = new AnalysisCache<EngineLine[]>();

  constructor() {
    this.ready = this.initialize();
    // Avoid an unhandled rejection if the user cancels before the first analysis.
    void this.ready.catch(() => {});
  }

  private async initialize() {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.disposed) throw new Error("cancelled");
      try {
        const response = await fetch(script.url, { signal: AbortSignal.timeout(60000), cache: "force-cache" });
        if (!response.ok) throw new Error("Engine download unavailable");
        const code = await response.text();
        if (this.disposed) throw new Error("cancelled");
        this.objectUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
        this.worker = new Worker(this.objectUrl + "#" + encodeURIComponent(new URL(wasm.url, window.location.origin).href));
        this.worker.onmessage = e => this.handler?.(String(e.data));
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => finish(new Error("Engine startup timed out")), 90000);
          const finish = (error?: Error) => {
            clearTimeout(timer); this.fail = null; this.handler = null;
            if (error) reject(error); else resolve();
          };
          this.fail = finish;
          this.handler = line => {
            if (line === "uciok") {
              this.send("setoption name Hash value 32");
              this.send("setoption name Threads value 1");
              this.send("isready");
            } else if (line === "readyok") finish();
          };
          if (this.worker) this.worker.onerror = () => this.fail?.(new Error("Engine startup interrupted"));
          this.send("uci");
        });
        return;
      } catch (error) {
        lastError = error; this.cleanup();
      }
    }
    throw new Error(`The engine couldn't start after retrying. Check your connection and run review again. ${lastError instanceof Error ? lastError.message : ""}`);
  }

  private cleanup() {
    this.worker?.terminate(); this.worker = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  /** Serialized: one position at a time so info lines never mix between calls. */
  analyse(fen: string, depth: number, multipv = 2, searchMove?: string): Promise<EngineLine[]> {
    if (this.disposed) return Promise.reject(new Error("cancelled"));
    const key = JSON.stringify([fen, depth, searchMove ? 1 : multipv, searchMove ?? null]);
    return this.cache.getOrRun(key, () => {
      const run = this.queue.then(() => this.analyseNow(fen, depth, multipv, searchMove));
      this.queue = run.catch(() => {});
      return run;
    }).then(lines => lines.map(line => ({ ...line })));
  }

  private async analyseNow(fen: string, depth: number, multipv: number, searchMove?: string): Promise<EngineLine[]> {
    await this.ready;
    if (this.disposed) throw new Error("cancelled");
    return new Promise((resolve, reject) => {
      const iterations = new Map<number, Map<number, EngineLine>>();
      const count = searchMove ? 1 : multipv;
      const timer = setTimeout(() => {
        this.fail?.(new Error("Analysis timed out. Please run review again."));
        this.cleanup(); this.disposed = true;
      }, 120000);
      const finish = (error?: Error) => {
        clearTimeout(timer); this.handler = null; this.fail = null;
        const result = commonDepthLines(iterations, count);
        if (error) reject(error);
        else if (!result[0]) reject(new Error("The engine returned no evaluation. Please retry."));
        else resolve(result);
      };
      this.fail = finish;
      this.handler = (l) => {
        if (l.startsWith("info")) {
          const parsed = parseEngineLine(l);
          if (!parsed) return;
          const actualDepth = parsed.line.depth ?? 0;
          const lines = iterations.get(actualDepth) ?? new Map<number, EngineLine>();
          lines.set(parsed.index, parsed.line);
          iterations.set(actualDepth, lines);
        } else if (l.startsWith("bestmove")) {
          finish();
        }
      };
      this.send(`setoption name MultiPV value ${count}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}${searchMove ? ` searchmoves ${searchMove}` : ""}`);
    });
  }

  terminate() {
    this.disposed = true;
    this.cache.clear();
    this.fail?.(new Error("cancelled"));
    this.cleanup();
  }
}
