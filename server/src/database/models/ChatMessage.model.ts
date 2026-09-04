import mongoose, { Schema, Document } from 'mongoose';

export type ChatChannelType = 'MISSION' | 'REPORT';
export type ChatMessageType = 'TEXT' | 'REPORT' | 'SYSTEM';

export interface IReportPayload {
  pilot_name: string;
  pilot_callsign: string;
  mech_name: string;
  current_hp: number;
  max_hp: number;
  current_structure: number;
  current_heat: number;
  total_heat: number;
  current_stress: number;
  current_repairs: number;
  max_repairs: number;
  core_power_used: boolean;
  downtime_action: string;
  downtime_result: string;
  damaged_notes?: string;
  is_validated_by_gm?: boolean;
  validated_by?: mongoose.Types.ObjectId | null;
  validated_by_name?: string | null;
  validated_at?: Date | null;
  gm_notes?: string | null;
}

export interface IChatMessage extends Document {
  channel_type: ChatChannelType;
  mission_id?: mongoose.Types.ObjectId | null;
  author_id: mongoose.Types.ObjectId;
  pilot_id?: mongoose.Types.ObjectId | null;
  author_name: string;
  author_role: string;
  pilot_callsign?: string;
  author_avatar?: string;
  content: string;
  message_type: ChatMessageType;
  report_data?: IReportPayload | null;
  parent_report_id?: mongoose.Types.ObjectId | null; // Para comentários/threads em relatórios
  createdAt: Date;
  updatedAt: Date;
}

const ReportPayloadSchema = new Schema<IReportPayload>(
  {
    pilot_name: { type: String, default: '' },
    pilot_callsign: { type: String, default: '' },
    mech_name: { type: String, default: '' },
    current_hp: { type: Number, default: 0 },
    max_hp: { type: Number, default: 0 },
    current_structure: { type: Number, default: 4 },
    current_heat: { type: Number, default: 0 },
    total_heat: { type: Number, default: 6 },
    current_stress: { type: Number, default: 4 },
    current_repairs: { type: Number, default: 0 },
    max_repairs: { type: Number, default: 4 },
    core_power_used: { type: Boolean, default: false },
    downtime_action: { type: String, default: '' },
    downtime_result: { type: String, default: '' },
    damaged_notes: { type: String, default: '' },
    is_validated_by_gm: { type: Boolean, default: false },
    validated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    validated_by_name: { type: String, default: null },
    validated_at: { type: Date, default: null },
    gm_notes: { type: String, default: null }
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    channel_type: {
      type: String,
      enum: ['MISSION', 'REPORT'],
      required: true,
      index: true
    },
    mission_id: {
      type: Schema.Types.ObjectId,
      ref: 'Mission',
      default: null,
      index: true
    },
    author_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    pilot_id: {
      type: Schema.Types.ObjectId,
      ref: 'Pilot',
      default: null
    },
    author_name: {
      type: String,
      required: true
    },
    author_role: {
      type: String,
      default: 'PILOT'
    },
    pilot_callsign: {
      type: String,
      default: ''
    },
    author_avatar: {
      type: String,
      default: ''
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    message_type: {
      type: String,
      enum: ['TEXT', 'REPORT', 'SYSTEM'],
      default: 'TEXT',
      index: true
    },
    report_data: {
      type: ReportPayloadSchema,
      default: null
    },
    parent_report_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const ChatMessageModel =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
