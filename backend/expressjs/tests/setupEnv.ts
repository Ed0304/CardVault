// Test-only values. Set before any module imports src/lib/config.ts.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.JWT_ISSUER = "cardvault-api";
process.env.JWT_AUDIENCE = "cardvault-web";
// Integration tests use a real database when TEST_DATABASE_URL is set (see npm run db:test:setup).
// Otherwise a placeholder is used, and tests that need a database are skipped.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
