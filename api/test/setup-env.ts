process.env.DATABASE_URL ??= 'postgresql://app:app@localhost:5432/interviews';
process.env.JWT_SECRET ??= 'test-secret';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.CORS_ORIGINS ??= 'http://localhost:4200';
