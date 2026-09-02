import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { ENV } from '../src/config/env.js';
import { UserModel } from '../src/database/models/User.model.js';
import { PilotModel } from '../src/database/models/Pilot.model.js';
import { MissionModel } from '../src/database/models/Mission.model.js';

describe('Mission Operations Routes (/api/missions)', () => {
  const mockPilotUserId = new mongoose.Types.ObjectId();
  const mockGmUserId = new mongoose.Types.ObjectId();
  const mockAdminUserId = new mongoose.Types.ObjectId();

  const pilotToken = jwt.sign(
    { userId: mockPilotUserId.toString(), role: 'PILOT', discordId: 'disc_pilot' },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const gmToken = jwt.sign(
    { userId: mockGmUserId.toString(), role: 'GM', discordId: 'disc_gm' },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { userId: mockAdminUserId.toString(), role: 'ADMIN', discordId: 'disc_admin' },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/missions - should allow GM to create a new mission', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockGmUserId,
      username: 'gm_miranda',
      role: 'GM'
    } as any);

    const mockMission = {
      _id: new mongoose.Types.ObjectId(),
      gm_id: mockGmUserId,
      title: 'Operation Iron Vanguard',
      contractor: 'IPS-Northstar',
      difficulty: 'HARD',
      min_ll: 1,
      max_ll: 4,
      slots_total: 4,
      start_date: '2026-09-10',
      start_time: '20:00',
      end_date: '2026-09-10',
      briefing: 'Defend orbital freight refinery from piratical raiders.',
      status: 'OPEN',
      applications: []
    };

    vi.spyOn(MissionModel, 'create').mockResolvedValueOnce(mockMission as any);

    const res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${gmToken}`)
      .send({
        title: 'Operation Iron Vanguard',
        contractor: 'IPS-Northstar',
        difficulty: 'HARD',
        min_ll: 1,
        max_ll: 4,
        slots_total: 4,
        start_date: '2026-09-10',
        start_time: '20:00',
        end_date: '2026-09-10',
        briefing: 'Defend orbital freight refinery from piratical raiders.'
      });

    expect(res.status).toBe(201);
    expect(res.body.mission.title).toBe('Operation Iron Vanguard');
    expect(res.body.mission.status).toBe('OPEN');
  });

  it('POST /api/missions - should forbid regular PILOT from creating missions (403)', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotUserId,
      username: 'pilot_user',
      role: 'PILOT'
    } as any);

    const res = await request(app)
      .post('/api/missions')
      .set('Authorization', `Bearer ${pilotToken}`)
      .send({
        title: 'Unauthorized Mission',
        start_date: '2026-09-10',
        start_time: '20:00',
        end_date: '2026-09-10',
        briefing: 'Forbidden'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('GET /api/missions - should list open missions with pagination', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotUserId,
      role: 'PILOT'
    } as any);

    const mockMissions = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Operation Iron Vanguard',
        status: 'OPEN',
        slots_total: 4,
        populate: vi.fn().mockReturnThis()
      }
    ];

    vi.spyOn(MissionModel, 'find').mockReturnValueOnce({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockMissions)
          })
        })
      })
    } as any);

    vi.spyOn(MissionModel, 'countDocuments').mockResolvedValueOnce(1 as any);

    const res = await request(app)
      .get('/api/missions?status=OPEN')
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(200);
    expect(res.body.missions.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('POST /api/missions/:id/apply - should enroll approved pilot in mission', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotUserId,
      role: 'PILOT'
    } as any);

    const missionId = new mongoose.Types.ObjectId();
    const mockMission = {
      _id: missionId,
      title: 'Operation Iron Vanguard',
      status: 'OPEN',
      min_ll: 1,
      max_ll: 4,
      applications: [],
      save: vi.fn().mockResolvedValue(true)
    };

    const mockPilot = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockPilotUserId,
      callsign: 'VANGUARD_ONE',
      license_level: 2,
      status: 'APPROVED',
      active_mission_id: null,
      total_missions_played: 1,
      last_mission_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    };

    vi.spyOn(MissionModel, 'findById').mockResolvedValueOnce(mockMission as any);
    vi.spyOn(PilotModel, 'findOne').mockResolvedValueOnce(mockPilot as any);

    const res = await request(app)
      .post(`/api/missions/${missionId}/apply`)
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(200);
    expect(res.body.application.callsign).toBe('VANGUARD_ONE');
    expect(res.body.application.status).toBe('PENDING');
    expect(mockMission.save).toHaveBeenCalled();
  });

  it('POST /api/missions/:id/apply - should reject pilot with PENDING_APPROVAL status', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotUserId,
      role: 'PILOT'
    } as any);

    const missionId = new mongoose.Types.ObjectId();
    const mockMission = {
      _id: missionId,
      status: 'OPEN',
      min_ll: 0,
      max_ll: 4,
      applications: []
    };

    const mockPilot = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockPilotUserId,
      callsign: 'ROOKIE',
      license_level: 0,
      status: 'PENDING_APPROVAL',
      active_mission_id: null
    };

    vi.spyOn(MissionModel, 'findById').mockResolvedValueOnce(mockMission as any);
    vi.spyOn(PilotModel, 'findOne').mockResolvedValueOnce(mockPilot as any);

    const res = await request(app)
      .post(`/api/missions/${missionId}/apply`)
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PILOT_NOT_APPROVED');
  });

  it('POST /api/missions/:id/start - should deploy selected pilots and transition to IN_PROGRESS', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockGmUserId,
      role: 'GM'
    } as any);

    const missionId = new mongoose.Types.ObjectId();
    const pilotId = new mongoose.Types.ObjectId();

    const mockMission = {
      _id: missionId,
      gm_id: mockGmUserId,
      title: 'Operation Iron Vanguard',
      status: 'OPEN',
      applications: [
        { pilot_id: pilotId, status: 'SELECTED' }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(MissionModel, 'findById').mockResolvedValueOnce(mockMission as any);
    vi.spyOn(PilotModel, 'updateMany').mockResolvedValueOnce({} as any);

    const res = await request(app)
      .post(`/api/missions/${missionId}/start`)
      .set('Authorization', `Bearer ${gmToken}`);

    expect(res.status).toBe(200);
    expect(mockMission.status).toBe('IN_PROGRESS');
    expect(PilotModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [pilotId] } },
      { active_mission_id: missionId }
    );
  });

  it('POST /api/missions/:id/complete - should release pilots, register AAR and set COMPLETED', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockGmUserId,
      role: 'GM'
    } as any);

    const missionId = new mongoose.Types.ObjectId();
    const pilotId = new mongoose.Types.ObjectId();

    const mockMission = {
      _id: missionId,
      gm_id: mockGmUserId,
      title: 'Operation Iron Vanguard',
      status: 'IN_PROGRESS',
      aar: null,
      applications: [
        { pilot_id: pilotId, status: 'SELECTED' }
      ],
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(MissionModel, 'findById').mockResolvedValueOnce(mockMission as any);
    vi.spyOn(PilotModel, 'updateMany').mockResolvedValueOnce({} as any);

    const res = await request(app)
      .post(`/api/missions/${missionId}/complete`)
      .set('Authorization', `Bearer ${gmToken}`)
      .send({ aar: 'Mission accomplished with minimal structural damage to IPS-N assets.' });

    expect(res.status).toBe(200);
    expect(mockMission.status).toBe('COMPLETED');
    expect(mockMission.aar).toBe('Mission accomplished with minimal structural damage to IPS-N assets.');
    expect(PilotModel.updateMany).toHaveBeenCalled();
  });
});
