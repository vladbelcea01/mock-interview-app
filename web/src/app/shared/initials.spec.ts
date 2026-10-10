import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('uses the first letters of the first and last name', () => {
    expect(initialsOf('Alex Interviewer')).toBe('AI');
    expect(initialsOf('Ana Maria Popescu')).toBe('AP');
  });

  it('handles single names, extra spaces and empty values', () => {
    expect(initialsOf('  maria  ')).toBe('M');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(undefined)).toBe('?');
  });
});
