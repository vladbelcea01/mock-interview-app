import * as bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { feedback, interviewSessions, participants, users } from './schema';
import type { Recommendation, SessionType } from './schema';

/**
 * Deterministic demo data: 3 accounts, 6 participants, ~34 sessions over the last 8 weeks plus upcoming ones.
 * Scores trend upward per participant so the progress charts tell a story. WIPES ALL DATA before inserting.
 */

const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

const PARTICIPANTS = [
  {
    fullName: 'Andrei Ionescu',
    email: 'andrei.ionescu@example.com',
    targetRole: 'Backend Engineer',
    seniority: 'MID',
    base: 2.2,
  },
  {
    fullName: 'Ioana Marinescu',
    email: 'ioana.marinescu@example.com',
    targetRole: 'Frontend Engineer',
    seniority: 'JUNIOR',
    base: 1.8,
  },
  {
    fullName: 'Mihai Dumitru',
    email: 'mihai.dumitru@example.com',
    targetRole: 'Full Stack Engineer',
    seniority: 'SENIOR',
    base: 3.2,
  },
  { fullName: 'Elena Stan', email: 'elena.stan@example.com', targetRole: 'Data Engineer', seniority: 'MID', base: 2.6 },
  {
    fullName: 'Radu Georgescu',
    email: 'radu.georgescu@example.com',
    targetRole: 'DevOps Engineer',
    seniority: 'MID',
    base: 2.4,
  },
  {
    fullName: 'Ana Popa',
    email: 'ana.popa@example.com',
    targetRole: 'Embedded Software Engineer',
    seniority: 'JUNIOR',
    base: 2.0,
  },
] as const;

const TOPICS: Record<SessionType, string[]> = {
  CODING: ['Arrays & hashing', 'Graph traversal', 'Dynamic programming', 'Two pointers', 'Trees & recursion'],
  SYSTEM_DESIGN: ['URL shortener', 'Rate limiter', 'Chat service', 'Notification system', 'File storage'],
  BEHAVIORAL: ['Conflict in a team', 'Ownership & failure', 'Prioritising under pressure', 'Mentoring'],
  TECHNICAL: ['REST API design', 'SQL indexing & queries', 'Docker & CI/CD', 'Angular change detection', 'Concurrency'],
};
const TYPE_LABEL: Record<SessionType, string> = {
  CODING: 'Coding',
  SYSTEM_DESIGN: 'System design',
  BEHAVIORAL: 'Behavioral',
  TECHNICAL: 'Technical deep-dive',
};
const TYPES: SessionType[] = ['CODING', 'SYSTEM_DESIGN', 'TECHNICAL', 'BEHAVIORAL', 'CODING'];

const STRENGTHS = [
  'Clarified requirements before coding and stated assumptions out loud.',
  'Clean, readable code with meaningful names; tested edge cases unprompted.',
  'Good structure: started from a simple design and evolved it with clear trade-offs.',
  'Communicated thought process continuously and reacted well to hints.',
  'Solid understanding of indexing and query plans; justified choices with data.',
  'Concrete, well-structured STAR answers with measurable outcomes.',
];
const IMPROVEMENTS = [
  'Discuss time and space complexity before optimising.',
  'Spend less time on boilerplate; outline the approach first.',
  'Consider failure modes and back-pressure earlier in the design.',
  'Practice dynamic programming patterns (memoisation vs tabulation).',
  'Quantify scale assumptions (requests per second, data size) up front.',
  'Keep answers shorter and land the key point in the first minute.',
];

