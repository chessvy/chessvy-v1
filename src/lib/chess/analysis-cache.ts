/** Review-scoped reuse only: clocks and all search options are part of the key. */
export class AnalysisCache<T> {
  private entries = new Map<string, Promise<T>>();

  getOrRun(key: string, run: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const result = run().catch(error => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, result);
    return result;
  }

  clear() {
    this.entries.clear();
  }
}