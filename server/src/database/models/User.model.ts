import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'PILOT' | 'PENDING_GM' | 'GM' | 'AVALIADOR' | 'ADMIN';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 4,
  GM: 3,
  AVALIADOR: 2,
  PENDING_GM: 1,
  PILOT: 0
};

export function getHighestRole(roles: UserRole[]): UserRole {
  if (!roles || roles.length === 0) return 'PILOT';
  let highest: UserRole = 'PILOT';
  for (const r of roles) {
    if ((ROLE_HIERARCHY[r] ?? 0) > (ROLE_HIERARCHY[highest] ?? 0)) {
      highest = r;
    }
  }
  return highest;
}

export interface IUser extends Document {
  discord_id: string;
  name: string;
  username: string;
  nickname?: string;
  avatar?: string;
  roles: UserRole[];
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
    avatar: {
      type: String
    },
    roles: {
      type: [String],
      enum: ['PILOT', 'PENDING_GM', 'GM', 'AVALIADOR', 'ADMIN'],
      default: ['PILOT']
    },
    role: {
      type: String,
      enum: ['PILOT', 'PENDING_GM', 'GM', 'AVALIADOR', 'ADMIN'],
      default: 'PILOT',
      index: true
    },
    discord_roles: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Mantém role sincronizada com o maior privilégio contido em roles
UserSchema.pre('save', function () {
  if (!this.roles || this.roles.length === 0) {
    this.roles = ['PILOT'];
  }
  this.role = getHighestRole(this.roles);
});

// Relação 1 Usuário -> N Pilotos (Virtual Populate)
UserSchema.virtual('pilots', {
  ref: 'Pilot',
  localField: '_id',
  foreignField: 'user_id'
});

// Limpeza em cascata: quando um usuário for removido, exclui seus pilotos órfãos
UserSchema.pre('findOneAndDelete', async function () {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    const PilotModel = mongoose.models.Pilot || mongoose.model('Pilot');
    await PilotModel.deleteMany({ user_id: doc._id });
  }
});

export const UserModel = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
