// Minimal Cloudflare bindings so `tsc` works without @cloudflare/workers-types installed.
// When workers-types IS installed (normal dev machine), these are superseded by it; keep them compatible.
interface D1Result<T = unknown> { results: T[]; success: boolean; meta: Record<string, unknown> }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
interface Fetcher { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
interface R2ObjectBody { body: ReadableStream; httpMetadata?: { contentType?: string }; size: number }
interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string | string[]): Promise<void>;
}
interface ScheduledEvent { scheduledTime: number; cron: string }
