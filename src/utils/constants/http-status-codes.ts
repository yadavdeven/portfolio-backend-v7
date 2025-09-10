/**
 * HTTP status codes for API responses.
 */

const httpStatusCodes = {
  // Successful request
  OK: 200,
  // Resource successfully created (e.g., user registration)
  CREATED: 201,
  // Request accepted but processing incomplete
  ACCEPTED: 202,
  // Successful request with no response body
  NO_CONTENT: 204,
  // Invalid request data (e.g., missing fields)
  BAD_REQUEST: 400,
  // Authentication failed or invalid credentials
  UNAUTHORIZED: 401,
  // Access denied
  FORBIDDEN: 403,
  // Resource not found
  NOT_FOUND: 404,
  // Conflict (e.g., duplicate email)
  CONFLICT: 409,
  // Specific validation errors (e.g., malformed email)
  UNPROCESSABLE_ENTITY: 422,
  // Too many requests (e.g., rate-limiting login attempts)
  TOO_MANY_REQUESTS: 429,
  // Unexpected server error
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = keyof typeof httpStatusCodes;

export default httpStatusCodes;
