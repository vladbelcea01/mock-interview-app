import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth-user';
import { escapeLike } from '../common/pg-errors';
import { DbService } from '../db/db.service';
import { feedback, interviewSessions, participants } from '../db/schema';
import { ownedBy } from '../sessions/sessions.service';

const LIMIT = 5;
const SNIPPET_RADIUS = 60;

export interface SearchResults {
  participants: { id: string; fullName: string; email: string }[];
  sessions: { id: string; title: string; scheduledAt: Date; status: string; participantName: string }[];
  feedback: { sessionId: string; sessionTitle: string; participantName: string; snippet: string }[];
}

/** Returns a short excerpt of `text` centred on the first case-insensitive match of `q`. */
export function snippetAround(text: string, q: string): string {
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + q.length + SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

@Injectable()
export class SearchService {
  constructor(private readonly dbService: DbService) {}

  async search(q: string, user: AuthUser): Promise<SearchResults> {
    const db = this.dbService.db;
    const pattern = `%${escapeLike(q)}%`;

    const [foundParticipants, foundSessions, foundFeedback] = await Promise.all([
      db
        .select({ id: participants.id, fullName: participants.fullName, email: participants.email })
        .from(participants)
        .where(or(ilike(participants.fullName, pattern), ilike(participants.email, pattern)))
        .orderBy(asc(participants.fullName))
        .limit(LIMIT),
      db
        .select({
          id: interviewSessions.id,
          title: interviewSessions.title,
          scheduledAt: interviewSessions.scheduledAt,
          status: interviewSessions.status,
          participantName: participants.fullName,
        })
        .from(interviewSessions)
        .innerJoin(participants, eq(participants.id, interviewSessions.participantId))
        .where(and(ownedBy(user), ilike(interviewSessions.title, pattern)))
        .orderBy(desc(interviewSessions.scheduledAt))
        .limit(LIMIT),
      db
        .select({
          sessionId: feedback.sessionId,
          sessionTitle: interviewSessions.title,
          participantName: participants.fullName,
          strengths: feedback.strengths,
          improvements: feedback.improvements,
          summary: feedback.summary,
        })
        .from(feedback)
        .innerJoin(interviewSessions, eq(interviewSessions.id, feedback.sessionId))
        .innerJoin(participants, eq(participants.id, interviewSessions.participantId))
        .where(
          and(
            ownedBy(user),
            or(
              ilike(feedback.strengths, pattern),
              ilike(feedback.improvements, pattern),
              ilike(feedback.summary, pattern),
            ),
          ),
        )
        .orderBy(desc(interviewSessions.scheduledAt))
        .limit(LIMIT),
    ]);

    return {
      participants: foundParticipants,
      sessions: foundSessions,
      feedback: foundFeedback.map(({ strengths, improvements, summary, ...rest }) => {
        const matched =
          [strengths, improvements, summary].find((t) => t?.toLowerCase().includes(q.toLowerCase())) ?? strengths;
        return { ...rest, snippet: snippetAround(matched ?? '', q) };
      }),
    };
  }
}
