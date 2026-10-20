export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export interface Actor {
  id: string;
  roles: Role[];
}
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function requireRole(actor: Actor, role: Role) {
  if (!actor.roles.includes(role) && !actor.roles.includes("ADMIN"))
    throw new DomainError("You do not have permission to use this area.", 403);
}
export function canEdit(actor: Actor, ownerId: string, collaborator?: string) {
  return (
    actor.roles.includes("ADMIN") ||
    actor.id === ownerId ||
    collaborator === "EDITOR"
  );
}
export function canInstruct(
  actor: Actor,
  ownerId: string,
  collaborator?: string,
) {
  return (
    actor.roles.includes("ADMIN") ||
    actor.id === ownerId ||
    collaborator === "INSTRUCTOR"
  );
}
