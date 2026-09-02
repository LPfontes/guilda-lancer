import mongoose, { Schema, Document } from 'mongoose';

export type PilotStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface IPilotTalent {
  id: string;
  name: string;
  rank: number;
}

export interface IPilotSkill {
  id: string;
  name: string;
  bonus: number;
}

export interface IPilotLicense {
  id: string;
  rank: number;
}

export interface IPilotMech {
  id: string;
  name: string;
  frame: string;
  active: boolean;
  loadout?: any;
}

export interface IPilot extends Document {
  user_id: mongoose.Types.ObjectId;
  callsign: string;
  name?: string;
  license_level: number;
  stars: number;
  grit: number;
  hull: number;
  agility: number;
  systems: number;
  engineering: number;
  heat_dice?: string;
  talents: IPilotTalent[];
  skills: IPilotSkill[];
  licenses: IPilotLicense[];
  mechs: IPilotMech[];
  active_mech_name?: string;
  active_mech_frame?: string;
  is_active: boolean;
  status: PilotStatus;
  share_code?: string;
  active_mission_id?: mongoose.Types.ObjectId | null;
  total_missions_played: number;
  last_mission_date?: Date | null;
  compcon_raw?: any;
  rejection_reason?: string | null;
  reviewed_by?: mongoose.Types.ObjectId | null;
  reviewed_at?: Date | null;
  validation_warnings?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PilotSchema = new Schema<IPilot>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '[!] user_id é obrigatório. Um piloto só pode existir vinculado a um operador.'],
      index: true
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true
    },
    callsign: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    license_level: {
      type: Number,
      default: 0,
      min: 0,
      max: 12
    },
    stars: {
      type: Number,
      default: 0,
      min: 0
    },
    grit: {
      type: Number,
      default: 0,
      min: 0
    },
    hull: {
      type: Number,
      default: 0,
      min: 0,
      max: 6
    },
    agility: {
      type: Number,
      default: 0,
      min: 0,
      max: 6
    },
    systems: {
      type: Number,
      default: 0,
      min: 0,
      max: 6
    },
    engineering: {
      type: Number,
      default: 0,
      min: 0,
      max: 6
    },
    heat_dice: {
      type: String,
      default: '1d6'
    },
    talents: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          rank: { type: Number, required: true, default: 1 }
        }
      ],
      default: []
    },
    skills: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          bonus: { type: Number, required: true, default: 2 }
        }
      ],
      default: []
    },
    licenses: {
      type: [
        {
          id: { type: String, required: true },
          rank: { type: Number, required: true, default: 1 }
        }
      ],
      default: []
    },
    mechs: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          frame: { type: String, required: true },
          active: { type: Boolean, default: false },
          loadout: { type: Schema.Types.Mixed }
        }
      ],
      default: []
    },
    active_mech_name: {
      type: String,
      default: ''
    },
    active_mech_frame: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true
    },
    share_code: {
      type: String,
      trim: true
    },
    active_mission_id: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      default: null
    },
    total_missions_played: {
      type: Number,
      default: 0
    },
    last_mission_date: {
      type: Date,
      default: null
    },
    compcon_raw: {
      type: Schema.Types.Mixed
    },
    rejection_reason: {
      type: String,
      default: null
    },
    reviewed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewed_at: {
      type: Date,
      default: null
    },
    validation_warnings: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Índices compostos para consultas rápidas de 1 Usuário -> N Pilotos
PilotSchema.index({ user_id: 1, is_active: -1 });
PilotSchema.index({ user_id: 1, callsign: 1 });

// Validação de Integridade Relacional: Um piloto só pode existir se o operador (User) existir
PilotSchema.pre('save', async function () {
  if (this.isModified('user_id') || this.isNew) {
    const UserModel = mongoose.models.User || mongoose.model('User');
    const userExists = await UserModel.exists({ _id: this.user_id });
    if (!userExists) {
      throw new Error(`[!] Operador não localizado: Um piloto só pode existir vinculado a um usuário válido existente (ID: ${this.user_id}).`);
    }
  }
});

export const PilotModel = mongoose.models.Pilot || mongoose.model<IPilot>('Pilot', PilotSchema);
