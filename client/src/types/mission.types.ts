export type MissionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface IMissionApplication {
  pilot_id: any;
  applied_at: string;
  priority_score: number;
  status: 'PENDING' | 'SELECTED' | 'WAITLIST' | 'REJECTED';
}

export interface IMission {
  _id: string;
  gm_id: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  };
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
  optional_rules?: string;
  applications: IMissionApplication[];
  aar?: string | null;
  createdAt: string;
  updatedAt: string;
}
