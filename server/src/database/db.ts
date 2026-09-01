import fs from 'fs';
import path from 'path';

export type UserRole = 'PILOT' | 'PENDING_GM' | 'GM' | 'ADMIN';
export type PilotStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface UserDoc {
  _id: string;
  discord_id: string;
  name: string;
  username: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PilotDoc {
  _id: string;
  user_id: string;
  callsign: string;
  license_level: number;
  stars: number;
  status: PilotStatus;
  share_code?: string;
  active_mission_id: string | null;
  total_missions_played: number;
  last_mission_date: string | null;
  compcon_raw?: any;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  users: UserDoc[];
  pilots: PilotDoc[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'omninet_db.json');

function getInitialData(): DatabaseSchema {
  return {
    users: [],
    pilots: []
  };
}

class JsonDatabase {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch {
        this.data = getInitialData();
        this.save();
      }
    } else {
      this.data = getInitialData();
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[!] Erro ao salvar banco NoSQL:', err);
    }
  }

  public users = {
    find: (predicate?: (user: UserDoc) => boolean): UserDoc[] => {
      return predicate ? this.data.users.filter(predicate) : [...this.data.users];
    },
    findById: (id: string): UserDoc | undefined => {
      return this.data.users.find(u => u._id === id);
    },
    findByDiscordId: (discordId: string): UserDoc | undefined => {
      return this.data.users.find(u => u.discord_id === discordId);
    },
    create: (userData: Omit<UserDoc, '_id' | 'created_at' | 'updated_at'>): UserDoc => {
      const now = new Date().toISOString();
      const newUser: UserDoc = {
        _id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ...userData,
        created_at: now,
        updated_at: now
      };
      this.data.users.push(newUser);
      this.save();
      return newUser;
    },
    update: (id: string, updates: Partial<UserDoc>): UserDoc | undefined => {
      const index = this.data.users.findIndex(u => u._id === id);
      if (index === -1) return undefined;
      const updated: UserDoc = {
        ...this.data.users[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.data.users[index] = updated;
      this.save();
      return updated;
    }
  };

  public pilots = {
    findByUserId: (userId: string): PilotDoc | undefined => {
      return this.data.pilots.find(p => p.user_id === userId);
    }
  };
}

export const db = new JsonDatabase();
