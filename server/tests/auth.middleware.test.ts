import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env.js';
import { db } from '../src/database/db.js';
import { authenticateJWT, requireRole } from '../src/middlewares/auth.middleware.js';

describe('Auth & RBAC Middlewares', () => {
  const testApp = express();
  testApp.use(cookieParser());
  testApp.use(express.json());

  // Dummy protected endpoints for testing
  testApp.get('/test/protected', authenticateJWT, (req, res) => {
    res.json({ message: 'OK', user: req.user });
  });

  testApp.get('/test/gm-only', authenticateJWT, requireRole(['GM', 'ADMIN']), (req, res) => {
    res.json({ message: 'GM_ACCESS_GRANTED' });
  });

  testApp.get('/test/admin-only', authenticateJWT, requireRole(['ADMIN']), (req, res) => {
    res.json({ message: 'ADMIN_ACCESS_GRANTED' });
  });

  it('should return 401 UNAUTHORIZED when no token is provided', async () => {
    const res = await request(testApp).get('/test/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should return 401 INVALID_TOKEN when an invalid token is provided', async () => {
    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', 'Bearer invalid_garbage_token');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('should allow access when a valid JWT token is provided', async () => {
    const user = db.users.create({
      discord_id: `auth_test_${Date.now()}`,
      name: 'Piloto Teste JWT',
      username: 'pilot_jwt',
      role: 'PILOT'
    });

    const token = jwt.sign(
      { userId: user._id, discord_id: user.discord_id, name: user.name, role: user.role },
      ENV.JWT_SECRET
    );

    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('OK');
    expect(res.body.user._id).toBe(user._id);
  });

  it('should block PILOT from accessing GM or ADMIN only routes (403 Forbidden)', async () => {
    const pilotUser = db.users.create({
      discord_id: `pilot_rbac_${Date.now()}`,
      name: 'Piloto Sem Permissao',
      username: 'pilot_noperm',
      role: 'PILOT'
    });

    const token = jwt.sign(
      { userId: pilotUser._id, discord_id: pilotUser.discord_id, name: pilotUser.name, role: pilotUser.role },
      ENV.JWT_SECRET
    );

    const resGm = await request(testApp)
      .get('/test/gm-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resGm.status).toBe(403);
    expect(resGm.body.error).toBe('FORBIDDEN');

    const resAdmin = await request(testApp)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resAdmin.status).toBe(403);
    expect(resAdmin.body.error).toBe('FORBIDDEN');
  });

  it('should allow GM to access GM routes, but block from ADMIN only routes', async () => {
    const gmUser = db.users.create({
      discord_id: `gm_rbac_${Date.now()}`,
      name: 'Mestre da Sessão',
      username: 'gm_tester',
      role: 'GM'
    });

    const token = jwt.sign(
      { userId: gmUser._id, discord_id: gmUser.discord_id, name: gmUser.name, role: gmUser.role },
      ENV.JWT_SECRET
    );

    const resGm = await request(testApp)
      .get('/test/gm-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resGm.status).toBe(200);
    expect(resGm.body.message).toBe('GM_ACCESS_GRANTED');

    const resAdmin = await request(testApp)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resAdmin.status).toBe(403);
    expect(resAdmin.body.error).toBe('FORBIDDEN');
  });

  it('should allow ADMIN to access both GM and ADMIN routes', async () => {
    const adminUser = db.users.create({
      discord_id: `admin_rbac_${Date.now()}`,
      name: 'Comando Global',
      username: 'admin_tester',
      role: 'ADMIN'
    });

    const token = jwt.sign(
      { userId: adminUser._id, discord_id: adminUser.discord_id, name: adminUser.name, role: adminUser.role },
      ENV.JWT_SECRET
    );

    const resGm = await request(testApp)
      .get('/test/gm-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resGm.status).toBe(200);

    const resAdmin = await request(testApp)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.message).toBe('ADMIN_ACCESS_GRANTED');
  });
});
