export interface WatchSession {
  sessionId: string;
  videoId: string;
  startedAt: string;
  expiresAt: string;
  requiredWatchSeconds: number;
  heartbeatIntervalSeconds?: number;
  sequence: number;
  playbackPosition: number;
  accumulatedSeconds: number;
}
export interface HeartbeatInput {
  sessionId: string;
  playbackPosition: number;
  clientTimestamp: number;
  sequence: number;
}
export interface HeartbeatResult {
  sequence: number;
  accumulatedSeconds: number;
  requiredWatchSeconds: number;
  canComplete: boolean;
}
export interface CompletionResult { coins: number; message: string }
