import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DbService } from '../src/db/db.service';

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
