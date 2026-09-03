export type PilotStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface IPilotTalent {
  id: string;
  name: string;
  rank: number;
  data?: any;
}

export interface IPilotSkill {
  id: string;
  name: string;
  bonus: number;
  data?: any;
}

export interface IPilotLicense {
  id: string;
  rank: number;
  data?: any;
}

export interface IPilotMech {
  id: string;
  name: string;
  frame: string;
  active: boolean;
  loadout?: any;
}

export interface IPilot {
  _id: string;
  user_id: string;
  callsign: string;
  name?: string;
  license_level: number;
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
  active_mech_image?: string;
  portrait?: string;
  is_active: boolean;
  status: PilotStatus;
  share_code?: string;
  active_mission_id?: string | null;
  total_missions_played: number;
  last_mission_date?: string | null;
  rejection_reason?: string | null;
  reviewed_by?: any;
  reviewed_at?: string | null;
  compcon_raw?: any;
  validation_warnings?: string[];
  createdAt: string;
  updatedAt: string;
}
