import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createParticipant, createTestApp, createUser, resetDb, TestUser } from './utils';

describe('Feedback', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;
  let sessionId: string;
  const http = () => request(app.getHttpServer());
  const body = (overrides: Record<string, unknown> = {}) => ({
    overallRating: 4,
    problemSolving: 4,
    communication: 3,
    technicalDepth: 4,
    codeQuality: 5,
    recommendation: 'HIRE',
    strengths: 'Clear decomposition of the problem',
    improvements: 'Discuss trade-offs earlier',
    ...overrides,
  });
  const put = (u: TestUser, b = body()) => http().put(`/api/v1/sessions/${sessionId}/feedback`).set(u.auth).send(b);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(app);
    alice = await createUser(app);
    bob = await createUser(app);
    const participant = await createParticipant(app, alice);
    const res = await http()
      .post('/api/v1/sessions')
      .set(alice.auth)
      .send({
        title: 'Coding: trees',
        type: 'CODING',
        scheduledAt: '2026-10-01T10:00:00Z',
        durationMin: 45,
        participantId: participant.id,
      })
      .expect(201);
    sessionId = res.body.id;
  });
  afterAll(() => app.close());

  const complete = () => http().post(`/api/v1/sessions/${sessionId}/complete`).set(alice.auth).expect(200);

  it('refuses feedback on a session that is not completed', async () => {
    const res = await put(alice).expect(409);
    expect(res.body.message).toBe('Feedback can only be recorded for completed sessions');
  });

  it('creates then updates a single feedback record', async () => {
    await complete();
    const first = await put(alice).expect(200);
    expect(first.body).toMatchObject({ sessionId, overallRating: 4, recommendation: 'HIRE' });
    const second = await put(alice, body({ overallRating: 5, recommendation: 'STRONG_HIRE' })).expect(200);
    expect(second.body.id).toBe(first.body.id);
    const fetched = await http().get(`/api/v1/sessions/${sessionId}/feedback`).set(alice.auth).expect(200);
    expect(fetched.body).toMatchObject({ overallRating: 5, recommendation: 'STRONG_HIRE' });
  });

  it('validates score range and required text', async () => {
    await complete();
    await put(alice, body({ communication: 6 })).expect(400);
    await put(alice, body({ overallRating: 0 })).expect(400);
    await put(alice, body({ strengths: 'ok' })).expect(400);
    await put(alice, body({ recommendation: 'MAYBE' })).expect(400);
  });

  it('returns 404 when no feedback exists yet', async () => {
    await complete();
    await http().get(`/api/v1/sessions/${sessionId}/feedback`).set(alice.auth).expect(404);
  });

  it("hides another interviewer's feedback behind 404", async () => {
    await complete();
    await put(alice).expect(200);
    await http().get(`/api/v1/sessions/${sessionId}/feedback`).set(bob.auth).expect(404);
    await put(bob).expect(404);
  });

  it('shows feedback in the session detail and list', async () => {
    await complete();
    await put(alice).expect(200);
    const detail = await http().get(`/api/v1/sessions/${sessionId}`).set(alice.auth).expect(200);
    expect(detail.body.feedback).toMatchObject({ overallRating: 4 });
    const list = await http().get('/api/v1/sessions').set(alice.auth).expect(200);
    expect(list.body.items[0].hasFeedback).toBe(true);
  });
});
