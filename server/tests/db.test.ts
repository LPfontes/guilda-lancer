import { describe, it, expect } from 'vitest';
import { db } from '../src/database/db.js';

describe('NoSQL Database - Users Collection', () => {
  it('should create a new user and retrieve it by discord_id', () => {
    const testDiscordId = `test_disc_${Date.now()}`;
    const created = db.users.create({
      discord_id: testDiscordId,
      name: 'Piloto Teste',
      username: 'pilot_test',
      role: 'PILOT'
    });

    expect(created._id).toBeDefined();
    expect(created.discord_id).toBe(testDiscordId);
    expect(created.role).toBe('PILOT');

    const found = db.users.findByDiscordId(testDiscordId);
    expect(found).toBeDefined();
    expect(found?._id).toBe(created._id);
  });

  it('should update an existing user role and profile fields', () => {
    const testDiscordId = `update_disc_${Date.now()}`;
    const user = db.users.create({
      discord_id: testDiscordId,
      name: 'Mestre Candidato',
      username: 'candidate_gm',
      role: 'PENDING_GM'
    });

    const updated = db.users.update(user._id, {
      role: 'GM',
      name: 'Mestre Promovido'
    });

    expect(updated).toBeDefined();
    expect(updated?.role).toBe('GM');
    expect(updated?.name).toBe('Mestre Promovido');

    const retrieved = db.users.findById(user._id);
    expect(retrieved?.role).toBe('GM');
  });
});