function recommendationFor(score: number): Recommendation {
  if (score >= 4.5) return 'STRONG_HIRE';
  if (score >= 3.5) return 'HIRE';
  if (score >= 2.5) return 'NO_HIRE';
  return 'STRONG_NO_HIRE';
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const db = drizzle(pool, { schema });
  const now = Date.now();

  try {
    await db.transaction(async (tx) => {
      await tx.delete(feedback);
      await tx.delete(interviewSessions);
      await tx.delete(participants);
      await tx.delete(users);

      const [admin, alex, maria] = await tx
        .insert(users)
        .values([
          {
            email: 'admin@demo.dev',
            name: 'Demo Admin',
            role: 'ADMIN',
            passwordHash: await bcrypt.hash('Admin123!', 10),
          },
          {
            email: 'interviewer@demo.dev',
            name: 'Alex Interviewer',
            role: 'INTERVIEWER',
            passwordHash: await bcrypt.hash('Demo123!', 10),
          },
          {
            email: 'maria@demo.dev',
            name: 'Maria Interviewer',
            role: 'INTERVIEWER',
            passwordHash: await bcrypt.hash('Demo123!', 10),
          },
        ])
        .returning();

      const createdParticipants = await tx
        .insert(participants)
        .values(PARTICIPANTS.map(({ base: _base, ...p }) => ({ ...p, createdById: admin.id })))
        .returning();

      let counter = 0;
      for (const [pi, participant] of createdParticipants.entries()) {
        const base = PARTICIPANTS[pi].base;
        const interviewer = pi % 2 === 0 ? alex : maria;
        const pastCount = 5;

        for (let i = 0; i < pastCount; i++) {
          counter++;
          const type = TYPES[(i + pi) % TYPES.length];
          const topic = TOPICS[type][(i + pi) % TOPICS[type].length];
          // Spread over the last ~8 weeks, oldest first, at 10:00 or 15:00.
          const daysAgo = 54 - i * 12 - pi;
          const scheduledAt = new Date(now - daysAgo * DAY);
          scheduledAt.setUTCHours(counter % 2 ? 7 : 12, 0, 0, 0);

          const cancelled = pi === 4 && i === 1 ? true : pi === 1 && i === 2;
          const missingFeedback = (pi === 2 && i === 4) || (pi === 5 && i === 4);

          const [s] = await tx
            .insert(interviewSessions)
            .values({
              title: `${TYPE_LABEL[type]}: ${topic}`,
              type,
              scheduledAt,
              durationMin: type === 'BEHAVIORAL' ? 45 : 60,
              status: cancelled ? 'CANCELLED' : 'COMPLETED',
              completedAt: cancelled ? null : new Date(scheduledAt.getTime() + 60 * 60 * 1000),
              notes: cancelled ? 'Participant asked to reschedule.' : null,
              participantId: participant.id,
              interviewerId: interviewer.id,
            })
            .returning();

          if (cancelled || missingFeedback) continue;

          const progress = base + i * 0.55; // steady improvement across sessions
          const jitter = (k: number) => ((counter * 7 + k * 3) % 5) / 10 - 0.2;
          const scores = {
            problemSolving: clamp(progress + jitter(1)),
            communication: clamp(progress + 0.3 + jitter(2)),
            technicalDepth: clamp(progress - 0.2 + jitter(3)),
            codeQuality: clamp(progress + jitter(4)),
          };
          const overall =
            (scores.problemSolving + scores.communication + scores.technicalDepth + scores.codeQuality) / 4;

          await tx.insert(feedback).values({
            sessionId: s.id,
            overallRating: clamp(overall),
            ...scores,
            recommendation: recommendationFor(overall),
            strengths: STRENGTHS[(counter + i) % STRENGTHS.length],
            improvements: IMPROVEMENTS[(counter + pi) % IMPROVEMENTS.length],
            summary:
              i === pastCount - 1
                ? 'Clear progress compared to the first sessions. Ready for real interviews at this level.'
                : null,
          });
        }
      }

      // Upcoming sessions for the dashboard's "next 7 days" and the schedule list.
      const upcoming: [number, number, SessionType, string][] = [
        [0, 1, 'SYSTEM_DESIGN', 'Payment processing pipeline'],
        [1, 2, 'CODING', 'Sliding window problems'],
        [3, 4, 'TECHNICAL', 'PostgreSQL performance tuning'],
        [4, 9, 'BEHAVIORAL', 'Leading an incident review'],
      ];
      for (const [pi, inDays, type, topic] of upcoming) {
        const scheduledAt = new Date(now + inDays * DAY);
        scheduledAt.setUTCHours(8, 0, 0, 0);
        await tx.insert(interviewSessions).values({
          title: `${TYPE_LABEL[type]}: ${topic}`,
          type,
          scheduledAt,
          durationMin: 60,
          participantId: createdParticipants[pi].id,
          interviewerId: pi % 2 === 0 ? alex.id : maria.id,
        });
      }
    });
    console.log(
      'Seed complete: admin@demo.dev / Admin123!, interviewer@demo.dev / Demo123!, maria@demo.dev / Demo123!',
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
