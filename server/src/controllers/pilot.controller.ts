import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PilotModel } from '../database/models/Pilot.model.js';
import { CompconService } from '../services/compcon.service.js';

export const PilotController = {
  /**
   * 1. Submissão ou atualização da ficha de piloto via COMP/CON (Share Code ou JSON exportado).
   */
  async submitPilot(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: '[!] Autenticação obrigatória.' });
    }

    const { share_code, compcon_data, compcon_json, compcon_raw, pilot_id, set_active } = req.body;
    let rawData = compcon_data || compcon_raw || compcon_json;

    // Se forneceu apenas o share code sem payload de dados, tenta resolver
    if (!rawData && share_code) {
      try {
        rawData = await CompconService.fetchByShareCode(share_code);
      } catch (err: any) {
        return res.status(400).json({
          error: 'SHARE_CODE_FETCH_FAILED',
          message: err.message,
          suggestion: 'Cole o arquivo JSON da ficha exportada do COMP/CON no campo "compcon_data" ou "compcon_json".'
        });
      }
    }

    if (!rawData) {
      return res.status(400).json({
        error: 'MISSING_PILOT_DATA',
        message: '[!] Informe o código de compartilhamento (share_code) ou os dados exportados do COMP/CON (compcon_data).'
      });
    }

    try {
      // Parse e validação das regras do LANCER
      const parsed = CompconService.parseCompconPilot(rawData, share_code);

      // 1 Usuário -> N Pilotos:
      // Se pilot_id foi informado, busca o piloto específico para atualização.
      // Se não, verifica se já existe um piloto com o mesmo callsign para atualizar, ou cria um novo piloto no hangar.
      let pilot: any = null;
      if (pilot_id && mongoose.isValidObjectId(pilot_id)) {
        pilot = await PilotModel.findOne({ _id: pilot_id, user_id: req.user._id });
        if (!pilot) {
          return res.status(404).json({
            error: 'PILOT_NOT_FOUND',
            message: '[!] Piloto especificado não foi localizado no seu hangar.'
          });
        }
      } else {
        pilot = await PilotModel.findOne({ user_id: req.user._id, callsign: parsed.callsign });
      }

      const totalUserPilots = await PilotModel.countDocuments({ user_id: req.user._id });
      const shouldBeActive = set_active === true || totalUserPilots === 0 || (pilot && pilot.is_active);

      if (shouldBeActive) {
        // Desativa temporariamente outros pilotos para garantir apenas 1 ativo
        await PilotModel.updateMany({ user_id: req.user._id }, { is_active: false });
      }

      const pilotDataToSave = {
        callsign: parsed.callsign,
        name: parsed.name,
        license_level: parsed.license_level,
        grit: parsed.grit,
        hull: parsed.hull,
        agility: parsed.agility,
        systems: parsed.systems,
        engineering: parsed.engineering,
        talents: parsed.talents,
        skills: parsed.skills,
        licenses: parsed.licenses,
        mechs: parsed.mechs,
        active_mech_name: parsed.active_mech_name,
        active_mech_frame: parsed.active_mech_frame,
        is_active: shouldBeActive,
        share_code: parsed.share_code || share_code || '',
        compcon_raw: parsed.raw_data,
        validation_warnings: parsed.validation_warnings,
        status: 'PENDING_APPROVAL',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null
      };

      if (pilot) {
        // Se o piloto já estiver em missão ativa, não permite alterar a ficha no meio da missão
        if (pilot.active_mission_id) {
          return res.status(400).json({
            error: 'PILOT_IN_ACTIVE_MISSION',
            message: '[!] Não é permitido alterar a ficha de um piloto em serviço ativo numa missão.'
          });
        }

        pilot = await PilotModel.findByIdAndUpdate(pilot._id, pilotDataToSave, { returnDocument: 'after' });
      } else {
        pilot = await PilotModel.create({
          user_id: req.user._id,
          ...pilotDataToSave
        });
      }

      const summary = CompconService.generateTacticalSummary(pilot!);

      return res.status(200).json({
        message: '[+] Ficha do piloto cadastrada no seu hangar e enviada para avaliação.',
        pilot,
        tactical_summary: summary,
        warnings: parsed.validation_warnings,
        is_valid: parsed.is_valid
      });
    } catch (err: any) {
      return res.status(400).json({
        error: 'PARSING_ERROR',
        message: err.message || '[!] Falha ao processar a ficha do COMP/CON.'
      });
    }
  },

  /**
   * 2. Preview e validação sem persistir no banco de dados.
   */
  async previewPilot(req: Request, res: Response) {
    const { share_code, compcon_data, compcon_json, compcon_raw } = req.body;
    let rawData = compcon_data || compcon_raw || compcon_json;

    if (!rawData && share_code) {
      try {
        rawData = await CompconService.fetchByShareCode(share_code);
      } catch (err: any) {
        return res.status(400).json({
          error: 'SHARE_CODE_FETCH_FAILED',
          message: err.message
        });
      }
    }

    if (!rawData) {
      return res.status(400).json({
        error: 'MISSING_PILOT_DATA',
        message: '[!] Nenhum dado ou código do COMP/CON informado para validação.'
      });
    }

    try {
      const parsed = CompconService.parseCompconPilot(rawData, share_code);
      const summary = CompconService.generateTacticalSummary({
        callsign: parsed.callsign,
        license_level: parsed.license_level,
        grit: parsed.grit,
        hull: parsed.hull,
        agility: parsed.agility,
        systems: parsed.systems,
        engineering: parsed.engineering,
        active_mech_name: parsed.active_mech_name,
        active_mech_frame: parsed.active_mech_frame,
        status: 'PREVIEW',
        talents: parsed.talents,
        skills: parsed.skills
      });

      return res.json({
        parsed,
        tactical_summary: summary,
        warnings: parsed.validation_warnings,
        is_valid: parsed.is_valid
      });
    } catch (err: any) {
      return res.status(400).json({
        error: 'PARSING_ERROR',
        message: err.message
      });
    }
  },

  /**
   * 3. Consulta as fichas de pilotos vinculadas ao operador logado (Hangar).
   */
  async getMyPilot(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const pilots = await PilotModel.find({ user_id: req.user._id })
      .populate('reviewed_by', 'name username')
      .populate('active_mission_id', 'title status contractor')
      .sort({ is_active: -1, updatedAt: -1 });

    if (!pilots || pilots.length === 0) {
      return res.json({
        total: 0,
        active_pilot: null,
        pilot: null,
        pilots: [],
        message: '[!] Nenhuma ficha de piloto vinculada a este operador na Omninet.'
      });
    }

    const activePilot = pilots.find((p) => p.is_active) || pilots[0];
    const summary = CompconService.generateTacticalSummary(activePilot);

    return res.json({
      total: pilots.length,
      active_pilot: activePilot,
      pilot: activePilot, // compatibilidade com clientes existentes
      pilots,
      tactical_summary: summary
    });
  },

  /**
   * 4. Listagem de fichas de pilotos com filtros e paginação.
   */
  async listPilots(req: Request, res: Response) {
    const { status, min_ll, max_ll, search, page = '1', limit = '20' } = req.query;

    const query: any = {};

    // Usuários com papel PILOT comum só visualizam fichas aprovadas (exceto se for Avaliador/Admin ou GM)
    const canSeeAll = req.user?.role === 'ADMIN' || req.user?.role === 'GM';

    if (status && typeof status === 'string') {
      if (canSeeAll || status === 'APPROVED') {
        query.status = status;
      } else {
        query.status = 'APPROVED';
      }
    } else if (!canSeeAll) {
      query.status = 'APPROVED';
    }

    if (min_ll !== undefined || max_ll !== undefined) {
      query.license_level = {};
      if (min_ll !== undefined) query.license_level.$gte = parseInt(String(min_ll), 10);
      if (max_ll !== undefined) query.license_level.$lte = parseInt(String(max_ll), 10);
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { callsign: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { active_mech_name: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [pilots, total] = await Promise.all([
      PilotModel.find(query)
        .populate('user_id', 'name username avatar')
        .populate('reviewed_by', 'name username')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PilotModel.countDocuments(query)
    ]);

    return res.json({
      pilots,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  },

  /**
   * 5. Visualiza os detalhes completos de uma ficha por ID.
   */
  async getPilotById(req: Request, res: Response) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de piloto inválido.' });
    }

    const pilot = await PilotModel.findById(id)
      .populate('user_id', 'name username avatar role')
      .populate('reviewed_by', 'name username')
      .populate('active_mission_id', 'title status contractor');

    if (!pilot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Piloto não encontrado no arquivo da Omninet.' });
    }

    // Pilotos comuns só podem ver fichas alheias se estiverem aprovadas
    const isOwner = req.user && pilot.user_id && pilot.user_id._id.toString() === req.user._id.toString();
    const canModerate = req.user && (req.user.role === 'ADMIN' || req.user.role === 'GM');

    if (pilot.status !== 'APPROVED' && !isOwner && !canModerate) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: '[!] Esta ficha de piloto ainda não foi aprovada pelo comitê de avaliação.'
      });
    }

    const summary = CompconService.generateTacticalSummary(pilot);

    return res.json({
      pilot,
      tactical_summary: summary
    });
  },

  /**
   * 6. Avaliação de ficha de piloto (Avaliador/Admin ou GM).
   */
  async reviewPilot(req: Request, res: Response) {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de piloto inválido.' });
    }

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: '[!] O status da avaliação deve ser APPROVED ou REJECTED.'
      });
    }

    if (status === 'REJECTED' && (!rejection_reason || !rejection_reason.trim())) {
      return res.status(400).json({
        error: 'REASON_REQUIRED',
        message: '[!] Uma justificativa/motivo é obrigatória ao rejeitar uma ficha de piloto.'
      });
    }

    const pilot = await PilotModel.findById(id);
    if (!pilot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Piloto não localizado no registro da guilda.' });
    }

    pilot.status = status;
    pilot.rejection_reason = status === 'REJECTED' ? rejection_reason.trim() : null;
    pilot.reviewed_by = req.user!._id;
    pilot.reviewed_at = new Date();

    await pilot.save();

    console.log(
      `[+] Ficha do piloto "${pilot.callsign}" foi avaliada como [${status}] por @${req.user!.username}`
    );

    return res.json({
      message: `[+] Ficha do piloto atualizada com sucesso para ${status}.`,
      pilot
    });
  },

  /**
   * 7. Seleciona qual piloto é o ativo no hangar do operador.
   */
  async setActivePilot(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de piloto inválido.' });
    }

    const pilot = await PilotModel.findOne({ _id: id, user_id: req.user._id });
    if (!pilot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Piloto não encontrado no seu hangar.' });
    }

    // Desativa os demais e ativa o selecionado
    await PilotModel.updateMany({ user_id: req.user._id }, { is_active: false });
    pilot.is_active = true;
    await pilot.save();

    console.log(`[+] Operador @${req.user.username} ativou o piloto "${pilot.callsign}".`);

    return res.json({
      message: `[+] Piloto "${pilot.callsign}" foi definido como ativo.`,
      active_pilot: pilot
    });
  },

  /**
   * 8. Exclusão/Reset de uma ficha de piloto do hangar do operador.
   */
  async deleteMyPilot(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    let query: any = { user_id: req.user._id };

    if (id && mongoose.isValidObjectId(id)) {
      query._id = id;
    } else {
      // Se não especificou ID, busca o piloto ativo ou o mais recente
      query.is_active = true;
    }

    const pilot = await PilotModel.findOne(query);

    if (!pilot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Nenhuma ficha encontrada para exclusão.' });
    }

    if (pilot.active_mission_id) {
      return res.status(400).json({
        error: 'PILOT_IN_ACTIVE_MISSION',
        message: '[!] Impossível remover a ficha enquanto o piloto estiver mobilizado em uma missão ativa.'
      });
    }

    const wasActive = pilot.is_active;
    await PilotModel.findByIdAndDelete(pilot._id);

    // Se o piloto excluído era o ativo, ativa outro piloto do hangar
    if (wasActive) {
      const remainingPilot = await PilotModel.findOne({ user_id: req.user._id }).sort({ updatedAt: -1 });
      if (remainingPilot) {
        remainingPilot.is_active = true;
        await remainingPilot.save();
      }
    }

    return res.json({
      message: `[+] Ficha do piloto "${pilot.callsign}" foi removida do hangar do operador.`
    });
  }
};
