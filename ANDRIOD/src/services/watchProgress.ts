import type { WatchSession, HeartbeatInput, HeartbeatResult } from './watchTypes';
interface WatchApi {
  startWatch(taskId: string): Promise<WatchSession>;
  watchHeartbeat(taskId: string, input: HeartbeatInput): Promise<HeartbeatResult>;
}
// Playback is client-reported, not independent evidence of viewing. Only the
// backend's confirmed accumulated time determines completion eligibility.
export class WatchProgress {
  session: WatchSession;
  private lastConfirmedAt: number;
  private running: Promise<void> | null = null;
  private finalizing: Promise<void> | null = null;
  private cancelled = false;
  private needsSync = false;
  constructor(private taskId: string, session: WatchSession, private api: WatchApi,
    private confirmed: (session: WatchSession, recovered: boolean) => void,
    private now = () => Date.now(), private wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {
    this.session = { ...session };
    this.lastConfirmedAt = now();
  }
  dispose() { this.cancelled = true; }
  private async resync() {
    const session = await this.api.startWatch(this.taskId);
    if (this.cancelled) return;
    if (session.sessionId !== this.session.sessionId || session.videoId !== this.session.videoId) {
      this.cancelled = true;
      throw new Error('Watch session expired or changed. Reopen this video to start again.');
    }
    this.session = session;
    this.lastConfirmedAt = this.now();
    this.needsSync = false;
    this.confirmed({ ...session }, true);
  }
  private async send(position: number) {
    if (this.cancelled) return;
    if (this.needsSync) { await this.resync(); return; }
    try {
      const result = await this.api.watchHeartbeat(this.taskId, {
        sessionId: this.session.sessionId, sequence: this.session.sequence + 1,
        playbackPosition: position, clientTimestamp: this.now(),
      });
      if (this.cancelled) return;
      this.session = { ...this.session, ...result, playbackPosition: position };
      this.lastConfirmedAt = this.now();
      this.confirmed({ ...this.session }, false);
    } catch (error) {
      if (this.cancelled) return;
      const status = (error as { status?: number }).status;
      if (status && ![400, 409, 429].includes(status) && status < 500) throw error;
      // One bounded recovery read, never blindly replay an uncertain heartbeat.
      this.needsSync = true;
      await this.resync();
    }
  }
  update(position: number, final = false): Promise<void> {
    if (this.cancelled) return Promise.resolve();
    if (final) {
      if (this.finalizing) return this.finalizing;
      const pending = this.running;
      this.finalizing = (async () => {
        if (pending) await pending;
        if (this.cancelled || position <= this.session.playbackPosition) return;
        // Final progress bypasses the 5s cadence, but respects the server's 2s minimum.
        await this.wait(Math.max(0, 2100 - (this.now() - this.lastConfirmedAt)));
        if (!this.cancelled) await this.send(position);
      })().finally(() => { this.finalizing = null; });
      return this.finalizing;
    }
    if (this.running || this.finalizing || position <= this.session.playbackPosition || this.now() - this.lastConfirmedAt < 5000) return Promise.resolve();
    this.running = this.send(position).finally(() => { this.running = null; });
    return this.running;
  }
}
