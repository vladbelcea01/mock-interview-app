import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth-user';
import { DbService } from '../db/db.service';
import { feedback, interviewSessions, participants } from '../db/schema';
import { ownedBy } from '../sessions/sessions.service';

const WEEKS = 12;

export interface Summary {
  totals: { scheduled: number; completed: number; cancelled: number };
  completedThisMonth: number;
  upcomingNext7Days: number;
  pendingFeedback: number;
  avgOverallRating: number | null;
  byRecommendation: { recommendation: string; count: number }[];
  byType: { type: string; count: number }[];
  sessionsPerWeek: { week: string; count: number }[];
  skillsPerWeek: {
    week: string;
    problemSolving: number | null;
    communication: number | null;
    technicalDepth: number | null;
    codeQuality: number | null;
  }[];
}

/** All aggregation happens in Postgres; only small result sets cross the wire. */
@Injectable()
export class ReportsService {
  constructor(private readonly dbService: DbService) {}

  async summary(user: AuthUser): Promise<Summary> {
    const scope: SQL = user.role === 'ADMIN' ? sql`TRUE` : sql`s.interviewer_id = ${user.id}`;
    const pool = this.dbService.db;
    const round = (expr: SQL) => sql`ROUND(${expr}::numeric, 2)::float8`;

    const [counts, byRecommendation, byType, perWeek] = await Promise.all([
      pool.execute<Record<string, number | null>>(sql`
        SELECT
          COUNT(*) FILTER (WHERE s.status = 'SCHEDULED')::int AS scheduled,
          COUNT(*) FILTER (WHERE s.status = 'COMPLETED')::int AS completed,
          COUNT(*) FILTER (WHERE s.status = 'CANCELLED')::int AS cancelled,
          COUNT(*) FILTER (WHERE s.status = 'COMPLETED' AND s.completed_at >= date_trunc('month', now()))::int
            AS completed_this_month,
          COUNT(*) FILTER (WHERE s.status = 'SCHEDULED' AND s.scheduled_at BETWEEN now() AND now() + interval '7 days')::int
            AS upcoming_next_7_days,
          COUNT(*) FILTER (WHERE s.status = 'COMPLETED' AND f.id IS NULL)::int AS pending_feedback,
          ${round(sql`AVG(f.overall_rating)`)} AS avg_overall_rating
        FROM interview_sessions s
        LEFT JOIN feedback f ON f.session_id = s.id
        WHERE ${scope}`),
      pool.execute<{ recommendation: string; count: number }>(sql`
        SELECT f.recommendation, COUNT(*)::int AS count
        FROM feedback f JOIN interview_sessions s ON s.id = f.session_id
        WHERE ${scope}
        GROUP BY f.recommendation ORDER BY count DESC`),
      pool.execute<{ type: string; count: number }>(sql`
        SELECT s.type, COUNT(*)::int AS count
        FROM interview_sessions s
        WHERE ${scope}
        GROUP BY s.type ORDER BY count DESC`),
      // Zero-filled weekly series for the last 12 weeks (cancelled sessions excluded).
      pool.execute<Record<string, string | number | null>>(sql`
        WITH weeks AS (
          SELECT generate_series(
            date_trunc('week', now()) - ${WEEKS - 1} * interval '1 week',
            date_trunc('week', now()),
            interval '1 week'
          ) AS week
        )
        SELECT
          to_char(w.week, 'YYYY-MM-DD') AS week,
          COUNT(s.id)::int AS count,
          ${round(sql`AVG(f.problem_solving)`)} AS problem_solving,
          ${round(sql`AVG(f.communication)`)} AS communication,
          ${round(sql`AVG(f.technical_depth)`)} AS technical_depth,
          ${round(sql`AVG(f.code_quality)`)} AS code_quality
        FROM weeks w
        LEFT JOIN interview_sessions s
          ON date_trunc('week', s.scheduled_at) = w.week AND s.status <> 'CANCELLED' AND ${scope}
        LEFT JOIN feedback f ON f.session_id = s.id
        GROUP BY w.week ORDER BY w.week`),
    ]);

    const c = counts.rows[0];
    return {
      totals: { scheduled: Number(c.scheduled), completed: Number(c.completed), cancelled: Number(c.cancelled) },
      completedThisMonth: Number(c.completed_this_month),
      upcomingNext7Days: Number(c.upcoming_next_7_days),
      pendingFeedback: Number(c.pending_feedback),
      avgOverallRating: c.avg_overall_rating === null ? null : Number(c.avg_overall_rating),
      byRecommendation: byRecommendation.rows,
      byType: byType.rows,
      sessionsPerWeek: perWeek.rows.map((r) => ({ week: String(r.week), count: Number(r.count) })),
      skillsPerWeek: perWeek.rows.map((r) => ({
        week: String(r.week),
        problemSolving: r.problem_solving as number | null,
        communication: r.communication as number | null,
        technicalDepth: r.technical_depth as number | null,
        codeQuality: r.code_quality as number | null,
      })),
    };
  }

  async trends(participantId: string, user: AuthUser, from?: Date, to?: Date) {
    const db = this.dbService.db;
    const participant = await db.query.participants.findFirst({
      where: eq(participants.id, participantId),
      columns: { id: true, fullName: true },
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const points = await db
      .select({
        sessionId: interviewSessions.id,
        title: interviewSessions.title,
        type: interviewSessions.type,
        scheduledAt: interviewSessions.scheduledAt,
        overallRating: feedback.overallRating,
        problemSolving: feedback.problemSolving,
        communication: feedback.communication,
        technicalDepth: feedback.technicalDepth,
        codeQuality: feedback.codeQuality,
        recommendation: feedback.recommendation,
      })
      .from(interviewSessions)
      .innerJoin(feedback, eq(feedback.sessionId, interviewSessions.id))
      .where(
        and(
          ownedBy(user),
          eq(interviewSessions.participantId, participantId),
          eq(interviewSessions.status, 'COMPLETED'),
          from ? gte(interviewSessions.scheduledAt, from) : undefined,
          to ? lte(interviewSessions.scheduledAt, to) : undefined,
        ),
      )
      .orderBy(asc(interviewSessions.scheduledAt));

    return { participant, points };
  }
}
