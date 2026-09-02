import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'PILOT' | 'PENDING_GM' | 'GM' | 'ADMIN';

export interface IUser extends Document {
  discord_id: string;
  name: string;
  username: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  discord_roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    discord_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    nickname: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    avatar: {
      type: String
    },
    role: {
      type: String,
      enum: ['PILOT', 'PENDING_GM', 'GM', 'ADMIN'],
      default: 'PILOT',
      index: true
    },
    discord_roles: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
