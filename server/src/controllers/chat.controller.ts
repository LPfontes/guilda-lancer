import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ChatMessageModel } from '../database/models/ChatMessage.model.js';
import { MissionModel } from '../database/models/Mission.model.js';
import { PilotModel } from '../database/models/Pilot.model.js';
import { socketService } from '../services/socket.service.js';

export class ChatController {
  // =========================================================================
  // 1. CHAT PRÉ-MISSÃO (CANAL DE ALINHAMENTO ENTRE PILOTOS E GM)
  // =========================================================================

  static async getMissionMessages(req: Request, res: Response): Promise<void> {
    try {
      const { missionId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(missionId)) {
        res.status(400).json({ error: 'ID de missão inválido.' });
        return;
      }

      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const messages = await ChatMessageModel.find({
        channel_type: 'MISSION',
        mission_id: missionId
      })
        .sort({ createdAt: 1 })
        .limit(limit)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign active_mech_name active_mech_frame');

      res.json({ success: true, messages });
    } catch (err: any) {
      console.error('[!] Erro ao listar mensagens da missão:', err);
      res.status(500).json({ error: 'Falha interna ao recuperar histórico de mensagens.' });
    }
  }

  static async sendMissionMessage(req: Request, res: Response): Promise<void> {
    try {
      const { missionId } = req.params;
      const { content } = req.body;
      const user = (req as any).user;

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Conteúdo da mensagem não pode ser vazio.' });
        return;
      }

      const mission = await MissionModel.findById(missionId);
      if (!mission) {
        res.status(404).json({ error: 'Missão não encontrada.' });
        return;
      }

      // Procura se o autor tem um piloto ativo aprovado
      const pilot = await PilotModel.findOne({
        user_id: user.id || user._id,
        is_active: true
      });

      const newMsg = await ChatMessageModel.create({
        channel_type: 'MISSION',
        mission_id: mission._id,
        author_id: user.id || user._id,
        pilot_id: pilot ? pilot._id : null,
        author_name: user.username,
        author_role: user.role,
        pilot_callsign: pilot ? pilot.callsign : '',
        author_avatar: user.avatar || pilot?.portrait || '',
        content: content.trim(),
        message_type: 'TEXT'
      });

      const populated = await ChatMessageModel.findById(newMsg._id)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign active_mech_name active_mech_frame');

      // Notifica em tempo real a sala da missão
      socketService.broadcastToMission(missionId, 'new_message', populated);

      res.status(201).json({ success: true, message: populated });
    } catch (err: any) {
      console.error('[!] Erro ao enviar mensagem na missão:', err);
      res.status(500).json({ error: 'Falha interna ao transmitir mensagem.' });
    }
  }

  // =========================================================================
  // 2. CHAT DE RELATÓRIOS (FEED DE AAR & RECESSO)
  // =========================================================================

  static async getReports(req: Request, res: Response): Promise<void> {
    try {
      const { missionId, pilotId, filter } = req.query;
      const query: any = {
        channel_type: 'REPORT',
        message_type: 'REPORT'
      };

      if (missionId && mongoose.Types.ObjectId.isValid(missionId as string)) {
        query.mission_id = missionId;
      }

      if (pilotId && mongoose.Types.ObjectId.isValid(pilotId as string)) {
        query.pilot_id = pilotId;
      }

      if (filter === 'PENDING') {
        query['report_data.is_validated_by_gm'] = { $ne: true };
      } else if (filter === 'VALIDATED') {
        query['report_data.is_validated_by_gm'] = true;
      }

      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const reports = await ChatMessageModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign active_mech_name active_mech_frame')
        .populate('mission_id', 'title contractor difficulty');

      res.json({ success: true, reports });
    } catch (err: any) {
      console.error('[!] Erro ao listar relatórios de missão:', err);
      res.status(500).json({ error: 'Falha interna ao recuperar feed de relatórios.' });
    }
  }

  static async submitReport(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { mission_id, report_data, content } = req.body;

      if (!report_data) {
        res.status(400).json({ error: 'Dados do relatório de combate são obrigatórios.' });
        return;
      }

      // Procura o piloto associado
      const pilot = await PilotModel.findOne({
        user_id: user.id || user._id,
        is_active: true
      });

      const mission = mission_id ? await MissionModel.findById(mission_id) : null;

      const newReport = await ChatMessageModel.create({
        channel_type: 'REPORT',
        mission_id: mission ? mission._id : null,
        author_id: user.id || user._id,
        pilot_id: pilot ? pilot._id : null,
        author_name: user.username,
        author_role: user.role,
        pilot_callsign: report_data.pilot_callsign || (pilot ? pilot.callsign : ''),
        author_avatar: user.avatar || pilot?.portrait || '',
        content: content || `Relatório de Missão emitido por ${report_data.pilot_callsign || user.username}`,
        message_type: 'REPORT',
        report_data: {
          pilot_name: report_data.pilot_name || '',
          pilot_callsign: report_data.pilot_callsign || (pilot ? pilot.callsign : ''),
          mech_name: report_data.mech_name || 'Chassi Não Identificado',
          current_hp: Number(report_data.current_hp) || 0,
          max_hp: Number(report_data.max_hp) || 10,
          current_structure: Number(report_data.current_structure) !== undefined ? Number(report_data.current_structure) : 4,
          current_heat: Number(report_data.current_heat) || 0,
          total_heat: Number(report_data.total_heat) || 6,
          current_stress: Number(report_data.current_stress) !== undefined ? Number(report_data.current_stress) : 4,
          current_repairs: Number(report_data.current_repairs) || 0,
          max_repairs: Number(report_data.max_repairs) || 4,
          core_power_used: Boolean(report_data.core_power_used),
          downtime_action: report_data.downtime_action || 'N/A',
          downtime_result: report_data.downtime_result || 'N/A',
          damaged_notes: report_data.damaged_notes || '',
          is_validated_by_gm: false,
          validated_by: null,
          validated_by_name: null,
          validated_at: null,
          gm_notes: null
        }
      });

      const populated = await ChatMessageModel.findById(newReport._id)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign active_mech_name active_mech_frame')
        .populate('mission_id', 'title contractor difficulty');

      // Notifica em tempo real o canal de relatórios
      socketService.broadcastToReports('new_report', populated);

      res.status(201).json({ success: true, report: populated });
    } catch (err: any) {
      console.error('[!] Erro ao submeter relatório de missão:', err);
      res.status(500).json({ error: 'Falha interna ao publicar relatório.' });
    }
  }

  static async validateReport(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { gm_notes } = req.body;
      const user = (req as any).user;

      if (user.role !== 'GM' && user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Apenas Mestres (GM) e Administradores podem homologar recesso.' });
        return;
      }

      const report = await ChatMessageModel.findById(messageId);
      if (!report || report.message_type !== 'REPORT') {
        res.status(404).json({ error: 'Relatório não encontrado.' });
        return;
      }

      report.report_data = {
        ...report.report_data,
        is_validated_by_gm: true,
        validated_by: user.id || user._id,
        validated_by_name: user.username,
        validated_at: new Date(),
        gm_notes: gm_notes ? gm_notes.trim() : 'Recurso de recesso homologado com sucesso pelo Mestre.'
      } as any;

      await report.save();

      const populated = await ChatMessageModel.findById(report._id)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign active_mech_name active_mech_frame')
        .populate('mission_id', 'title contractor difficulty');

      socketService.broadcastToReports('report_validated', populated);

      res.json({ success: true, report: populated });
    } catch (err: any) {
      console.error('[!] Erro ao homologar relatório:', err);
      res.status(500).json({ error: 'Falha interna ao homologar relatório.' });
    }
  }

  // =========================================================================
  // 3. COMENTÁRIOS E DEBATES EM RELATÓRIOS
  // =========================================================================

  static async getReportComments(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const comments = await ChatMessageModel.find({
        channel_type: 'REPORT',
        parent_report_id: reportId
      })
        .sort({ createdAt: 1 })
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign');

      res.json({ success: true, comments });
    } catch (err: any) {
      console.error('[!] Erro ao listar comentários do relatório:', err);
      res.status(500).json({ error: 'Falha interna ao recuperar comentários.' });
    }
  }

  static async addReportComment(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { content } = req.body;
      const user = (req as any).user;

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Comentário não pode ser vazio.' });
        return;
      }

      const parent = await ChatMessageModel.findById(reportId);
      if (!parent) {
        res.status(404).json({ error: 'Relatório original não encontrado.' });
        return;
      }

      const pilot = await PilotModel.findOne({
        user_id: user.id || user._id,
        is_active: true
      });

      const newComment = await ChatMessageModel.create({
        channel_type: 'REPORT',
        parent_report_id: parent._id,
        author_id: user.id || user._id,
        pilot_id: pilot ? pilot._id : null,
        author_name: user.username,
        author_role: user.role,
        pilot_callsign: pilot ? pilot.callsign : '',
        author_avatar: user.avatar || pilot?.portrait || '',
        content: content.trim(),
        message_type: 'TEXT'
      });

      const populated = await ChatMessageModel.findById(newComment._id)
        .populate('author_id', 'username role avatar')
        .populate('pilot_id', 'callsign');

      socketService.broadcastToReports('report_comment', {
        reportId: parent._id,
        comment: populated
      });

      res.status(201).json({ success: true, comment: populated });
    } catch (err: any) {
      console.error('[!] Erro ao comentar no relatório:', err);
      res.status(500).json({ error: 'Falha interna ao adicionar comentário.' });
    }
  }
}
