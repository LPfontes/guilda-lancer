import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectMongoDB, disconnectMongoDB, UserModel } from '../src/database/db.js';

describe('MongoDB Atlas - User Collection', () => {
  beforeAll(async () => {
    await connectMongoDB();
  });

  afterAll(async () => {
    // Clean up test documents
    await UserModel.deleteMany({ discord_id: { $regex: /^test_disc_/ } });
    await disconnectMongoDB();
  });

  it('should create a new user in MongoDB and retrieve it by discord_id', async () => {
    const testDiscordId = `test_disc_${Date.now()}`;
    const user = await UserModel.create({
      discord_id: testDiscordId,
      name: 'Piloto Teste Atlas',
      username: 'pilot_atlas',
      role: 'PILOT',
      discord_roles: ['1526729461888716951']
    });

    expect(user._id).toBeDefined();
    expect(user.discord_id).toBe(testDiscordId);
    expect(user.role).toBe('PILOT');

    const found = await UserModel.findOne({ discord_id: testDiscordId });
    expect(found).toBeDefined();
    expect(found?.username).toBe('pilot_atlas');
  });

  it('should update an existing user role and nickname in MongoDB', async () => {
    const testDiscordId = `test_disc_update_${Date.now()}`;
    const user = await UserModel.create({
      discord_id: testDiscordId,
      name: 'Mestre Candidato',
      username: 'candidate_gm',
      role: 'PENDING_GM'
    });

    const updated = await UserModel.findByIdAndUpdate(
      user._id,
      {
        role: 'GM',
        nickname: 'Comandante Silva'
      },
      { returnDocument: 'after' }
    );

    expect(updated).toBeDefined();
    expect(updated?.role).toBe('GM');
    expect(updated?.nickname).toBe('Comandante Silva');

    const retrieved = await UserModel.findById(user._id);
    expect(retrieved?.role).toBe('GM');
  });
});
