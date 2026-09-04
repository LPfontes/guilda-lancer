import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { isOriginAllowed } from '../config/cors.js';

interface ISocketUser {
  userId: string;
  username: string;
  role: string;
  avatar?: string;
}

interface AuthenticatedSocket extends Socket {
  user?: ISocketUser;
}

class SocketService {
  private io: Server | null = null;

  init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Bloqueado por política de CORS no Socket.io'));
          }
        },
        credentials: true
      }
    });

    // Middleware de autenticação via JWT
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        let token = socket.handshake.auth?.token;

        // Extrai token do cookie HttpOnly enviado pelo navegador
        if (!token && socket.handshake.headers?.cookie) {
          const cookieHeader = socket.handshake.headers.cookie;
          const match = cookieHeader.match(/(?:^|;\s*)omninet_token=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1]);
          } else {
            const fallbackMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
            if (fallbackMatch) {
              token = decodeURIComponent(fallbackMatch[1]);
            }
          }
        }

        if (token) {
          const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
          socket.user = {
            userId: decoded.id || decoded.userId || decoded._id,
            username: decoded.username || 'Operador',
            role: decoded.role || 'PILOT',
            avatar: decoded.avatar || ''
          };
        }
        next();
      } catch (err) {
        // Permite conexão anônima/leitor se não autenticado
        next();
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`[+] Omninet Socket conectado: ${socket.id} (Usuário: ${socket.user?.username || 'Anônimo'})`);

      // 1. Entrar na sala de uma missão (Pré-missão)
      socket.on('join_mission', (missionId: string) => {
        if (!missionId) return;
        const room = `mission:${missionId}`;
        socket.join(room);
        console.log(`[+] Socket ${socket.id} entrou na sala ${room}`);
      });

      // 2. Sair da sala de uma missão
      socket.on('leave_mission', (missionId: string) => {
        if (!missionId) return;
        const room = `mission:${missionId}`;
        socket.leave(room);
      });

      // 3. Entrar na sala de relatórios (Feed de AAR & Recesso)
      socket.on('join_reports', () => {
        socket.join('channel:reports');
      });

      // 4. Sair da sala de relatórios
      socket.on('leave_reports', () => {
        socket.leave('channel:reports');
      });

      // 5. Indicador de digitação
      socket.on('typing', ({ room, isTyping }: { room: string; isTyping: boolean }) => {
        if (!room) return;
        socket.to(room).emit('user_typing', {
          userId: socket.user?.userId,
          username: socket.user?.username,
          isTyping
        });
      });

      socket.on('disconnect', () => {
        console.log(`[-] Omninet Socket desconectado: ${socket.id}`);
      });
    });

    console.log('[+] Omninet Real-Time Socket.io Server inicializado.');
  }

  broadcastToMission(missionId: string, event: string, payload: any) {
    if (!this.io) return;
    this.io.to(`mission:${missionId}`).emit(event, payload);
  }

  broadcastToReports(event: string, payload: any) {
    if (!this.io) return;
    this.io.to('channel:reports').emit(event, payload);
  }

  getIO(): Server | null {
    return this.io;
  }
}

export const socketService = new SocketService();
