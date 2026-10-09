import { ConflictException } from '@nestjs/common';
import { assertCanTransition, assertEditable } from './session-rules';

describe('session rules', () => {
  describe('assertCanTransition', () => {
    it('allows completing or cancelling a scheduled session', () => {
      expect(() => assertCanTransition('SCHEDULED', 'complete')).not.toThrow();
      expect(() => assertCanTransition('SCHEDULED', 'cancel')).not.toThrow();
    });

    it('rejects completing a completed or cancelled session', () => {
      expect(() => assertCanTransition('COMPLETED', 'complete')).toThrow(
        new ConflictException('Session is already completed'),
      );
      expect(() => assertCanTransition('CANCELLED', 'complete')).toThrow(
        new ConflictException('Session is already cancelled'),
      );
    });

    it('rejects cancelling a completed session', () => {
      expect(() => assertCanTransition('COMPLETED', 'cancel')).toThrow(ConflictException);
    });
  });

  describe('assertEditable', () => {
    it('allows any field while scheduled', () => {
      expect(() => assertEditable('SCHEDULED', { title: 'New', durationMin: 30 })).not.toThrow();
    });

    it('allows only notes once completed or cancelled', () => {
      expect(() => assertEditable('COMPLETED', { notes: 'Follow up on SQL' })).not.toThrow();
      expect(() => assertEditable('COMPLETED', { title: 'Changed' })).toThrow(
        new ConflictException('Only notes can be changed on a completed session'),
      );
      expect(() => assertEditable('CANCELLED', { scheduledAt: new Date() })).toThrow(ConflictException);
    });

    it('ignores keys whose value is undefined', () => {
      expect(() => assertEditable('COMPLETED', { title: undefined, notes: 'ok' })).not.toThrow();
    });
  });
});
