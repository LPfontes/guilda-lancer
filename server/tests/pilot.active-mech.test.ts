import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { ENV } from '../src/config/env.js';
import { UserModel, PilotModel } from '../src/database/db.js';

describe('Active Mech Selection Route (POST /api/pilots/:id/active-mech)', () => {
  const mockOwnerId = new mongoose.Types.ObjectId();
  const mockOtherUserId = new mongoose.Types.ObjectId();
  const mockAdminId = new mongoose.Types.ObjectId();
  const mockPilotId = new mongoose.Types.ObjectId();

  const ownerToken = jwt.sign(
    { userId: mockOwnerId.toString(), discord_id: 'discord_owner', name: 'Owner Pilot', role: 'PILOT' },
    ENV.JWT_SECRET
  );

  const otherUserToken = jwt.sign(
    { userId: mockOtherUserId.toString(), discord_id: 'discord_other', name: 'Other Pilot', role: 'PILOT' },
    ENV.JWT_SECRET
  );

  const adminToken = jwt.sign(
    { userId: mockAdminId.toString(), discord_id: 'discord_admin', name: 'Admin Evaluator', role: 'ADMIN' },
    ENV.JWT_SECRET
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/pilots/:id/active-mech - should return 401 when unauthenticated', async () => {
    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .send({ mech_id: 'mech_secondary' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('POST /api/pilots/:id/active-mech - should return 400 on invalid pilot ID format', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOwnerId,
      discord_id: 'discord_owner',
      name: 'Owner Pilot',
      role: 'PILOT'
    } as any);

    const res = await request(app)
      .post('/api/pilots/invalid-object-id/active-mech')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mech_id: 'mech_secondary' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ID');
  });

  it('POST /api/pilots/:id/active-mech - should return 400 when mech_id is missing', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOwnerId,
      discord_id: 'discord_owner',
      name: 'Owner Pilot',
      role: 'PILOT'
    } as any);

    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MECH_ID_REQUIRED');
  });

  it('POST /api/pilots/:id/active-mech - should return 403 when user is not owner nor admin', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOtherUserId,
      discord_id: 'discord_other',
      name: 'Other Pilot',
      role: 'PILOT'
    } as any);

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotId,
      user_id: mockOwnerId,
      callsign: 'VANGUARD'
    } as any);

    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ mech_id: 'mech_secondary' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('POST /api/pilots/:id/active-mech - should return 400 when pilot is deployed in active mission', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOwnerId,
      discord_id: 'discord_owner',
      name: 'Owner Pilot',
      role: 'PILOT'
    } as any);

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotId,
      user_id: mockOwnerId,
      callsign: 'VANGUARD',
      active_mission_id: new mongoose.Types.ObjectId()
    } as any);

    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mech_id: 'mech_secondary' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PILOT_IN_ACTIVE_MISSION');
  });

  it('POST /api/pilots/:id/active-mech - should return 404 if mech_id does not exist on pilot', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOwnerId,
      discord_id: 'discord_owner',
      name: 'Owner Pilot',
      role: 'PILOT'
    } as any);

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce({
      _id: mockPilotId,
      user_id: mockOwnerId,
      callsign: 'VANGUARD',
      mechs: [
        { id: 'mech_primary', name: 'Iron Bastion', frame: 'GMS Everest', active: true }
      ]
    } as any);

    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mech_id: 'mech_non_existent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MECH_NOT_FOUND');
  });

  it('POST /api/pilots/:id/active-mech - should successfully switch active mech and update telemetries', async () => {
    vi.spyOn(UserModel, 'findById').mockResolvedValueOnce({
      _id: mockOwnerId,
      discord_id: 'discord_owner',
      name: 'Owner Pilot',
      username: 'owner_pilot',
      role: 'PILOT'
    } as any);

    const mockPilot = {
      _id: mockPilotId,
      user_id: mockOwnerId,
      callsign: 'VANGUARD',
      status: 'APPROVED',
      active_mech_name: 'Iron Bastion',
      active_mech_frame: 'GMS Standard Pattern I Everest',
      active_mech_image: '',
      mechs: [
        { id: 'mech_1', name: 'Iron Bastion', frame: 'GMS Standard Pattern I Everest', active: true },
        { id: 'mech_2', name: 'Crimson Monarch', frame: 'SSC Monarch', active: false, cloud_portrait: 'https://img.lancer/monarch.png' }
      ],
      compcon_raw: {
        state: { active_mech_id: 'mech_1' },
        pilot: {
          state: { active_mech_id: 'mech_1' },
          mechs: [
            { id: 'mech_1', name: 'Iron Bastion', active: true },
            { id: 'mech_2', name: 'Crimson Monarch', active: false }
          ]
        }
      },
      markModified: vi.fn(),
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(PilotModel, 'findById').mockResolvedValueOnce(mockPilot as any);

    const res = await request(app)
      .post(`/api/pilots/${mockPilotId}/active-mech`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mech_id: 'mech_2' });

    expect(res.status).toBe(200);
    expect(res.body.active_mech_id).toBe('mech_2');
    expect(mockPilot.active_mech_name).toBe('Crimson Monarch');
    expect(mockPilot.active_mech_frame).toBe('SSC Monarch');
    expect(mockPilot.active_mech_image).toBe('https://img.lancer/monarch.png');
    expect(mockPilot.mechs[0].active).toBe(false);
    expect(mockPilot.mechs[1].active).toBe(true);
    expect(mockPilot.compcon_raw.state.active_mech_id).toBe('mech_2');
    expect(mockPilot.compcon_raw.pilot.state.active_mech_id).toBe('mech_2');
    expect(mockPilot.compcon_raw.pilot.mechs[1].active).toBe(true);
    expect(mockPilot.save).toHaveBeenCalled();
  });
});
