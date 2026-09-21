import { Platform } from 'react-native';

/** Field errors keyed by field name, e.g. `{ email: 'value is not a valid email address' }`. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, code: string, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  query?: Query;
  /** JSON request body. */
  json?: unknown;
  /** `application/x-www-form-urlencoded` body (the OAuth2 login form). */
  form?: Record<string, string>;
  signal?: AbortSignal;
  /** `none` never sends the token and never triggers the unauthorized handler. */
  auth?: 'optional' | 'none';
};

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
};

export type ApiClient = {
  request: <T>(method: string, path: string, options?: RequestOptions) => Promise<T>;
  /** Called when a request that carried a token comes back 401. */
  setUnauthorizedHandler: (handler: (() => void) | null) => void;
};

export function resolveBaseUrl(env: string | undefined = process.env.EXPO_PUBLIC_API_URL): string {
  if (env) return env.replace(/\/+$/, '');
  // The Android emulator reaches the host machine at 10.0.2.2, not localhost.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const qs = params.toString();
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

type ValidationDetail = { loc?: unknown[]; msg?: string };

/** Turns the backend's two error shapes into an `ApiError`. */
export function toApiError(status: number, body: unknown): ApiError {
  const record = (body ?? {}) as Record<string, unknown>;

  const domain = record.error as { code?: string; message?: string } | undefined;
  if (domain && typeof domain.message === 'string') {
    return new ApiError(status, domain.code ?? 'error', domain.message);
  }

  // FastAPI request validation: { detail: [{ loc: ['body', 'email'], msg: '...' }] }
  if (Array.isArray(record.detail)) {
    const fieldErrors: FieldErrors = {};
    const messages: string[] = [];
    for (const item of record.detail as ValidationDetail[]) {
      const field = item.loc?.[item.loc.length - 1];
      const msg = item.msg ?? 'Invalid value';
      if (typeof field === 'string' && !(field in fieldErrors)) fieldErrors[field] = msg;
      messages.push(msg);
    }
    return new ApiError(status, 'validation_error', messages.join('. '), fieldErrors);
  }

  return new ApiError(status, 'error', `Request failed (${status})`);
}

export function createApiClient({ baseUrl, getToken, fetchImpl }: ApiClientOptions): ApiClient {
  let onUnauthorized: (() => void) | null = null;

  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { query, json, form, signal, auth = 'optional' } = options;
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: string | undefined;

    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }

    const token = auth === 'none' ? null : await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await (fetchImpl ?? fetch)(buildUrl(baseUrl, path, query), {
        method,
        headers,
        body,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your connection.');
    }

    if (response.status === 204) return undefined as T;

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && token) onUnauthorized?.();
      throw toApiError(response.status, payload);
    }
    return payload as T;
  }

  return {
    request,
    setUnauthorizedHandler: (handler) => {
      onUnauthorized = handler;
    },
  };
}
