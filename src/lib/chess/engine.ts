// Stockfish (stockfish.js 10, GPLv3) running in a browser Web Worker.
import { MATE_SCORE } from "./classify";

const SF_URL = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

export interface EngineLine {
  move: string; // UCI
  score: number; // cp, side-to-move perspective (mate mapped to +/-MATE_SCORE)
  mate: number | null;
}

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private handler: ((l: string) => void) | null = null;

  constructor() {
    const blob = new Blob([`importScripts("${SF_URL}");`], { type: "application/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = (e) => this.handler?.(String(e.data));
    this.ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Engine failed to load")), 20000);
      this.handler = (l) => {
        if (l === "uciok") {
          clearTimeout(t);
          resolve();
        }
      };
      this.worker.onerror = () => {
        clearTimeout(t);
        reject(new Error("Engine failed to load"));
      };
      this.send("uci");
    });
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  async analyse(fen: string, depth: number, multipv = 2): Promise<EngineLine[]> {
    await this.ready;
    return new Promise((resolve) => {
      const lines = new Map<number, EngineLine>();
      this.handler = (l) => {
        if (l.startsWith("info") && l.includes(" pv ")) {
          const mpv = Number(/multipv (\d+)/.exec(l)?.[1] ?? 1);
          const cp = /score cp (-?\d+)/.exec(l);
          const mate = /score mate (-?\d+)/.exec(l);
          const pv = / pv (\S+)/.exec(l)?.[1];
          if (!pv) return;
          const m = mate ? Number(mate[1]) : null;
          const score =
            m !== null ? (m > 0 ? MATE_SCORE - m * 10 : -MATE_SCORE - m * 10) : Number(cp?.[1] ?? 0);
          lines.set(mpv, { move: pv, score, mate: m });
        } else if (l.startsWith("bestmove")) {
          resolve([...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]));
        }
      };
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
