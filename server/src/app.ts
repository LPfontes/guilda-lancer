import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { pilotRoutes } from './routes/pilot.routes.js';
import { missionRoutes } from './routes/mission.routes.js';

export const app = express();

// Middlewares
app.use(cors({
  origin: [ENV.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger in Terminal Style (disabled in test)
if (ENV.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const time = new Date().toISOString().substring(11, 19);
    console.log(`[${time}] [OMNINET_API] ${req.method} ${req.path}`);
    next();
  });
}

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/pilots', pilotRoutes);
app.use('/api/missions', missionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Omninet Mission Hub - Auth Gateway',
    discord_auth: Boolean(ENV.DISCORD_CLIENT_ID),
    timestamp: new Date().toISOString()
  });
});
