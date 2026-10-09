import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createUser, resetDb, TestUser } from './utils';

describe('Participants', () => {
  let app: INestApplication;
  let user: TestUser;
  const http = () => request(app.getHttpServer());
  const base = {
    fullName: 'Ana Popescu',
    email: 'ana@example.com',
    targetRole: 'Backend Engineer',
    seniority: 'MID',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(app);
    user = await createUser(app);
  });
  afterAll(() => app.close());

  it('requires authentication', async () => {
    await http().get('/api/v1/participants').expect(401);
  });

  it('creates a participant with a normalised email', async () => {
    const res = await http()
      .post('/api/v1/participants')
      .set(user.auth)
      .send({ ...base, email: ' Ana@Example.com ' })
      .expect(201);
    expect(res.body).toMatchObject({ id: expect.any(String), fullName: 'Ana Popescu', email: 'ana@example.com' });
  });

  it('returns 409 for a duplicate email in any casing', async () => {
    await http().post('/api/v1/participants').set(user.auth).send(base).expect(201);
    const res = await http()
      .post('/api/v1/participants')
      .set(user.auth)
      .send({ ...base, email: 'ANA@example.com' })
      .expect(409);
    expect(res.body.message).toBe('A participant with this email already exists');
  });

  it('rejects an invalid seniority', async () => {
    await http()
      .post('/api/v1/participants')
      .set(user.auth)
      .send({ ...base, seniority: 'GURU' })
      .expect(400);
  });

  it('searches by partial name, paginates and reports the total', async () => {
    for (const [fullName, email] of [
      ['Ana Popescu', 'ana@x.dev'],
      ['Mariana Ionescu', 'mariana@x.dev'],
      ['Bogdan Stan', 'bogdan@x.dev'],
    ]) {
      await http()
        .post('/api/v1/participants')
        .set(user.auth)
        .send({ ...base, fullName, email })
        .expect(201);
    }
    const res = await http().get('/api/v1/participants?q=ana&pageSize=1').set(user.auth).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].fullName).toBe('Ana Popescu');
    expect(res.body).toMatchObject({ page: 1, pageSize: 1 });
  });

  it('caps pageSize at 100', async () => {
    await http().get('/api/v1/participants?pageSize=500').set(user.auth).expect(400);
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    await http().get('/api/v1/participants/not-a-uuid').set(user.auth).expect(400);
    await http().get('/api/v1/participants/00000000-0000-4000-8000-000000000000').set(user.auth).expect(404);
  });

  it('updates a participant', async () => {
    const created = await http().post('/api/v1/participants').set(user.auth).send(base).expect(201);
    const res = await http()
      .patch(`/api/v1/participants/${created.body.id}`)
      .set(user.auth)
      .send({ seniority: 'SENIOR', notes: 'Strong on databases' })
      .expect(200);
    expect(res.body).toMatchObject({ seniority: 'SENIOR', notes: 'Strong on databases', fullName: 'Ana Popescu' });
  });
});
