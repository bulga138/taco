/**
 * Error sanitization utilities.
 *
 * Removes sensitive information from error messages before displaying to users.
 * Prevents exposure of URLs, API keys, tokens, and other secrets.
 */

/**
 * Sanitizes an error message to remove sensitive information.
 *
 * Removes:
 * - Full URLs (replaced with just the hostname)
 * - API keys and tokens (replaced with [REDACTED])
 * - Authorization headers
 * - Query parameters that might contain secrets
 *
 * @param message The original error message
 * @returns Sanitized message safe for display
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return message

  let sanitized = message

  // Remove URLs - replace with just the hostname or [URL]
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, match => {
    try {
      const url = new URL(match)
      return `[${url.hostname}]`
    } catch {
      return '[URL]'
    }
  })

  // Remove API keys and tokens (common patterns)
  // Bearer tokens
  sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED]')

  // API keys in various formats
  sanitized = sanitized.replace(
    /(api[_-]?key|apikey|token|auth|secret)[\s]*[=:]+[\s]*[a-zA-Z0-9_-]+/gi,
    '$1=[REDACTED]'
  )

  // Authorization headers
  sanitized = sanitized.replace(/authorization[:\s]+[a-zA-Z0-9_-]+/gi, 'Authorization: [REDACTED]')

  // Query parameters that might contain secrets
  sanitized = sanitized.replace(
    /([?&])(api[_-]?key|token|auth|secret|password)=[^&\s]+/gi,
    '$1$2=[REDACTED]'
  )

  return sanitized
}

/**
 * Sanitizes an Error object, returning a new Error with sanitized message.
 * Preserves the stack trace but removes sensitive data from the message.
 *
 * @param error The original error
 * @returns Sanitized error
 */
export function sanitizeError(error: Error): Error {
  const sanitizedMessage = sanitizeErrorMessage(error.message)
  const sanitizedError = new Error(sanitizedMessage)
  sanitizedError.stack = error.stack
  sanitizedError.name = error.name
  return sanitizedError
}
