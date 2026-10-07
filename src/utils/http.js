/** Standard API envelope: `{ success, data, error }` (PRD §48). */

export function ok(reply, data, status = 200) {
  return reply.code(status).send({ success: true, data, error: null });
}

export function fail(reply, status, code, message) {
  return reply.code(status).send({ success: false, data: null, error: { code, message } });
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') => new ApiError(400, code, message);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') => new ApiError(401, code, message);
export const forbidden = (message = 'Forbidden', code = 'FORBIDDEN') => new ApiError(403, code, message);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') => new ApiError(404, code, message);
export const tooMany = (message = 'Too many requests', code = 'TOO_MANY_REQUESTS') => new ApiError(429, code, message);
