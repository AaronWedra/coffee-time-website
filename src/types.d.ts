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
