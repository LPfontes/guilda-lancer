import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { ENV } from '../src/config/env.js';
import { UserModel, PilotModel } from '../src/database/db.js';

describe('Pilot Management Routes (/api/pilots)', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockAdminId = new mongoose.Types.ObjectId();

  const pilotToken = jwt.sign(
    { userId: mockUserId.toString(), discord_id: 'discord_pilot_1', name: 'Pilot User', role: 'PILOT' },
    ENV.JWT_SECRET
  );

  const adminToken = jwt.sign(
    { userId: mockAdminId.toString(), discord_id: 'discord_admin_1', name: 'Admin User', role: 'ADMIN' },
    ENV.JWT_SECRET
  );

  const sampleCompconData = {
    callsign: 'IRONCLAD',
    name: 'Marcus Vance',
    level: 1,
    grit: 1,
    hase: [1, 0, 1, 0],
    talents: [
      { id: 't_siege_specialist', name: 'Siege Specialist', rank: 2 },
      { id: 't_heavy_gunner', name: 'Heavy Gunner', rank: 1 },
      { id: 't_vanguard', name: 'Vanguard', rank: 1 }
    ],
    skills: [
      { id: 's_hull', name: 'Endure', bonus: 2 },
      { id: 's_spot', name: 'Spot', bonus: 2 }
    ],
    mechs: [
      {
        id: 'mech_iron_1',
        name: 'Iron Bastion',
        frame: 'IPS-N Drake',
        active: true
      }
    ]
  };

  it('POST /api/pilots/preview - should validate and parse COMP/CON data without authentication', async () => {
    const res = await request(app)
      .post('/api/pilots/preview')
      .send({ compcon_data: sampleCompconData, share_code: 'IRON99' });

    expect(res.status).toBe(200);
    expect(res.body.parsed).toBeDefined();
    expect(res.body.parsed.callsign).toBe('IRONCLAD');
    expect(res.body.parsed.license_level).toBe(1);
    expect(res.body.parsed.active_mech_name).toBe('Iron Bastion');
    expect(res.body.parsed.active_mech_frame).toBe('IPS-N Drake');
    expect(res.body.tactical_summary).toContain('IRONCLAD');
    expect(res.body.is_valid).toBe(true);
  });

  it('POST /api/pilots/preview - should return error if no COMP/CON data or share code is sent', async () => {
    const res = await request(app).post('/api/pilots/preview').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_PILOT_DATA');
  });

  it('POST /api/pilots/submit - should require JWT authentication', async () => {
    const res = await request(app)
      .post('/api/pilots/submit')
      .send({ compcon_data: sampleCompconData });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('POST /api/pilots/submit - should submit and save new pilot sheet with PENDING_APPROVAL status', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      discord_id: 'discord_pilot_1',
      name: 'Pilot User',
      role: 'PILOT'
    } as any);

    vi.spyOn(PilotModel, 'findOne').mockResolvedValueOnce(null);
    vi.spyOn(PilotModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(PilotModel, 'updateMany').mockResolvedValueOnce({} as any);

    const mockSavedPilot = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      callsign: 'IRONCLAD',
      name: 'Marcus Vance',
      license_level: 1,
      status: 'PENDING_APPROVAL',
      talents: sampleCompconData.talents,
      skills: sampleCompconData.skills,
      active_mech_name: 'Iron Bastion',
      active_mech_frame: 'IPS-N Drake',
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PilotModel, 'create').mockResolvedValueOnce(mockSavedPilot as any);

    const res = await request(app)
      .post('/api/pilots/submit')
      .set('Authorization', `Bearer ${pilotToken}`)
      .send({ compcon_data: sampleCompconData, share_code: 'IRON99' });

    expect(res.status).toBe(200);
    expect(res.body.pilot.status).toBe('PENDING_APPROVAL');
    expect(res.body.pilot.callsign).toBe('IRONCLAD');
    expect(res.body.tactical_summary).toBeDefined();
  });

  it('GET /api/pilots/me - should return user pilots roster (hangar) and active pilot dossier', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      discord_id: 'discord_pilot_1',
      name: 'Pilot User',
      role: 'PILOT'
    } as any);

    const mockPilot1 = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      callsign: 'IRONCLAD',
      license_level: 1,
      grit: 1,
      hull: 1,
      agility: 0,
      systems: 1,
      engineering: 0,
      is_active: true,
      status: 'APPROVED',
      active_mech_name: 'Iron Bastion',
      active_mech_frame: 'IPS-N Drake'
    };

    const mockPilot2 = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      callsign: 'SPECTRE',
      license_level: 2,
      grit: 1,
      hull: 0,
      agility: 2,
      systems: 2,
      engineering: 0,
      is_active: false,
      status: 'PENDING_APPROVAL',
      active_mech_name: 'Ghost Walk',
      active_mech_frame: 'SSC Mourning Cloak'
    };

    vi.spyOn(PilotModel, 'find').mockReturnValueOnce({
      populate: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([mockPilot1, mockPilot2])
        })
      })
    } as any);

    const res = await request(app)
      .get('/api/pilots/me')
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.pilots.length).toBe(2);
    expect(res.body.active_pilot.callsign).toBe('IRONCLAD');
    expect(res.body.tactical_summary).toContain('OMNINET ARCHIVE RECORD');
  });

  it('POST /api/pilots/:id/activate - should set selected pilot as active in user hangar', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      username: 'pilot_user',
      role: 'PILOT'
    } as any);

    const targetPilotId = new mongoose.Types.ObjectId();
    const mockPilot = {
      _id: targetPilotId,
      user_id: mockUserId,
      callsign: 'SPECTRE',
      is_active: false,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PilotModel, 'findOne').mockResolvedValueOnce(mockPilot as any);
    vi.spyOn(PilotModel, 'updateMany').mockResolvedValueOnce({} as any);

    const res = await request(app)
      .post(`/api/pilots/${targetPilotId}/activate`)
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(200);
    expect(res.body.active_pilot.callsign).toBe('SPECTRE');
    expect(mockPilot.is_active).toBe(true);
    expect(mockPilot.save).toHaveBeenCalled();
  });

  it('POST /api/pilots/:id/review - should block PILOT from reviewing sheets (403 Forbidden)', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      role: 'PILOT'
    } as any);

    const randomPilotId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/pilots/${randomPilotId}/review`)
      .set('Authorization', `Bearer ${pilotToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('POST /api/pilots/:id/review - should allow ADMIN to approve a pending sheet', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockAdminId,
      username: 'admin_evaluator',
      role: 'ADMIN'
    } as any);

    const targetPilotId = new mongoose.Types.ObjectId();
    const mockPilotDoc = {
      _id: targetPilotId,
      callsign: 'RECON_ONE',
      status: 'PENDING_APPROVAL',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce(mockPilotDoc as any);

    const res = await request(app)
      .post(`/api/pilots/${targetPilotId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.pilot.status).toBe('APPROVED');
    expect(res.body.pilot.reviewed_by.toString()).toBe(mockAdminId.toString());
    expect(mockPilotDoc.save).toHaveBeenCalled();
  });

  it('POST /api/pilots/:id/review - should require rejection_reason when status is REJECTED', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockAdminId,
      username: 'admin_evaluator',
      role: 'ADMIN'
    } as any);

    const targetPilotId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/pilots/${targetPilotId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('REASON_REQUIRED');
  });

  it('POST /api/pilots - should manually create a new pilot for the authenticated user', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      username: 'pilot_user',
      role: 'PILOT'
    } as any);

    vi.spyOn(PilotModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(PilotModel, 'updateMany').mockResolvedValueOnce({} as any);

    const manualPilot = {
      _id: new mongoose.Types.ObjectId(),
      user_id: mockUserId,
      callsign: 'SENTINEL',
      name: 'Arthur Pendelton',
      license_level: 0,
      grit: 0,
      hull: 0,
      agility: 0,
      systems: 0,
      engineering: 0,
      heat_dice: '1d6',
      is_active: true,
      status: 'PENDING_APPROVAL'
    };

    vi.spyOn(PilotModel, 'create').mockResolvedValueOnce(manualPilot as any);

    const res = await request(app)
      .post('/api/pilots')
      .set('Authorization', `Bearer ${pilotToken}`)
      .send({
        callsign: 'Sentinel',
        name: 'Arthur Pendelton',
        license_level: 0
      });

    expect(res.status).toBe(201);
    expect(res.body.pilot.callsign).toBe('SENTINEL');
    expect(res.body.pilot.is_active).toBe(true);
  });

  it('PUT /api/pilots/:id - should update existing pilot fields and recalculate grit', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      username: 'pilot_user',
      role: 'PILOT'
    } as any);

    const pilotId = new mongoose.Types.ObjectId();
    const existingPilot = {
      _id: pilotId,
      user_id: mockUserId,
      callsign: 'SENTINEL',
      license_level: 0,
      grit: 0,
      hull: 0,
      status: 'APPROVED',
      active_mission_id: null,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce(existingPilot as any);

    const res = await request(app)
      .put(`/api/pilots/${pilotId}`)
      .set('Authorization', `Bearer ${pilotToken}`)
      .send({
        license_level: 2,
        hull: 2
      });

    expect(res.status).toBe(200);
    expect(existingPilot.license_level).toBe(2);
    expect(existingPilot.grit).toBe(1); // ceil(2 / 2)
    expect(existingPilot.status).toBe('PENDING_APPROVAL'); // combat changes reset to pending
    expect(existingPilot.save).toHaveBeenCalled();
  });

  it('DELETE /api/pilots/:id - should remove pilot from user hangar', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockUserId,
      username: 'pilot_user',
      role: 'PILOT'
    } as any);

    const pilotId = new mongoose.Types.ObjectId();
    const existingPilot = {
      _id: pilotId,
      user_id: mockUserId,
      callsign: 'SENTINEL',
      is_active: false,
      active_mission_id: null
    };

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce(existingPilot as any);
    vi.spyOn(PilotModel, 'findByIdAndDelete').mockResolvedValueOnce(existingPilot as any);

    const res = await request(app)
      .delete(`/api/pilots/${pilotId}`)
      .set('Authorization', `Bearer ${pilotToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removida do hangar');
  });
});

