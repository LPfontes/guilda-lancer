import { IPilot } from './pilot.types.js';

export type UserRole = 'ADMIN' | 'GM' | 'PILOT';

export interface IUser {
  _id: string;
  discord_id: string;
  username: string;
  name: string;
  avatar?: string;
  role: UserRole;
  discord_roles?: string[];
  pilots?: IPilot[];
  createdAt: string;
  updatedAt: string;
}

export interface IAuthSession {
  user: IUser | null;
  pilot: IPilot | null;
  pilots: IPilot[];
}
