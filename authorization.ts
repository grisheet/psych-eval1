import type { Actor, Role } from './types';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireRole(actor: Actor, ...roles: Role[]) {
  if (!roles.includes(actor.role))
    throw new AppError(403, 'This action is not available for your account.');
}
export function canReadClinical(actor: Actor, participantId: string, assigned: boolean) {
  return actor.role === 'participant'
    ? actor.id === participantId
    : actor.role === 'clinician' && assigned;
}
export function checkRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new AppError(
      409,
      'This record changed in another window. Reload before saving. Your unsaved text remains in this window.',
    );
}
