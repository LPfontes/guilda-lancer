import mongoose, { Schema, Document } from 'mongoose';

export type PilotStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface IPilot extends Document {
  user_id: mongoose.Types.ObjectId;
  callsign: string;
  license_level: number;
  stars: number;
  status: PilotStatus;
  share_code?: string;
  active_mission_id?: mongoose.Types.ObjectId | null;
  total_missions_played: number;
  last_mission_date?: Date | null;
  compcon_raw?: any;
  rejection_reason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PilotSchema = new Schema<IPilot>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    callsign: {
      type: String,
      required: true,
      trim: true
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
    }
  },
  {
    timestamps: true
  }
);

export const PilotModel = mongoose.models.Pilot || mongoose.model<IPilot>('Pilot', PilotSchema);
