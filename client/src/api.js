export class ApiError extends Error {
  constructor(message, fields, status) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields;
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const { body, headers, ...rest } = options;

  const response = await fetch(path, {
    credentials: 'include',
    ...rest,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'The request could not be completed.',
      payload?.error?.fields,
      response.status,
    );
  }

  return payload;
}
