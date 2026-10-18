import { sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '../db';
import { AppError } from '../domain/authorization';
export function assertOrigin(request: Request) {
  const expected = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected)
    throw new AppError(403, 'The request origin is not permitted.');
}
export async function body(request: Request) {
  assertOrigin(request);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(415, 'JSON is required.');
  const stream = request.body?.getReader();
  if (!stream) throw new AppError(400, 'A request body is required.');
  let length = 0,
    text = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await stream.read();
    if (done) break;
    length += value.length;
    if (length > 131072) {
      await stream.cancel();
      throw new AppError(413, 'This request is too large.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError(400, 'Invalid JSON.');
  }
}
export async function limit(actorId: string) {
  const start = new Date(Math.floor(Date.now() / 60000) * 60000);
  const result = await db.execute(
    sql`insert into request_bucket (key,window_start,count) values (${actorId},${start.toISOString()},1) on conflict(key) do update set window_start=excluded.window_start,count=case when request_bucket.window_start=excluded.window_start then request_bucket.count+1 else 1 end returning count`,
  );
  const rows = 'rows' in result ? result.rows : result;
  if (Number((rows as { count: number }[])[0].count) > 120)
    throw new AppError(429, 'Too many requests. Wait a minute and try again.');
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => i.message)
          .join(' ')
          .slice(0, 500),
      },
      { status: 400 },
    );
  // Do not log request bodies, database errors, or narratives.
  return Response.json(
    {
      error:
        'The operation could not be completed. Your unsaved work remains in this window. Try again.',
    },
    { status: 500 },
  );
}
