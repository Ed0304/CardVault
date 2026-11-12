// Test-only values. Set before any module imports src/lib/config.ts.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.JWT_ISSUER = "cardvault-api";
process.env.JWT_AUDIENCE = "cardvault-web";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
