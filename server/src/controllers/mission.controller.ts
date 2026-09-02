import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MissionModel, IMission } from '../database/models/Mission.model.js';
import { PilotModel } from '../database/models/Pilot.model.js';

export const MissionController = {
  /**
   * 1. Criar nova missão (Apenas GMs e ADMINs).
   */
  async createMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const {
      title,
      contractor = 'Union / GMS',
      difficulty = 'STANDARD',
      min_ll = 0,
      max_ll = 12,
      slots_total = 4,
      start_date,
      start_time,
      end_date,
      voice_channel = '#op-bravo-01',
      platform = 'Foundry VTT',
      briefing,
      optional_rules = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'TITLE_REQUIRED', message: '[!] O título da operação é obrigatório.' });
    }

    if (!start_date || !start_time || !end_date) {
      return res.status(400).json({
        error: 'DATES_REQUIRED',
        message: '[!] Datas de início/término e horário são obrigatórios para agendar a missão.'
      });
    }

    if (!briefing || !briefing.trim()) {
      return res.status(400).json({ error: 'BRIEFING_REQUIRED', message: '[!] O briefing da missão é obrigatório.' });
    }

    const minLlNum = Math.max(0, Math.min(12, Number(min_ll) || 0));
    const maxLlNum = Math.max(minLlNum, Math.min(12, Number(max_ll) || 12));
    const slotsNum = Math.max(1, Math.min(12, Number(slots_total) || 4));

    const mission = await MissionModel.create({
      gm_id: req.user._id,
      title: title.trim(),
      contractor: contractor.trim(),
      difficulty: difficulty.trim(),
      min_ll: minLlNum,
      max_ll: maxLlNum,
      slots_total: slotsNum,
      start_date: start_date.trim(),
      start_time: start_time.trim(),
      end_date: end_date.trim(),
      voice_channel: voice_channel.trim(),
      platform: platform.trim(),
      briefing: briefing.trim(),
      optional_rules: optional_rules.trim(),
      status: 'OPEN',
      applications: []
    });

    console.log(`[+] Nova missão criada: "${mission.title}" pelo GM @${req.user.username} [LL: ${minLlNum}-${maxLlNum}]`);

    return res.status(201).json({
      message: `[+] Operação "${mission.title}" aberta com sucesso na Omninet.`,
      mission
    });
  },

  /**
   * 2. Listar missões com filtros e paginação.
   */
  async listMissions(req: Request, res: Response) {
    const { status, min_ll, max_ll, gm_id, search, page = '1', limit = '20' } = req.query;

    const query: any = {};

    if (status && typeof status === 'string' && status !== 'ALL') {
      query.status = status;
    }

    if (min_ll !== undefined) {
      query.max_ll = { $gte: parseInt(String(min_ll), 10) };
    }

    if (max_ll !== undefined) {
      query.min_ll = { ...query.min_ll, $lte: parseInt(String(max_ll), 10) };
    }

    if (gm_id && typeof gm_id === 'string' && mongoose.isValidObjectId(gm_id)) {
      query.gm_id = gm_id;
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { contractor: { $regex: search, $options: 'i' } },
        { briefing: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [missions, total] = await Promise.all([
      MissionModel.find(query)
        .populate('gm_id', 'name username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      MissionModel.countDocuments(query)
    ]);

    return res.json({
      missions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  },

  /**
   * 3. Detalhes completos de uma missão por ID.
   */
  async getMissionById(req: Request, res: Response) {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: '[!] ID de missão inválido.' });
    }

    const mission = await MissionModel.findById(id)
      .populate('gm_id', 'name username avatar')
      .populate({
        path: 'applications.pilot_id',
        select: 'callsign name license_level grit active_mech_name active_mech_frame status user_id',
        populate: { path: 'user_id', select: 'name username avatar' }
      });

    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Missão não encontrada no registro da Omninet.' });
    }

    return res.json({ mission });
  },

  /**
   * 4. Atualizar missão (Apenas o GM dono ou ADMIN).
   */
  async updateMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Missão não encontrada.' });
    }

    const isOwnerGm = mission.gm_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwnerGm && !isAdmin) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: '[!] Apenas o Mestre da operação ou um Administrador podem alterar esta missão.'
      });
    }

    // Não permite alterar missões concluídas ou canceladas
    if (['COMPLETED', 'CANCELLED'].includes(mission.status)) {
      return res.status(400).json({
        error: 'MISSION_CLOSED',
        message: `[!] Esta missão já está finalizada (${mission.status}) e não pode ser editada.`
      });
    }

    const allowedUpdates = [
      'title', 'contractor', 'difficulty', 'min_ll', 'max_ll', 'slots_total',
      'start_date', 'start_time', 'end_date', 'voice_channel', 'platform',
      'briefing', 'optional_rules', 'aar'
    ];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        (mission as any)[field] = req.body[field];
      }
    }

    await mission.save();

    return res.json({
      message: `[+] Dados da operação "${mission.title}" atualizados com sucesso.`,
      mission
    });
  },

  /**
   * 5. Excluir / Cancelar missão (Apenas o GM dono ou ADMIN).
   */
  async deleteMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const isOwnerGm = mission.gm_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwnerGm && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '[!] Sem permissão para remover esta missão.' });
    }

    // Se houver pilotos mobilizados nesta missão, desvincula-os
    const pilotIds = mission.applications.map((app: any) => app.pilot_id);
    if (pilotIds.length > 0) {
      await PilotModel.updateMany({ active_mission_id: mission._id }, { active_mission_id: null });
    }

    await MissionModel.findByIdAndDelete(mission._id);

    return res.json({
      message: `[+] Operação "${mission.title}" foi cancelada e excluída dos registros.`
    });
  },

  /**
   * 6. Candidatar piloto a uma missão aberta.
   */
  async applyToMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const { pilot_id } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: '[!] Missão não encontrada.' });
    }

    if (mission.status !== 'OPEN') {
      return res.status(400).json({
        error: 'MISSION_NOT_OPEN',
        message: `[!] Esta missão não aceita mais inscrições (Status: ${mission.status}).`
      });
    }

    // Localiza o piloto que será inscrito
    let pilot: any = null;
    if (pilot_id && mongoose.isValidObjectId(pilot_id)) {
      pilot = await PilotModel.findOne({ _id: pilot_id, user_id: req.user._id });
    } else {
      pilot = await PilotModel.findOne({ user_id: req.user._id, is_active: true })
        || await PilotModel.findOne({ user_id: req.user._id }).sort({ updatedAt: -1 });
    }

    if (!pilot) {
      return res.status(400).json({
        error: 'NO_PILOT_FOUND',
        message: '[!] Você precisa cadastrar uma ficha de piloto antes de se candidatar a uma missão.'
      });
    }

    // Validação de Status do Piloto (apenas pilotos aprovados podem ir a missões)
    if (pilot.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'PILOT_NOT_APPROVED',
        message: `[!] O piloto "${pilot.callsign}" está com status [${pilot.status}]. Apenas pilotos APROVADOS pelos avaliadores podem ser mobilizados.`
      });
    }

    // Validação de Missão Ativa (piloto não pode estar em duas missões)
    if (pilot.active_mission_id) {
      return res.status(400).json({
        error: 'PILOT_ALREADY_DEPLOYED',
        message: `[!] O piloto "${pilot.callsign}" já está mobilizado em outra missão ativa no momento.`
      });
    }

    // Validação de Nível de Licença (min_ll e max_ll)
    if (pilot.license_level < mission.min_ll || pilot.license_level > mission.max_ll) {
      return res.status(400).json({
        error: 'LL_MISMATCH',
        message: `[!] O nível de licença do piloto (LL ${pilot.license_level}) é incompatível com esta missão (Requer LL ${mission.min_ll} a ${mission.max_ll}).`
      });
    }

    // Verifica se já está inscrito nesta missão
    const alreadyApplied = mission.applications.some(
      (app: any) => app.pilot_id.toString() === pilot._id.toString()
    );

    if (alreadyApplied) {
      return res.status(400).json({
        error: 'ALREADY_APPLIED',
        message: `[!] O piloto "${pilot.callsign}" já está inscrito nesta operação.`
      });
    }

    // Cálculo do score de prioridade de matchmaking:
    // Mais prioridade para quem tem menos missões jogadas e está a mais tempo sem jogar
    const daysSinceLastMission = pilot.last_mission_date
      ? Math.floor((Date.now() - new Date(pilot.last_mission_date).getTime()) / (1000 * 60 * 60 * 24))
      : 60;
    const priorityScore = Math.max(0, 100 - (pilot.total_missions_played * 10) + Math.min(50, daysSinceLastMission));

    mission.applications.push({
      pilot_id: pilot._id,
      applied_at: new Date(),
      priority_score: priorityScore,
      status: 'PENDING'
    });

    await mission.save();

    console.log(`[+] Piloto "${pilot.callsign}" candidatou-se à missão "${mission.title}" (Score: ${priorityScore})`);

    return res.status(200).json({
      message: `[+] Piloto "${pilot.callsign}" inscrito com sucesso na operação "${mission.title}".`,
      application: {
        pilot_id: pilot._id,
        callsign: pilot.callsign,
        priority_score: priorityScore,
        status: 'PENDING'
      }
    });
  },

  /**
   * 7. Cancelar candidatura do próprio piloto.
   */
  async cancelApplication(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const { pilot_id } = req.body;

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      return res.status(400).json({ error: 'MISSION_CLOSED' });
    }

    // Localiza os pilotos do usuário
    const userPilots = await PilotModel.find({ user_id: req.user._id });
    const userPilotIds = userPilots.map((p) => p._id.toString());

    // Se passou pilot_id específico, remove esse. Se não, remove qualquer piloto do usuário
    const targetId = pilot_id ? String(pilot_id) : null;

    const initialCount = mission.applications.length;
    mission.applications = mission.applications.filter((app: any) => {
      const appPilotId = app.pilot_id.toString();
      if (targetId) {
        return appPilotId !== targetId;
      }
      return !userPilotIds.includes(appPilotId);
    });

    if (mission.applications.length === initialCount) {
      return res.status(404).json({
        error: 'APPLICATION_NOT_FOUND',
        message: '[!] Nenhuma candidatura localizada para cancelamento.'
      });
    }

    await mission.save();

    return res.json({
      message: `[+] Inscrição na missão "${mission.title}" foi cancelada.`
    });
  },

  /**
   * 8. Selecionar esquadrão / gerenciar candidaturas (Apenas o GM da missão ou ADMIN).
   */
  async selectPilots(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const { selections } = req.body; // Array de { pilot_id: string, status: 'SELECTED' | 'WAITLIST' | 'REJECTED' }

    if (!Array.isArray(selections)) {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: '[!] selections deve ser um array com os IDs dos pilotos e o status atribuído.'
      });
    }

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const isOwnerGm = mission.gm_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwnerGm && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: '[!] Apenas o Mestre pode escalar os pilotos.' });
    }

    // Contagem de selecionados
    const selectedCount = selections.filter((s) => s.status === 'SELECTED').length;
    if (selectedCount > mission.slots_total) {
      return res.status(400).json({
        error: 'SLOTS_EXCEEDED',
        message: `[!] Número de pilotos selecionados (${selectedCount}) excede o limite de vagas (${mission.slots_total}).`
      });
    }

    // Atualiza status de cada aplicação
    for (const sel of selections) {
      const app = mission.applications.find((a: any) => a.pilot_id.toString() === String(sel.pilot_id));
      if (app && ['SELECTED', 'WAITLIST', 'REJECTED', 'PENDING'].includes(sel.status)) {
        app.status = sel.status;
      }
    }

    await mission.save();

    return res.json({
      message: `[+] Esquadrão da operação "${mission.title}" atualizado com sucesso.`,
      applications: mission.applications
    });
  },

  /**
   * 9. Iniciar missão (IN_PROGRESS) - Vincula pilotos selecionados à missão.
   */
  async startMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const isOwnerGm = mission.gm_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwnerGm && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    if (mission.status !== 'OPEN') {
      return res.status(400).json({
        error: 'INVALID_MISSION_STATUS',
        message: `[!] Apenas missões com status OPEN podem ser iniciadas (Status atual: ${mission.status}).`
      });
    }

    const selectedPilots = mission.applications.filter((a: any) => a.status === 'SELECTED');
    if (selectedPilots.length === 0) {
      return res.status(400).json({
        error: 'NO_PILOTS_SELECTED',
        message: '[!] Selecione ao menos um piloto (SELECTED) antes de iniciar a operação.'
      });
    }

    // Vincula active_mission_id em todos os pilotos selecionados
    const selectedPilotIds = selectedPilots.map((a: any) => a.pilot_id);
    await PilotModel.updateMany(
      { _id: { $in: selectedPilotIds } },
      { active_mission_id: mission._id }
    );

    mission.status = 'IN_PROGRESS';
    await mission.save();

    console.log(`[+] Missão iniciada: "${mission.title}" com ${selectedPilotIds.length} pilotos.`);

    return res.json({
      message: `[+] Operação "${mission.title}" iniciada! Esquadrão mobilizado em combate.`,
      mission
    });
  },

  /**
   * 10. Concluir missão (COMPLETED) com AAR (After Action Report) e recompensas.
   */
  async completeMission(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const { id } = req.params;
    const { aar } = req.body;

    const mission = await MissionModel.findById(id);
    if (!mission) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const isOwnerGm = mission.gm_id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwnerGm && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    if (mission.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'NOT_IN_PROGRESS',
        message: '[!] Apenas missões que estão IN_PROGRESS podem ser concluídas.'
      });
    }

    // Desvincula pilotos e atualiza estatísticas de missões jogadas
    const selectedPilots = mission.applications.filter((a: any) => a.status === 'SELECTED');
    const selectedPilotIds = selectedPilots.map((a: any) => a.pilot_id);

    await PilotModel.updateMany(
      { _id: { $in: selectedPilotIds } },
      {
        active_mission_id: null,
        last_mission_date: new Date(),
        $inc: { total_missions_played: 1 }
      }
    );

    mission.status = 'COMPLETED';
    mission.aar = aar ? aar.trim() : mission.aar;
    await mission.save();

    console.log(`[+] Missão concluída: "${mission.title}". Pilotos liberados e registrados.`);

    return res.json({
      message: `[+] Operação "${mission.title}" finalizada com sucesso. Relatório de pós-ação (AAR) arquivado.`,
      mission
    });
  }
};
