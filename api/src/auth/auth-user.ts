import type { Role } from '../db/schema';

/** The authenticated caller, as attached to the request by JwtStrategy. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}
