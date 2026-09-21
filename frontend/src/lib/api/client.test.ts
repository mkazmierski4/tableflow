import { ApiError, buildUrl, createApiClient, resolveBaseUrl, toApiError } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(token: string | null = 'tok') {
  const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>();
  const client = createApiClient({
    baseUrl: 'http://api.test',
    getToken: () => token,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl };
}

describe('buildUrl', () => {
  it('appends only defined, non-empty query values', () => {
    expect(
      buildUrl('http://x', '/r', {
        city: 'Kraków',
        limit: 10,
        offset: 0,
        empty: '',
        gone: undefined,
        nil: null,
      }),
    ).toBe('http://x/r?city=Krak%C3%B3w&limit=10&offset=0');
  });

  it('leaves the URL bare without a query', () => {
    expect(buildUrl('http://x', '/r')).toBe('http://x/r');
    expect(buildUrl('http://x', '/r', { a: undefined })).toBe('http://x/r');
  });
});

describe('resolveBaseUrl', () => {
  it('uses the configured URL without trailing slashes', () => {
    expect(resolveBaseUrl('https://api.example.com//')).toBe('https://api.example.com');
  });

  it('falls back to a local default', () => {
    expect(resolveBaseUrl(undefined)).toMatch(/^http:\/\/(localhost|10\.0\.2\.2):8000$/);
  });
});

describe('toApiError', () => {
  it('reads the backend domain error shape', () => {
    const error = toApiError(409, { error: { code: 'slot_conflict', message: 'Table is booked' } });
    expect(error).toMatchObject({ status: 409, code: 'slot_conflict', message: 'Table is booked' });
  });

  it('maps FastAPI validation errors to field errors', () => {
    const error = toApiError(422, {
      detail: [
        { loc: ['body', 'email'], msg: 'value is not a valid email address' },
        { loc: ['body', 'password'], msg: 'String should have at least 8 characters' },
        { loc: ['body', 'email'], msg: 'second message for the same field' },
      ],
    });
    expect(error.code).toBe('validation_error');
    expect(error.fieldErrors).toEqual({
      email: 'value is not a valid email address',
      password: 'String should have at least 8 characters',
    });
  });

  it('has a generic fallback for unknown bodies', () => {
    expect(toApiError(500, null)).toMatchObject({ status: 500, code: 'error' });
    expect(toApiError(502, '<html>').message).toContain('502');
  });
});

describe('request', () => {
  it('sends the bearer token and parses JSON', async () => {
    const { client, fetchImpl } = setup('secret');
    fetchImpl.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(client.request('GET', '/x')).resolves.toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api.test/x');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });

  it('never sends the token for auth: none', async () => {
    const { client, fetchImpl } = setup('secret');
    fetchImpl.mockResolvedValue(jsonResponse(200, {}));

    await client.request('GET', '/public', { auth: 'none' });

    expect(
      (fetchImpl.mock.calls[0]![1].headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it('encodes JSON and form bodies with the right content type', async () => {
    const { client, fetchImpl } = setup(null);
    fetchImpl.mockResolvedValue(jsonResponse(200, {}));

    await client.request('POST', '/j', { json: { a: 1 } });
    await client.request('POST', '/f', { form: { username: 'a@b.co', password: 'p w' } });

    const [json, form] = fetchImpl.mock.calls.map(([, init]) => init);
    expect((json!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(json!.body).toBe('{"a":1}');
    expect((form!.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(form!.body).toBe('username=a%40b.co&password=p+w');
  });

  it('returns undefined for 204', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.request('DELETE', '/x')).resolves.toBeUndefined();
  });

  it('throws an ApiError for error responses', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(
      jsonResponse(404, { error: { code: 'not_found', message: 'Nope' } }),
    );

    await expect(client.request('GET', '/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
  });

  it('calls the unauthorized handler on 401 only when a token was sent', async () => {
    const withToken = setup('t');
    const handler = jest.fn();
    withToken.client.setUnauthorizedHandler(handler);
    withToken.fetchImpl.mockResolvedValue(
      jsonResponse(401, { error: { code: 'invalid_token', message: 'x' } }),
    );
    await expect(withToken.client.request('GET', '/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);

    // A failed login has no token: it must not look like an expired session.
    const anonymous = setup(null);
    const other = jest.fn();
    anonymous.client.setUnauthorizedHandler(other);
    anonymous.fetchImpl.mockResolvedValue(
      jsonResponse(401, { error: { code: 'invalid_credentials', message: 'x' } }),
    );
    await expect(anonymous.client.request('POST', '/login')).rejects.toBeInstanceOf(ApiError);
    expect(other).not.toHaveBeenCalled();
  });

  it('maps a failed fetch to a network_error', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValue(new TypeError('Network request failed'));
    await expect(client.request('GET', '/x')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('lets aborts through untouched', async () => {
    const { client, fetchImpl } = setup();
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchImpl.mockRejectedValue(abort);
    await expect(client.request('GET', '/x')).rejects.toBe(abort);
  });
});
