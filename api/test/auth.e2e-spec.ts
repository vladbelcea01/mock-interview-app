import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, resetDb } from './utils';

describe('Auth', () => {
  let app: INestApplication;
  let ipCounter = 0;
  /** Each call gets its own client IP so the per-IP auth throttle only bites in the test that targets it. */
  const ip = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
  const http = () => request(app.getHttpServer());
  const post = (url: string, body: Record<string, unknown>) => http().post(url).set('X-Forwarded-For', ip()).send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  const register = (body: Record<string, unknown>) => post('/api/v1/auth/register', body);

  it('registers an interviewer and returns a token without the password hash', async () => {
    const res = await register({ email: 'Ana@Example.com ', password: 'secret123', name: 'Ana' }).expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
      name: 'Ana',
      role: 'INTERVIEWER',
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('rejects attempts to self-assign a role', async () => {
    await register({ email: 'x@example.com', password: 'secret123', name: 'Xena', role: 'ADMIN' }).expect(400);
  });

  it('rejects short passwords and invalid emails', async () => {
    await register({ email: 'not-an-email', password: 'secret123', name: 'Xena' }).expect(400);
    await register({ email: 'y@example.com', password: 'short', name: 'Yuri' }).expect(400);
  });

  it('returns 409 for a duplicate email regardless of case', async () => {
    await register({ email: 'vlad@example.com', password: 'secret123', name: 'Vlad' }).expect(201);
    const res = await register({ email: 'VLAD@example.com', password: 'secret123', name: 'Vlad' }).expect(409);
    expect(res.body.message).toBe('An account with this email already exists');
  });

  it('logs in with valid credentials and returns the same generic error otherwise', async () => {
    await register({ email: 'm@example.com', password: 'secret123', name: 'Maria' }).expect(201);
    const ok = await post('/api/v1/auth/login', { email: 'M@example.com', password: 'secret123' }).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
    const wrongPw = await post('/api/v1/auth/login', { email: 'm@example.com', password: 'nope1234' }).expect(401);
    const unknown = await post('/api/v1/auth/login', { email: 'z@example.com', password: 'nope1234' }).expect(401);
    expect(wrongPw.body.message).toBe('Invalid credentials');
    expect(unknown.body.message).toBe('Invalid credentials');
  });

  it('protects /auth/me: 401 without token, 401 with a tampered token, 200 with a valid one', async () => {
    const reg = await register({ email: 'me@example.com', password: 'secret123', name: 'Me' }).expect(201);
    await http().get('/api/v1/auth/me').expect(401);
    const token: string = reg.body.accessToken;
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${tampered}`).expect(401);
    const me = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body).toMatchObject({ email: 'me@example.com', role: 'INTERVIEWER' });
  });

  it('keeps /health public', async () => {
    await http().get('/api/v1/health').expect(200);
  });

  it('throttles repeated login attempts', async () => {
    const attempts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await http()
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '10.9.9.9')
        .send({ email: 'brute@example.com', password: 'whatever1' });
      attempts.push(res.status);
    }
    expect(attempts.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(attempts[5]).toBe(429);
  });
});
