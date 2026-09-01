import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { ENV } from '../src/config/env.js';
import { db } from '../src/database/db.js';

describe('Discord OAuth2 & Auth Routes Endpoints', () => {
  it('GET /api/health - should return status ONLINE with discord_auth enabled', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ONLINE');
    expect(res.body.discord_auth).toBe(true);
  });

  it('GET /api/auth/discord/login - should return the Discord OAuth2 authorization URL', async () => {
    const res = await request(app).get('/api/auth/discord/login');
    expect(res.status).toBe(200);
    expect(res.body.auth_url).toBeDefined();
    expect(res.body.auth_url).toContain('https://discord.com/oauth2/authorize');
    expect(res.body.auth_url).toContain(ENV.DISCORD_CLIENT_ID);
    expect(res.body.auth_url).toContain('scope=identify%20email');
  });

  it('GET /api/auth/discord/callback - should redirect with error if Discord reports error', async () => {
    const res = await request(app).get('/api/auth/discord/callback?error=access_denied');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?error=access_denied');
  });

  it('GET /api/auth/discord/callback - should redirect with error if no code is sent', async () => {
    const res = await request(app).get('/api/auth/discord/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?error=NO_CODE_PROVIDED');
  });

  it('GET /api/auth/discord/callback - should successfully exchange code, create user and redirect with token', async () => {
    const fakeDiscordId = `discord_user_${Date.now()}`;
    const fakeCode = 'valid_discord_oauth_code_123';

    // Mock axios post (token exchange) and get (profile query)
    const postSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        access_token: 'mock_discord_access_token_xyz',
        token_type: 'Bearer',
        expires_in: 604800,
        scope: 'identify email'
      }
    });

    const getSpy = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: {
        id: fakeDiscordId,
        username: 'lancer_pilot_01',
        global_name: 'Pilot Maverick',
        avatar: 'mock_avatar_hash_123',
        email: 'maverick@lancer.net'
      }
    });

    const res = await request(app).get(`/api/auth/discord/callback?code=${fakeCode}`);

    expect(postSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?token=');

    // Verify user was registered in DB
    const createdUser = db.users.findByDiscordId(fakeDiscordId);
    expect(createdUser).toBeDefined();
    expect(createdUser?.name).toBe('Pilot Maverick');
    expect(createdUser?.role).toBe('PILOT');

    // Restore mocks
    postSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('GET /api/auth/me - should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - should return user profile when authenticated with JWT', async () => {
    const user = db.users.create({
      discord_id: `me_test_${Date.now()}`,
      name: 'Operador Logado',
      username: 'logged_op',
      role: 'PILOT'
    });

    const token = jwt.sign(
      { userId: user._id, discord_id: user.discord_id, name: user.name, role: user.role },
      ENV.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(user._id);
    expect(res.body.user.username).toBe('logged_op');
  });

  it('POST /api/auth/logout - should clear cookie and return success message', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('encerrada');
  });
});
