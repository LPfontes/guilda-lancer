import { io, Socket } from 'socket.io-client';
import { ApiClient } from './api.js';
import { IChatMessage, IReportData } from '../types/chat.types.js';

class ChatService {
  private socket: Socket | null = null;
  private currentMissionRoom: string | null = null;
  private isReportsRoomJoined: boolean = false;

  connectSocket(): Socket {
    if (!this.socket) {
      this.socket = io({
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('[+] Conectado ao Omninet Real-Time Comms via Socket.io');
        // Re-join rooms se reconectou
        if (this.currentMissionRoom) {
          this.socket?.emit('join_mission', this.currentMissionRoom);
        }
        if (this.isReportsRoomJoined) {
          this.socket?.emit('join_reports');
        }
      });

      this.socket.on('disconnect', () => {
        console.log('[-] Desconectado do Omninet Socket');
      });
    }

    return this.socket;
  }

  // ==========================================
  // CANAL PRÉ-MISSÃO (MISSION CHAT)
  // ==========================================

  joinMission(missionId: string) {
    this.connectSocket();
    this.currentMissionRoom = missionId;
    this.socket?.emit('join_mission', missionId);
  }

  leaveMission(missionId: string) {
    if (this.currentMissionRoom === missionId) {
      this.socket?.emit('leave_mission', missionId);
      this.currentMissionRoom = null;
    }
  }

  onNewMessage(callback: (msg: IChatMessage) => void) {
    this.connectSocket();
    this.socket?.on('new_message', callback);
    return () => {
      this.socket?.off('new_message', callback);
    };
  }

  async getMissionMessages(missionId: string): Promise<IChatMessage[]> {
    const res = await ApiClient.get<{ success: boolean; messages: IChatMessage[] }>(
      `/chat/missions/${missionId}/messages`
    );
    return res.messages || [];
  }

  async sendMissionMessage(missionId: string, content: string): Promise<IChatMessage> {
    const res = await ApiClient.post<{ success: boolean; message: IChatMessage }>(
      `/chat/missions/${missionId}/messages`,
      { content }
    );
    return res.message;
  }

  // ==========================================
  // CANAL & FEED DE RELATÓRIOS (REPORTS)
  // ==========================================

  joinReports() {
    this.connectSocket();
    this.isReportsRoomJoined = true;
    this.socket?.emit('join_reports');
  }

  leaveReports() {
    this.isReportsRoomJoined = false;
    this.socket?.emit('leave_reports');
  }

  onNewReport(callback: (report: IChatMessage) => void) {
    this.connectSocket();
    this.socket?.on('new_report', callback);
    return () => {
      this.socket?.off('new_report', callback);
    };
  }

  onReportValidated(callback: (report: IChatMessage) => void) {
    this.connectSocket();
    this.socket?.on('report_validated', callback);
    return () => {
      this.socket?.off('report_validated', callback);
    };
  }

  onReportComment(callback: (data: { reportId: string; comment: IChatMessage }) => void) {
    this.connectSocket();
    this.socket?.on('report_comment', callback);
    return () => {
      this.socket?.off('report_comment', callback);
    };
  }

  async getReports(filters?: { missionId?: string; pilotId?: string; filter?: string }): Promise<IChatMessage[]> {
    const params = new URLSearchParams();
    if (filters?.missionId) params.append('missionId', filters.missionId);
    if (filters?.pilotId) params.append('pilotId', filters.pilotId);
    if (filters?.filter) params.append('filter', filters.filter);

    const queryString = params.toString();
    const endpoint = queryString ? `/chat/reports?${queryString}` : '/chat/reports';

    const res = await ApiClient.get<{ success: boolean; reports: IChatMessage[] }>(endpoint);
    return res.reports || [];
  }

  async submitReport(payload: { mission_id?: string; report_data: IReportData; content?: string }): Promise<IChatMessage> {
    const res = await ApiClient.post<{ success: boolean; report: IChatMessage }>('/chat/reports', payload);
    return res.report;
  }

  async validateReport(messageId: string, gm_notes?: string): Promise<IChatMessage> {
    const res = await ApiClient.patch<{ success: boolean; report: IChatMessage }>(
      `/chat/reports/${messageId}/validate`,
      { gm_notes }
    );
    return res.report;
  }

  async getReportComments(reportId: string): Promise<IChatMessage[]> {
    const res = await ApiClient.get<{ success: boolean; comments: IChatMessage[] }>(
      `/chat/reports/${reportId}/comments`
    );
    return res.comments || [];
  }

  async addReportComment(reportId: string, content: string): Promise<IChatMessage> {
    const res = await ApiClient.post<{ success: boolean; comment: IChatMessage }>(
      `/chat/reports/${reportId}/comments`,
      { content }
    );
    return res.comment;
  }
}

export const chatService = new ChatService();
