import type { CompletionResult } from './watchTypes';
// Only successful backend completion grants credit; concurrent taps share one request.
export class Completion {
  private flight: Promise<CompletionResult> | null = null;
  private result: CompletionResult | null = null;
  run(request: () => Promise<CompletionResult>, applyReward: (coins: number) => void): Promise<CompletionResult> {
    if (this.result) return Promise.resolve(this.result);
    if (this.flight) return this.flight;
    this.flight = request().then(result => {
      this.result = result;
      applyReward(result.coins);
      return result;
    }).finally(() => { this.flight = null; });
    return this.flight;
  }
}
