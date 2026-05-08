import { makeBadRequestError } from '../../../utils/errors.js';

// Enforced at every entry point (REST + GraphQL) so an oversized note can't
// bypass the AJV boundary by going through the GraphQL resolver.
export const MAX_ACTOR_NOTE_LENGTH = 5000;

export function validateActorNote(note: string | null | undefined): void {
  if (note == null) return;
  if (note.length > MAX_ACTOR_NOTE_LENGTH) {
    throw makeBadRequestError(
      `Moderator note exceeds maximum length of ${MAX_ACTOR_NOTE_LENGTH} characters (got ${note.length})`,
      { shouldErrorSpan: false },
    );
  }
}
