import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createParticipant, createTestApp, createUser, resetDb, TestUser } from './utils';

describe('Interview sessions', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  let participantId: string;
  const http = () => request(app.getHttpServer());

  const sessionBody = (overrides: Record<string, unknown> = {}) => ({
    title: 'System design: URL shortener',
    type: 'SYSTEM_DESIGN',
    scheduledAt: '2026-10-20T10:00:00.000Z',
    durationMin: 60,
    participantId,
    ...overrides,
  });
  const createAs = (u: TestUser, overrides: Record<string, unknown> = {}) =>
    http().post('/api/v1/sessions').set(u.auth).send(sessionBody(overrides));

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(app);
    alice = await createUser(app);
    bob = await createUser(app);
    admin = await createUser(app, 'ADMIN');
    participantId = (await createParticipant(app, alice)).id;
  });
  afterAll(() => app.close());

  it('creates a session owned by the caller, ignoring any interviewer in the body', async () => {
    const res = await createAs(alice).expect(201);
    expect(res.body).toMatchObject({ status: 'SCHEDULED', interviewerId: alice.id, participantId });
    await createAs(alice, { interviewerId: bob.id }).expect(400);
  });

  it('validates duration bounds and the participant reference', async () => {
    await createAs(alice, { durationMin: 10 }).expect(400);
    await createAs(alice, { durationMin: 241 }).expect(400);
    await createAs(alice, { participantId: '00000000-0000-4000-8000-000000000000' }).expect(404);
  });

  it('allows logging sessions in the past', async () => {
    await createAs(alice, { scheduledAt: '2026-08-01T09:00:00.000Z' }).expect(201);
  });

  it("hides other interviewers' sessions behind 404", async () => {
    const { body } = await createAs(alice).expect(201);
    await http().get(`/api/v1/sessions/${body.id}`).set(bob.auth).expect(404);
    await http().patch(`/api/v1/sessions/${body.id}`).set(bob.auth).send({ notes: 'x' }).expect(404);
    await http().post(`/api/v1/sessions/${body.id}/complete`).set(bob.auth).expect(404);
    await http().post(`/api/v1/sessions/${body.id}/cancel`).set(bob.auth).expect(404);
    await http().get(`/api/v1/sessions/${body.id}`).set(admin.auth).expect(200);
  });

  it('returns 400 for a malformed session id', async () => {
    await http().get('/api/v1/sessions/123').set(alice.auth).expect(400);
  });

  it('scopes the list to the caller unless admin', async () => {
    await createAs(alice).expect(201);
    await createAs(bob).expect(201);
    const mine = await http().get('/api/v1/sessions').set(alice.auth).expect(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.items[0]).toMatchObject({
      interviewer: { id: alice.id },
      participant: { id: participantId, fullName: 'Ana Popescu' },
      hasFeedback: false,
    });
    const all = await http().get('/api/v1/sessions').set(admin.auth).expect(200);
    expect(all.body.total).toBe(2);
  });

  it('filters by status, date range and title text', async () => {
    const a = await createAs(alice, { title: 'Coding: arrays', scheduledAt: '2026-09-01T10:00:00Z' }).expect(201);
    await createAs(alice, { title: 'Behavioral: conflict', scheduledAt: '2026-09-15T10:00:00Z' }).expect(201);
    await createAs(alice, { title: 'Coding: graphs', scheduledAt: '2026-10-01T10:00:00Z' }).expect(201);
    await http().post(`/api/v1/sessions/${a.body.id}/complete`).set(alice.auth).expect(200);

    const completed = await http().get('/api/v1/sessions?status=COMPLETED').set(alice.auth).expect(200);
    expect(completed.body.items.map((s: { id: string }) => s.id)).toEqual([a.body.id]);

    const ranged = await http()
      .get('/api/v1/sessions?from=2026-09-10T00:00:00Z&to=2026-10-31T00:00:00Z&q=coding')
      .set(alice.auth)
      .expect(200);
    expect(ranged.body.items.map((s: { title: string }) => s.title)).toEqual(['Coding: graphs']);
  });

  it('sorts by scheduledAt descending by default and supports ascending', async () => {
    await createAs(alice, { title: 'First', scheduledAt: '2026-09-01T10:00:00Z' }).expect(201);
    await createAs(alice, { title: 'Second', scheduledAt: '2026-09-02T10:00:00Z' }).expect(201);
    const desc = await http().get('/api/v1/sessions').set(alice.auth).expect(200);
    expect(desc.body.items.map((s: { title: string }) => s.title)).toEqual(['Second', 'First']);
    const asc = await http().get('/api/v1/sessions?sort=scheduledAt&order=asc').set(alice.auth).expect(200);
    expect(asc.body.items.map((s: { title: string }) => s.title)).toEqual(['First', 'Second']);
  });

  it('completes a session, sets completedAt and then only allows note edits', async () => {
    const { body } = await createAs(alice).expect(201);
    const done = await http().post(`/api/v1/sessions/${body.id}/complete`).set(alice.auth).expect(200);
    expect(done.body).toMatchObject({ status: 'COMPLETED', completedAt: expect.any(String) });
    await http().post(`/api/v1/sessions/${body.id}/complete`).set(alice.auth).expect(409);
    await http().post(`/api/v1/sessions/${body.id}/cancel`).set(alice.auth).expect(409);
    await http().patch(`/api/v1/sessions/${body.id}`).set(alice.auth).send({ title: 'Changed' }).expect(409);
    const noted = await http()
      .patch(`/api/v1/sessions/${body.id}`)
      .set(alice.auth)
      .send({ notes: 'Great progress' })
      .expect(200);
    expect(noted.body.notes).toBe('Great progress');
  });

  it("lists a participant's history scoped to the caller", async () => {
    await createAs(alice, { title: 'Older', scheduledAt: '2026-09-01T10:00:00Z' }).expect(201);
    await createAs(alice, { title: 'Newer', scheduledAt: '2026-09-20T10:00:00Z' }).expect(201);
    await createAs(bob, { title: 'Bob session' }).expect(201);
    const res = await http().get(`/api/v1/participants/${participantId}/sessions`).set(alice.auth).expect(200);
    expect(res.body.map((s: { title: string }) => s.title)).toEqual(['Newer', 'Older']);
  });
});

describe('Empty updates', () => {
  let app: INestApplication;
  let user: TestUser;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(app);
    user = await createUser(app);
  });
  afterAll(() => app.close());

  it('treats an empty PATCH as a no-op instead of failing', async () => {
    const p = await createParticipant(app, user);
    const s = await http()
      .post('/api/v1/sessions')
      .set(user.auth)
      .send({
        title: 'Coding: heaps',
        type: 'CODING',
        scheduledAt: '2026-10-20T10:00:00Z',
        durationMin: 60,
        participantId: p.id,
      })
      .expect(201);
    const session = await http().patch(`/api/v1/sessions/${s.body.id}`).set(user.auth).send({}).expect(200);
    expect(session.body.title).toBe('Coding: heaps');
    const participant = await http().patch(`/api/v1/participants/${p.id}`).set(user.auth).send({}).expect(200);
    expect(participant.body.id).toBe(p.id);
  });
});
