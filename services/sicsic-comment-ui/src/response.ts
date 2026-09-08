export class ApiError extends Error {
  readonly retryAfterMs: number | null;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.retryAfterMs = Number.isFinite(retryAfterMs) ? Number(retryAfterMs) : null;
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function requireShape(valid: boolean): asserts valid {
  if (!valid) throw new ApiError('invalid_response');
}

export async function readResponse(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new ApiError(response.ok ? 'invalid_response' : `request_${response.status}`);
  }
  if (!response.ok) {
    throw new ApiError(record(body) && typeof body.error === 'string' ? body.error : `request_${response.status}`,
      record(body) && typeof body.retryAfterMs === 'number' ? body.retryAfterMs : undefined);
  }
  requireShape(record(body));
  return body;
}
