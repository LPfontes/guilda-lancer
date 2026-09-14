import mongoose from 'mongoose';
import dns from 'dns';
import { ENV } from '../config/env.js';

// Configure DNS servers on Windows only if using MongoDB Atlas SRV lookup
try {
  if (ENV.MONGODB_URI?.startsWith('mongodb+srv://')) {
    dns.setDefaultResultOrder('ipv4first');
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  }
} catch (e) {
  // Ignore in environments where setServers is restricted
}

let isConnected = false;

export async function connectMongoDB(): Promise<typeof mongoose> {
  if (isConnected) {
    return mongoose;
  }

  if (!ENV.MONGODB_URI) {
    throw new Error('[!] MONGODB_URI não configurado no .env');
  }

  try {
    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      dbName: 'guilda_lancer',
      serverSelectionTimeoutMS: 10000
    });

    isConnected = true;
    console.log(`[+] MongoDB Conectado com Sucesso [Host: ${conn.connection.host} // DB: ${conn.connection.name}]`);

    mongoose.connection.on('error', (err) => {
      console.error('[!] Erro na conexão com o MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[!] Conexão com o MongoDB perdida. Tentando reconectar...');
      isConnected = false;
    });

    return conn;
  } catch (err: any) {
    console.error('[!] Falha crítica ao conectar no MongoDB:', err.message);
    throw err;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[+] Conexão com MongoDB Atlas encerrada.');
  }
}
