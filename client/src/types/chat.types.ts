export type ChatChannelType = 'MISSION' | 'REPORT';
export type ChatMessageType = 'TEXT' | 'REPORT' | 'SYSTEM';

export interface IReportData {
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
  validated_by?: string | null;
  validated_by_name?: string | null;
  validated_at?: string | null;
  gm_notes?: string | null;
}

export interface IChatMessage {
  _id: string;
  channel_type: ChatChannelType;
  mission_id?: string | null;
  author_id: string | { _id: string; username: string; role: string; avatar?: string };
  pilot_id?: string | { _id: string; callsign: string; active_mech_name?: string; active_mech_frame?: string } | null;
  author_name: string;
  author_role: string;
  pilot_callsign?: string;
  author_avatar?: string;
  content: string;
  message_type: ChatMessageType;
  report_data?: IReportData | null;
  parent_report_id?: string | null;
  createdAt: string;
  updatedAt: string;
}
