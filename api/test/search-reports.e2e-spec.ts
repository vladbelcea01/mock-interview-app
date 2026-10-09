import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createParticipant, createTestApp, createUser, resetDb, TestUser } from './utils';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY).toISOString();

describe('Search and reports', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;
  const http = () => request(app.getHttpServer());

  async function session(u: TestUser, participantId: string, title: string, scheduledAt: string) {
    const res = await http()
      .post('/api/v1/sessions')
      .set(u.auth)
      .send({ title, type: 'CODING', scheduledAt, durationMin: 60, participantId })
      .expect(201);
    return res.body.id as string;
  }
  async function completeWithFeedback(
    u: TestUser,
    id: string,
    overallRating: number,
    improvements = 'Explain trade-offs',
  ) {
    await http().post(`/api/v1/sessions/${id}/complete`).set(u.auth).expect(200);
    await http()
      .put(`/api/v1/sessions/${id}/feedback`)
      .set(u.auth)
      .send({
        overallRating,
        problemSolving: overallRating,
        communication: overallRating,
        technicalDepth: overallRating,
        codeQuality: overallRating,
        recommendation: overallRating >= 4 ? 'HIRE' : 'NO_HIRE',
        strengths: 'Solid fundamentals',
        improvements,
      })
      .expect(200);
  }

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(app);
    alice = await createUser(app);
    bob = await createUser(app);
    admin = await createUser(app, 'ADMIN');
  });
  afterAll(() => app.close());

  describe('GET /search', () => {
    it('requires at least 2 characters', async () => {
      await http().get('/api/v1/search?q=a').set(alice.auth).expect(400);
      await http().get('/api/v1/search').set(alice.auth).expect(400);
    });

    it('treats LIKE wildcards literally', async () => {
      const p = await createParticipant(app, alice, 'Ana Popescu');
      await session(alice, p.id, 'Coding: arrays', daysFromNow(-3));
      const res = await http().get('/api/v1/search?q=%25%25').set(alice.auth).expect(200);
      expect(res.body).toEqual({ participants: [], sessions: [], feedback: [] });
    });

    it('finds participants by partial name, sessions by title and feedback by text', async () => {
      const p = await createParticipant(app, alice, 'Mariana Ionescu');
      const id = await session(alice, p.id, 'Graph algorithms drill', daysFromNow(-2));
      await completeWithFeedback(alice, id, 4, 'Practice dynamic programming patterns');

      const byName = await http().get('/api/v1/search?q=arian').set(alice.auth).expect(200);
      expect(byName.body.participants).toEqual([expect.objectContaining({ id: p.id, fullName: 'Mariana Ionescu' })]);

      const byTitle = await http().get('/api/v1/search?q=graph').set(alice.auth).expect(200);
      expect(byTitle.body.sessions).toEqual([
        expect.objectContaining({ id, title: 'Graph algorithms drill', participantName: 'Mariana Ionescu' }),
      ]);

      const byFeedback = await http().get('/api/v1/search?q=dynamic programming').set(alice.auth).expect(200);
      expect(byFeedback.body.feedback).toEqual([
        expect.objectContaining({
          sessionId: id,
          sessionTitle: 'Graph algorithms drill',
          snippet: expect.stringContaining('dynamic programming'),
        }),
      ]);
    });

    it("never returns other interviewers' sessions or feedback", async () => {
      const p = await createParticipant(app, alice, 'Ana Popescu');
      const id = await session(alice, p.id, 'Secret session', daysFromNow(-2));
      await completeWithFeedback(alice, id, 3, 'Secret improvement note');
      const res = await http().get('/api/v1/search?q=secret').set(bob.auth).expect(200);
      expect(res.body.sessions).toEqual([]);
      expect(res.body.feedback).toEqual([]);
      const asAdmin = await http().get('/api/v1/search?q=secret').set(admin.auth).expect(200);
      expect(asAdmin.body.sessions).toHaveLength(1);
    });
  });

  describe('GET /reports/summary', () => {
    it('aggregates the caller’s activity', async () => {
      const p = await createParticipant(app, alice);
      for (const [i, rating] of [3, 4, 5].entries()) {
        await completeWithFeedback(alice, await session(alice, p.id, `Done ${i}`, daysFromNow(-1 - i * 7)), rating);
      }
      await session(alice, p.id, 'Upcoming', daysFromNow(3));
      const pending = await session(alice, p.id, 'Pending feedback', daysFromNow(-1));
      await http().post(`/api/v1/sessions/${pending}/complete`).set(alice.auth).expect(200);
      // Bob's activity must not leak into Alice's numbers
      await completeWithFeedback(bob, await session(bob, p.id, 'Bob', daysFromNow(-1)), 1);

      const res = await http().get('/api/v1/reports/summary').set(alice.auth).expect(200);
      expect(res.body).toMatchObject({
        totals: { scheduled: 1, completed: 4, cancelled: 0 },
        upcomingNext7Days: 1,
        pendingFeedback: 1,
        avgOverallRating: 4,
      });
      expect(res.body.sessionsPerWeek).toHaveLength(12);
      expect(res.body.skillsPerWeek).toHaveLength(12);
      expect(res.body.byRecommendation).toEqual(
        expect.arrayContaining([
          { recommendation: 'HIRE', count: 2 },
          { recommendation: 'NO_HIRE', count: 1 },
        ]),
      );
      expect(res.body.byType).toEqual([{ type: 'CODING', count: 5 }]);

      const all = await http().get('/api/v1/reports/summary').set(admin.auth).expect(200);
      expect(all.body.totals.completed).toBe(5);
    });

    it('returns null average when there is no feedback', async () => {
      const res = await http().get('/api/v1/reports/summary').set(alice.auth).expect(200);
      expect(res.body.avgOverallRating).toBeNull();
      expect(res.body.totals).toEqual({ scheduled: 0, completed: 0, cancelled: 0 });
    });
  });

  describe('GET /reports/trends', () => {
    it("returns a participant's scored sessions in chronological order, scoped to the caller", async () => {
      const p = await createParticipant(app, alice);
      const older = await session(alice, p.id, 'Older', daysFromNow(-14));
      const newer = await session(alice, p.id, 'Newer', daysFromNow(-2));
      await completeWithFeedback(alice, newer, 5);
      await completeWithFeedback(alice, older, 2);
      await session(alice, p.id, 'Not done yet', daysFromNow(2));

      const res = await http().get(`/api/v1/reports/trends?participantId=${p.id}`).set(alice.auth).expect(200);
      expect(res.body.participant).toMatchObject({ id: p.id });
      expect(
        res.body.points.map((pt: { title: string; overallRating: number }) => [pt.title, pt.overallRating]),
      ).toEqual([
        ['Older', 2],
        ['Newer', 5],
      ]);

      const asBob = await http().get(`/api/v1/reports/trends?participantId=${p.id}`).set(bob.auth).expect(200);
      expect(asBob.body.points).toEqual([]);
    });

    it('validates the participant id', async () => {
      await http().get('/api/v1/reports/trends?participantId=nope').set(alice.auth).expect(400);
      await http()
        .get('/api/v1/reports/trends?participantId=00000000-0000-4000-8000-000000000000')
        .set(alice.auth)
        .expect(404);
    });
  });
});
