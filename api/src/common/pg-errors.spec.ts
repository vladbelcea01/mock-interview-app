import { escapeLike, isUniqueViolation } from './pg-errors';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLike('Ana Popescu')).toBe('Ana Popescu');
  });
});

describe('isUniqueViolation', () => {
  it('detects raw and wrapped Postgres unique violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
