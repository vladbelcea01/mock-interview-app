import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth-user';
import { DbService } from '../db/db.service';
import { Feedback, feedback } from '../db/schema';
import { SessionsService } from '../sessions/sessions.service';
import { UpsertFeedbackDto } from './dto/upsert-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly dbService: DbService,
    private readonly sessions: SessionsService,
  ) {}

  /** Creates or replaces the single feedback record of a completed session the caller owns. */
  async upsert(sessionId: string, dto: UpsertFeedbackDto, user: AuthUser): Promise<Feedback> {
    const session = await this.sessions.findOneOwned(sessionId, user);
    if (session.status !== 'COMPLETED') {
      throw new ConflictException('Feedback can only be recorded for completed sessions');
    }
    const values = { summary: null, ...dto };
    const [saved] = await this.dbService.db
      .insert(feedback)
      .values({ ...values, sessionId })
      .onConflictDoUpdate({ target: feedback.sessionId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return saved;
  }

  async get(sessionId: string, user: AuthUser): Promise<Feedback> {
    await this.sessions.findOneOwned(sessionId, user);
    const found = await this.dbService.db.query.feedback.findFirst({ where: eq(feedback.sessionId, sessionId) });
    if (!found) throw new NotFoundException('No feedback recorded for this session yet');
    return found;
  }
}
