import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DbService } from '../src/db/db.service';
import { createTestApp } from './utils';

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('returns ok when the database answers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns 503 when the database is unreachable', async () => {
    const db = app.get(DbService);
    jest.spyOn(db.pool, 'query').mockRejectedValueOnce(new Error('connect ECONNREFUSED') as never);
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
    expect(res.body).toMatchObject({ status: 'error', db: 'down' });
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        path: '/api/v1/nope',
        timestamp: expect.any(String),
      }),
    );
  });
});
