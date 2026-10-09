import { relations, sql } from 'drizzle-orm';
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'INTERVIEWER']);
export const seniorityEnum = pgEnum('seniority', ['JUNIOR', 'MID', 'SENIOR']);
export const sessionTypeEnum = pgEnum('session_type', ['CODING', 'SYSTEM_DESIGN', 'BEHAVIORAL', 'TECHNICAL']);
export const sessionStatusEnum = pgEnum('session_status', ['SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const recommendationEnum = pgEnum('recommendation', ['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    role: roleEnum('role').notNull().default('INTERVIEWER'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
);

export const participants = pgTable(
  'participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    targetRole: varchar('target_role', { length: 120 }).notNull(),
    seniority: seniorityEnum('seniority').notNull(),
    notes: text('notes'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('participants_email_key').on(t.email),
    index('participant_fullname_trgm_idx').using('gin', sql`${t.fullName} gin_trgm_ops`),
  ],
);

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    type: sessionTypeEnum('type').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMin: integer('duration_min').notNull(),
    status: sessionStatusEnum('status').notNull().default('SCHEDULED'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id),
    interviewerId: uuid('interviewer_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (t) => [
    index('session_interviewer_scheduled_idx').on(t.interviewerId, t.scheduledAt),
    index('session_participant_scheduled_idx').on(t.participantId, t.scheduledAt),
    index('session_status_idx').on(t.status),
    index('session_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
  ],
);

export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => interviewSessions.id, { onDelete: 'cascade' }),
    overallRating: integer('overall_rating').notNull(),
    problemSolving: integer('problem_solving').notNull(),
    communication: integer('communication').notNull(),
    technicalDepth: integer('technical_depth').notNull(),
    codeQuality: integer('code_quality').notNull(),
    recommendation: recommendationEnum('recommendation').notNull(),
    strengths: text('strengths').notNull(),
    improvements: text('improvements').notNull(),
    summary: text('summary'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('feedback_session_id_key').on(t.sessionId),
    index('feedback_strengths_trgm_idx').using('gin', sql`${t.strengths} gin_trgm_ops`),
    index('feedback_improvements_trgm_idx').using('gin', sql`${t.improvements} gin_trgm_ops`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({ sessions: many(interviewSessions) }));
export const participantsRelations = relations(participants, ({ many }) => ({ sessions: many(interviewSessions) }));
export const sessionsRelations = relations(interviewSessions, ({ one }) => ({
  participant: one(participants, { fields: [interviewSessions.participantId], references: [participants.id] }),
  interviewer: one(users, { fields: [interviewSessions.interviewerId], references: [users.id] }),
  feedback: one(feedback),
}));
export const feedbackRelations = relations(feedback, ({ one }) => ({
  session: one(interviewSessions, { fields: [feedback.sessionId], references: [interviewSessions.id] }),
}));

export type User = typeof users.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type InterviewSession = typeof interviewSessions.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Seniority = (typeof seniorityEnum.enumValues)[number];
export type SessionType = (typeof sessionTypeEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type Recommendation = (typeof recommendationEnum.enumValues)[number];
