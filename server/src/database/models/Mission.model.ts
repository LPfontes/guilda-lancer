import mongoose, { Schema, Document } from 'mongoose';

export type MissionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface IMissionApplication {
  pilot_id: mongoose.Types.ObjectId;
  applied_at: Date;
  priority_score: number;
  status: 'PENDING' | 'SELECTED' | 'WAITLIST' | 'REJECTED';
}

export interface IMission extends Document {
  gm_id: mongoose.Types.ObjectId;
  title: string;
  status: MissionStatus;
  contractor: string;
  difficulty: string;
  min_ll: number;
  max_ll: number;
  slots_total: number;
  start_date: string;
  start_time: string;
  end_date: string;
  voice_channel: string;
  platform: string;
  briefing: string;
  optional_rules: string;
  applications: IMissionApplication[];
  aar?: string | null; // After Action Report
  createdAt: Date;
  updatedAt: Date;
}

const MissionSchema = new Schema<IMission>(
  {
    gm_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    },
    contractor: {
      type: String,
      default: 'Union / GMS'
    },
    difficulty: {
      type: String,
      default: 'STANDARD'
    },
    min_ll: {
      type: Number,
      default: 0
    },
    max_ll: {
      type: Number,
      default: 12
    },
    slots_total: {
      type: Number,
      default: 4
    },
    start_date: {
      type: String,
      required: true
    },
    start_time: {
      type: String,
      required: true
    },
    end_date: {
      type: String,
      required: true
    },
    voice_channel: {
      type: String,
      default: '#op-bravo-01'
    },
    platform: {
      type: String,
      default: 'Foundry VTT'
    },
    briefing: {
      type: String,
      required: true
    },
    optional_rules: {
      type: String,
      default: ''
    },
    applications: [
      {
        pilot_id: {
          type: Schema.Types.ObjectId,
          ref: 'Pilot',
          required: true
        },
        applied_at: {
          type: Date,
          default: Date.now
        },
        priority_score: {
          type: Number,
          default: 0
        },
        status: {
          type: String,
          enum: ['PENDING', 'SELECTED', 'WAITLIST', 'REJECTED'],
          default: 'PENDING'
        }
      }
    ],
    aar: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const MissionModel = mongoose.models.Mission || mongoose.model<IMission>('Mission', MissionSchema);
