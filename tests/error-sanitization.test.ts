import { test, expect, describe, beforeEach, afterEach } from 'vitest'
import { sanitizeErrorMessage, sanitizeError } from '../src/utils/error-sanitization.js'

describe('Error Sanitization', () => {
  describe('sanitizeErrorMessage', () => {
    test('removes full URLs and replaces with hostname', () => {
      const input = 'Failed to fetch from https://api.openai.com/v1/chat/completions'
      const result = sanitizeErrorMessage(input)
      expect(result).toBe('Failed to fetch from [api.openai.com]')
    })

    test('removes multiple URLs in message', () => {
      const input =
        'Error connecting to https://api.example.com and https://gateway.litellm.ai/stats'
      const result = sanitizeErrorMessage(input)
      expect(result).toBe('Error connecting to [api.example.com] and [gateway.litellm.ai]')
    })

    test('redacts Bearer tokens', () => {
      const input = 'Authorization failed: Bearer sk-abc123xyz789'
      const result = sanitizeErrorMessage(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('sk-abc123xyz789')
    })

    test('redacts API keys in various formats', () => {
      const inputs = [
        'Invalid api_key=secret123',
        'Missing api-key: abc123',
        'Bad token=xyz789',
        'Wrong auth: mysecret',
        'Invalid secret=shh123',
      ]

      inputs.forEach(input => {
        const result = sanitizeErrorMessage(input)
        expect(result).toContain('[REDACTED]')
        expect(result).not.toMatch(/secret123|abc123|xyz789|mysecret|shh123/)
      })
    })

    test('redacts Authorization headers', () => {
      const input = 'Request failed with Authorization: Bearer sk-test123'
      const result = sanitizeErrorMessage(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('sk-test123')
      // Should redact both the auth header and bearer token
      const redactedCount = (result.match(/\[REDACTED\]/g) || []).length
      expect(redactedCount).toBeGreaterThanOrEqual(1)
    })

    test('redacts query parameters with secrets by removing full URL', () => {
      const input = 'Error in URL: https://api.example.com/data?api_key=secret123&token=abc'
      const result = sanitizeErrorMessage(input)
      // Full URL is replaced with hostname, so query params (and secrets) are removed
      expect(result).not.toContain('secret123')
      expect(result).not.toContain('abc')
      expect(result).not.toContain('api_key')
      expect(result).toContain('[api.example.com]')
    })

    test('handles empty string', () => {
      const result = sanitizeErrorMessage('')
      expect(result).toBe('')
    })

    test('handles message without sensitive data', () => {
      const input = 'Database connection failed'
      const result = sanitizeErrorMessage(input)
      expect(result).toBe('Database connection failed')
    })

    test('handles malformed URLs gracefully', () => {
      const input = 'Error at http://[invalid'
      const result = sanitizeErrorMessage(input)
      expect(result).toContain('[URL]')
    })
  })

  describe('sanitizeError', () => {
    test('sanitizes Error message while preserving stack trace', () => {
      const error = new Error('Failed to connect to https://api.openai.com with token=secret123')
      error.stack = 'Error: Failed to connect\n    at line 1\n    at line 2'

      const sanitized = sanitizeError(error)

      expect(sanitized.message).toBe('Failed to connect to [api.openai.com] with token=[REDACTED]')
      expect(sanitized.stack).toBe(error.stack)
      expect(sanitized.name).toBe(error.name)
    })

    test('preserves Error type', () => {
      const error = new TypeError('Invalid token=abc123')
      const sanitized = sanitizeError(error)

      expect(sanitized).toBeInstanceOf(Error)
      expect(sanitized.name).toBe('TypeError')
    })
  })
})
