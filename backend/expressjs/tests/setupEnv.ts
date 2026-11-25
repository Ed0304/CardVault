// Test-only values. Set before any module imports src/lib/config.ts.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.JWT_ISSUER = "cardvault-api";
process.env.JWT_AUDIENCE = "cardvault-web";
// Integration tests use a real database when TEST_DATABASE_URL is set (see npm run db:test:setup).
// Otherwise a placeholder is used, and tests that need a database are skipped.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
// AI cataloging points at a fake AI service that tests/cataloging.integration.test.ts starts on
// this port. No test reaches the real AI service or the provider.
process.env.AI_SERVICE_URL = "http://127.0.0.1:59123";
process.env.AI_SERVICE_TOKEN = "test-ai-service-token-0123456789abcdef";
process.env.AI_SERVICE_TIMEOUT_MS = "5000";
