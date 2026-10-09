import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../src/auth/auth-user';
import { DbService } from '../src/db/db.service';
import { participants, Role, users } from '../src/db/schema';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table between test files; schema and migrations stay in place. */
export async function resetDb(app: INestApplication): Promise<void> {
  const { pool } = app.get(DbService);
  await pool.query('TRUNCATE feedback, interview_sessions, participants, users RESTART IDENTITY CASCADE');
}

export interface TestUser {
  id: string;
  token: string;
  auth: { Authorization: string };
}

let userSeq = 0;
/** Inserts a user directly and signs a token for it (skips the throttled /auth endpoints). */
export async function createUser(app: INestApplication, role: Role = 'INTERVIEWER'): Promise<TestUser> {
  const { db } = app.get(DbService);
  const n = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({ email: `user${n}-${Date.now()}@test.dev`, name: `User ${n}`, passwordHash: 'x', role })
    .returning();
  const token = app
    .get(JwtService)
    .sign({ sub: user.id, email: user.email, name: user.name, role: user.role } satisfies JwtPayload);
  return { id: user.id, token, auth: { Authorization: `Bearer ${token}` } };
}

let participantSeq = 0;
export async function createParticipant(app: INestApplication, owner: TestUser, fullName = 'Ana Popescu') {
  const { db } = app.get(DbService);
  const [p] = await db
    .insert(participants)
    .values({
      fullName,
      email: `p${++participantSeq}-${Date.now()}@test.dev`,
      targetRole: 'Backend Engineer',
      seniority: 'MID',
      createdById: owner.id,
    })
    .returning();
  return p;
}
