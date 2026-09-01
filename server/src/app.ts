import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';

export const app = express();

// Middlewares
app.use(cors({
  origin: [ENV.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger in Terminal Style (disabled in test)
if (ENV.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const time = new Date().toISOString().substring(11, 19);
    console.log(`[${time}] [OMNINET_API] ${req.method} ${req.path}`);
    next();
  });
}

// Mount Authentication Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Omninet Mission Hub - Auth Gateway',
    discord_auth: Boolean(ENV.DISCORD_CLIENT_ID),
    timestamp: new Date().toISOString()
  });
});
