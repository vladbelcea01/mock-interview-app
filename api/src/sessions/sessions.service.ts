import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, getTableColumns, gte, ilike, lte, SQL, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth-user';
import { definedOnly, offsetOf, Paginated } from '../common/pagination.dto';
import { escapeLike } from '../common/pg-errors';
import { DbService } from '../db/db.service';
import { feedback, InterviewSession, interviewSessions, participants, users } from '../db/schema';
import { CreateSessionDto } from './dto/create-session.dto';
import { QuerySessionsDto } from './dto/query-sessions.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { assertCanTransition, assertEditable } from './session-rules';

export interface SessionListItem extends InterviewSession {
  participant: { id: string; fullName: string };
  interviewer: { id: string; name: string };
  hasFeedback: boolean;
}

const SORT_COLUMNS = {
  scheduledAt: interviewSessions.scheduledAt,
  createdAt: interviewSessions.createdAt,
  title: interviewSessions.title,
};

/** Restricts a query to the caller's own sessions unless they are an admin. */
export const ownedBy = (user: AuthUser): SQL | undefined =>
  user.role === 'ADMIN' ? undefined : eq(interviewSessions.interviewerId, user.id);

@Injectable()
export class SessionsService {
  constructor(private readonly dbService: DbService) {}

  private get db() {
    return this.dbService.db;
  }

  async findAll(query: QuerySessionsDto, user: AuthUser): Promise<Paginated<SessionListItem>> {
    const where = and(
      ownedBy(user),
      query.status ? eq(interviewSessions.status, query.status) : undefined,
      query.type ? eq(interviewSessions.type, query.type) : undefined,
      query.participantId ? eq(interviewSessions.participantId, query.participantId) : undefined,
      query.from ? gte(interviewSessions.scheduledAt, query.from) : undefined,
      query.to ? lte(interviewSessions.scheduledAt, query.to) : undefined,
      query.q ? ilike(interviewSessions.title, `%${escapeLike(query.q)}%`) : undefined,
    );
    const direction = query.order === 'asc' ? asc : desc;

    const [items, [{ total }]] = await Promise.all([
      this.listQuery()
        .where(where)
        .orderBy(direction(SORT_COLUMNS[query.sort]), direction(interviewSessions.id))
        .limit(query.pageSize)
        .offset(offsetOf(query)),
      this.db.select({ total: count() }).from(interviewSessions).where(where),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findByParticipant(participantId: string, user: AuthUser): Promise<SessionListItem[]> {
    const exists = await this.db.query.participants.findFirst({
      where: eq(participants.id, participantId),
      columns: { id: true },
    });
    if (!exists) throw new NotFoundException('Participant not found');
    return this.listQuery()
      .where(and(ownedBy(user), eq(interviewSessions.participantId, participantId)))
      .orderBy(desc(interviewSessions.scheduledAt));
  }

  /** Loads a session the caller may act on. Not found and not owned look identical (404) on purpose. */
  async findOneOwned(id: string, user: AuthUser): Promise<InterviewSession> {
    const [session] = await this.db
      .select()
      .from(interviewSessions)
      .where(and(eq(interviewSessions.id, id), ownedBy(user)));
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getDetail(id: string, user: AuthUser) {
    await this.findOneOwned(id, user);
    return this.db.query.interviewSessions.findFirst({
      where: eq(interviewSessions.id, id),
      with: {
        participant: { columns: { id: true, fullName: true, email: true, targetRole: true, seniority: true } },
        interviewer: { columns: { id: true, name: true, email: true } },
        feedback: true,
      },
    });
  }

  async create(dto: CreateSessionDto, user: AuthUser): Promise<InterviewSession> {
    await this.assertParticipantExists(dto.participantId);
    const [created] = await this.db
      .insert(interviewSessions)
      .values({ ...dto, interviewerId: user.id })
      .returning();
    return created;
  }

  async update(id: string, dto: UpdateSessionDto, user: AuthUser): Promise<InterviewSession> {
    const session = await this.findOneOwned(id, user);
    assertEditable(session.status, { ...dto });
    const changes = definedOnly(dto);
    if (Object.keys(changes).length === 0) return session;
    if (changes.participantId) await this.assertParticipantExists(changes.participantId);
    const [updated] = await this.db
      .update(interviewSessions)
      .set(changes)
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated;
  }

  async complete(id: string, user: AuthUser): Promise<InterviewSession> {
    const session = await this.findOneOwned(id, user);
    assertCanTransition(session.status, 'complete');
    return this.setStatus(id, { status: 'COMPLETED', completedAt: new Date() });
  }

  async cancel(id: string, user: AuthUser): Promise<InterviewSession> {
    const session = await this.findOneOwned(id, user);
    assertCanTransition(session.status, 'cancel');
    return this.setStatus(id, { status: 'CANCELLED' });
  }

  private async setStatus(id: string, changes: Partial<InterviewSession>): Promise<InterviewSession> {
    // The status guard in the WHERE clause makes concurrent transitions safe: only one can win.
    const [updated] = await this.db
      .update(interviewSessions)
      .set(changes)
      .where(and(eq(interviewSessions.id, id), eq(interviewSessions.status, 'SCHEDULED')))
      .returning();
    if (!updated) throw new ConflictException('Session is no longer scheduled');
    return updated;
  }

  private async assertParticipantExists(participantId: string): Promise<void> {
    const found = await this.db.query.participants.findFirst({
      where: eq(participants.id, participantId),
      columns: { id: true },
    });
    if (!found) throw new NotFoundException('Participant not found');
  }

  private listQuery() {
    return this.db
      .select({
        ...getTableColumns(interviewSessions),
        participant: { id: participants.id, fullName: participants.fullName },
        interviewer: { id: users.id, name: users.name },
        hasFeedback: sql<boolean>`${feedback.id} IS NOT NULL`,
      })
      .from(interviewSessions)
      .innerJoin(participants, eq(participants.id, interviewSessions.participantId))
      .innerJoin(users, eq(users.id, interviewSessions.interviewerId))
      .leftJoin(feedback, eq(feedback.sessionId, interviewSessions.id))
      .$dynamic();
  }
}
