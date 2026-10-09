import { ConflictException } from '@nestjs/common';
import type { SessionStatus } from '../db/schema';

export type SessionAction = 'complete' | 'cancel';

/** Only SCHEDULED sessions can move, and only forward: SCHEDULED → COMPLETED | CANCELLED. */
export function assertCanTransition(status: SessionStatus, action: SessionAction): void {
  if (status === 'COMPLETED') throw new ConflictException('Session is already completed');
  if (status === 'CANCELLED') throw new ConflictException('Session is already cancelled');
  void action;
}

/** Closed sessions keep their history: only `notes` may still change. */
export function assertEditable(status: SessionStatus, changes: Record<string, unknown>): void {
  if (status === 'SCHEDULED') return;
  const changed = Object.entries(changes).filter(([, v]) => v !== undefined);
  if (changed.some(([key]) => key !== 'notes')) {
    throw new ConflictException(`Only notes can be changed on a ${status.toLowerCase()} session`);
  }
}
