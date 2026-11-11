import { HttpError } from './http-error.js';

export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw new HttpError(400, 'Validation failed', fields);
}
