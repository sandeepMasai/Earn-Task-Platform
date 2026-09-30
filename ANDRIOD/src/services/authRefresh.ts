interface RefreshedAccess { accessToken: string; expiresAt?: string }
interface RefreshDependencies {
  getToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  saveExpiry(expiresAt: string): Promise<void>;
  clearAuth(): Promise<void>;
  request(token: string): Promise<RefreshedAccess>;
}
export class AuthRefresh {
  epoch = 0;
  private flight: Promise<string> | null = null;
  private writes: Promise<void> = Promise.resolve();
  onLogout: () => void = () => {};
  onRefresh: (data: RefreshedAccess) => void = () => {};
  constructor(private deps: RefreshDependencies) {}
  private mutate(work: () => Promise<void>): Promise<void> {
    const result = this.writes.then(work, work);
    this.writes = result.catch(() => {});
    return result;
  }
  logout(): Promise<void> {
    this.epoch++;
    this.onLogout();
    // Serialize with in-progress storage writes: an old refresh cannot resurrect tokens.
    return this.mutate(() => this.deps.clearAuth());
  }
  refresh(failedToken: string | undefined, epoch: number): Promise<string> {
    if (epoch !== this.epoch) return Promise.reject(new Error('Session ended'));
    if (this.flight) return this.flight;
    const work = (async () => {
      try {
        const current = await this.deps.getToken();
        if (epoch !== this.epoch) throw new Error('Session ended');
        // A delayed 401 for an older token can reuse a refresh that already finished.
        if (current && failedToken && current !== failedToken) return current;
        const token = await this.deps.getRefreshToken();
        if (!token) throw new Error('Sign in required');
        if (epoch !== this.epoch) throw new Error('Session ended');
        const data = await this.deps.request(token);
        if (!data.accessToken || epoch !== this.epoch) throw new Error('Session ended');
        await this.mutate(async () => {
          if (epoch !== this.epoch) throw new Error('Session ended');
          await this.deps.saveToken(data.accessToken);
          if (data.expiresAt) await this.deps.saveExpiry(data.expiresAt);
          if (epoch !== this.epoch) throw new Error('Session ended');
          this.onRefresh(data);
        });
        return data.accessToken;
      } catch {
        if (epoch === this.epoch) await this.logout();
        throw new Error('Session ended. Please sign in again.');
      }
    })();
    this.flight = work.finally(() => { this.flight = null; });
    return this.flight;
  }
}
