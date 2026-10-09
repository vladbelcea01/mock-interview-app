export type Role = 'ADMIN' | 'INTERVIEWER';
export type Seniority = 'JUNIOR' | 'MID' | 'SENIOR';
export type SessionType = 'CODING' | 'SYSTEM_DESIGN' | 'BEHAVIORAL' | 'TECHNICAL';
export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

export const SENIORITIES: Seniority[] = ['JUNIOR', 'MID', 'SENIOR'];
export const SESSION_TYPES: SessionType[] = ['CODING', 'SYSTEM_DESIGN', 'TECHNICAL', 'BEHAVIORAL'];
export const SESSION_STATUSES: SessionStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];
export const RECOMMENDATIONS: Recommendation[] = ['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE'];

export const TYPE_LABELS: Record<SessionType, string> = {
  CODING: 'Coding',
  SYSTEM_DESIGN: 'System design',
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
};
export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  STRONG_HIRE: 'Strong hire',
  HIRE: 'Hire',
  NO_HIRE: 'No hire',
  STRONG_NO_HIRE: 'Strong no hire',
};
export const SKILLS = [
  { key: 'problemSolving', label: 'Problem solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'technicalDepth', label: 'Technical depth' },
  { key: 'codeQuality', label: 'Code quality' },
] as const;
export type SkillKey = (typeof SKILLS)[number]['key'];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Participant {
  id: string;
  fullName: string;
  email: string;
  targetRole: string;
  seniority: Seniority;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export type ParticipantInput = Pick<Participant, 'fullName' | 'email' | 'targetRole' | 'seniority'> & {
  notes?: string | null;
};

export interface Session {
  id: string;
  title: string;
  type: SessionType;
  scheduledAt: string;
  durationMin: number;
  status: SessionStatus;
  completedAt: string | null;
  notes: string | null;
  participantId: string;
  interviewerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface SessionListItem extends Session {
  participant: { id: string; fullName: string };
  interviewer: { id: string; name: string };
  hasFeedback: boolean;
}
export interface SessionDetail extends Session {
  participant: Pick<Participant, 'id' | 'fullName' | 'email' | 'targetRole' | 'seniority'>;
  interviewer: { id: string; name: string; email: string };
  feedback: Feedback | null;
}
export interface SessionInput {
  title: string;
  type: SessionType;
  scheduledAt: string;
  durationMin: number;
  participantId: string;
  notes?: string | null;
}
export interface SessionQuery {
  page?: number;
  pageSize?: number;
  status?: SessionStatus | '';
  type?: SessionType | '';
  participantId?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: 'scheduledAt' | 'createdAt' | 'title';
  order?: 'asc' | 'desc';
}

export interface FeedbackInput {
  overallRating: number;
  problemSolving: number;
  communication: number;
  technicalDepth: number;
  codeQuality: number;
  recommendation: Recommendation;
  strengths: string;
  improvements: string;
  summary?: string | null;
}
export interface Feedback extends FeedbackInput {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  totals: { scheduled: number; completed: number; cancelled: number };
  completedThisMonth: number;
  upcomingNext7Days: number;
  pendingFeedback: number;
  avgOverallRating: number | null;
  byRecommendation: { recommendation: Recommendation; count: number }[];
  byType: { type: SessionType; count: number }[];
  sessionsPerWeek: { week: string; count: number }[];
  skillsPerWeek: ({ week: string } & Record<SkillKey, number | null>)[];
}

export interface TrendPoint extends Record<SkillKey, number> {
  sessionId: string;
  title: string;
  type: SessionType;
  scheduledAt: string;
  overallRating: number;
  recommendation: Recommendation;
}
export interface Trends {
  participant: { id: string; fullName: string };
  points: TrendPoint[];
}

export interface SearchResults {
  participants: { id: string; fullName: string; email: string }[];
  sessions: { id: string; title: string; scheduledAt: string; status: SessionStatus; participantName: string }[];
  feedback: { sessionId: string; sessionTitle: string; participantName: string; snippet: string }[];
}
