import { Pool } from 'pg';

describe('database schema', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  afterAll(() => pool.end());

  it('has the pg_trgm extension installed', async () => {
    const { rows } = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'");
    expect(rows).toHaveLength(1);
  });

  it('has trigram indexes for search', async () => {
    const { rows } = await pool.query<{ indexname: string }>('SELECT indexname FROM pg_indexes');
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'participant_fullname_trgm_idx',
        'session_title_trgm_idx',
        'feedback_strengths_trgm_idx',
        'feedback_improvements_trgm_idx',
      ]),
    );
  });

  it('has composite indexes for list and history queries', async () => {
    const { rows } = await pool.query<{ indexname: string }>('SELECT indexname FROM pg_indexes');
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'session_interviewer_scheduled_idx',
        'session_participant_scheduled_idx',
        'session_status_idx',
      ]),
    );
  });
});
