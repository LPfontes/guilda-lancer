import axios from 'axios';
import { IPilotTalent, IPilotSkill, IPilotLicense, IPilotMech } from '../database/models/Pilot.model.js';

export interface ParsedCompconData {
  callsign: string;
  name: string;
  license_level: number;
  grit: number;
  hull: number;
  agility: number;
  systems: number;
  engineering: number;
  talents: IPilotTalent[];
  skills: IPilotSkill[];
  licenses: IPilotLicense[];
  mechs: IPilotMech[];
  active_mech_name: string;
  active_mech_frame: string;
  active_mech_image?: string;
  portrait?: string;
  share_code?: string;
  raw_data: any;
  validation_warnings: string[];
  is_valid: boolean;
}

export class CompconService {
  /**
   * Sanitiza e extrai o share code limpo a partir de código puro ou URL do COMP/CON.
   */
  static cleanShareCode(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    // Verifica se é uma URL (ex: https://compcon.app/#/pilot/ABC123 ou similar)
    const urlMatch = trimmed.match(/(?:pilot|share|vault|characters)\/([a-zA-Z0-9_-]+)/i);
    let code = urlMatch && urlMatch[1] ? urlMatch[1].trim() : trimmed;
    // Remove traços/hífens (ex: C1NO-1KI6-K32A -> C1NO1KI6K32A)
    return code.replace(/-/g, '').toUpperCase();
  }

  /**
   * Converte identificadores técnicos (ex: t_house_guard, sk_apply_fists_to_faces) em nomes legíveis.
   */
  static formatIdToName(id: string): string {
    if (!id) return 'N/D';
    return id
      .replace(/^(t_|sk_|mf_|ms_|mw_|pg_|cb_)/, '')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Faz o parse e normalização de dados brutos do COMP/CON (JSON string ou Object).
   */
  static parseCompconPilot(input: any, providedShareCode?: string): ParsedCompconData {
    let data: any = input;

    // Se for string, tenta realizar o parse de JSON de forma resiliente
    if (typeof input === 'string') {
      const trimmed = input.trim();
      try {
        data = JSON.parse(trimmed);
      } catch (err: any) {
        // Trata caso comum onde o usuário colou múltiplos objetos JSON concatenados (ex: ...}{...)
        const splitIdx = trimmed.indexOf('}{');
        if (splitIdx !== -1) {
          try {
            data = JSON.parse(trimmed.substring(0, splitIdx + 1));
          } catch {
            try {
              data = JSON.parse(trimmed.substring(splitIdx + 1));
            } catch {
              throw new Error(`[!] Formato JSON inválido para ficha do COMP/CON: ${err.message}`);
            }
          }
        } else {
          throw new Error(`[!] Formato JSON inválido para ficha do COMP/CON: ${err.message}`);
        }
      }
    }

    if (!data || typeof data !== 'object') {
      throw new Error('[!] Dados da ficha do COMP/CON estão vazios ou não são um objeto válido.');
    }

    // Se vier embrulhado em "pilot" ou "data" (ex: export Save Pilot), extrai
    const p = data.pilot && typeof data.pilot === 'object' 
      ? data.pilot 
      : data.data && typeof data.data === 'object'
      ? data.data
      : data;

    // 1. Callsign e Nome
    const callsign = (p.callsign || p.callSign || p.name || 'SEM_INDICATIVO').toString().trim().toUpperCase();
    const name = (p.name || p.real_name || p.realName || '').toString().trim();

    // 1b. Imagem/Retrato do Piloto (cloud_portrait do COMP/CON S3 ou portrait local/base64)
    const portrait = (
      p.cloud_portrait ||
      p.img?.cloud_portrait ||
      p.img?.avatar?.image?.src ||
      p.portrait ||
      p.img?.portrait ||
      ''
    ).toString().trim();

    // 2. License Level (LL)
    let license_level = 0;
    if (typeof p.level === 'number') license_level = p.level;
    else if (typeof p.license_level === 'number') license_level = p.license_level;
    else if (typeof p.ll === 'number') license_level = p.ll;
    else if (typeof p.level === 'string') license_level = parseInt(p.level, 10) || 0;
    license_level = Math.max(0, Math.min(12, license_level));

    // 3. Grit (Determinação = Math.ceil(LL / 2))
    const expectedGrit = Math.ceil(license_level / 2);
    const grit = typeof p.grit === 'number' ? p.grit : (p.stats?.max?.grit ?? expectedGrit);

    // 4. HASE Stats (Hull, Agility, Systems, Engineering)
    let hull = 0;
    let agility = 0;
    let systems = 0;
    let engineering = 0;

    if (Array.isArray(p.mechSkills)) {
      // COMP/CON v3 pilot format: [hull, agility, systems, engineering]
      hull = Number(p.mechSkills[0]) || 0;
      agility = Number(p.mechSkills[1]) || 0;
      systems = Number(p.mechSkills[2]) || 0;
      engineering = Number(p.mechSkills[3]) || 0;
    } else if (Array.isArray(p.hase)) {
      hull = Number(p.hase[0]) || 0;
      agility = Number(p.hase[1]) || 0;
      systems = Number(p.hase[2]) || 0;
      engineering = Number(p.hase[3]) || 0;
    } else if (p.stats && typeof p.stats === 'object') {
      const s = p.stats.max || p.stats;
      hull = Number(s.hull || s.hul) || 0;
      agility = Number(s.agility || s.agi) || 0;
      systems = Number(s.systems || s.sys) || 0;
      engineering = Number(s.engineering || s.eng) || 0;
    } else {
      hull = Number(p.hull) || 0;
      agility = Number(p.agility || p.agi) || 0;
      systems = Number(p.systems || p.sys) || 0;
      engineering = Number(p.engineering || p.eng) || 0;
    }

    // 5. Talentos
    const talents: IPilotTalent[] = [];
    const rawTalents = Array.isArray(p.talents) ? p.talents : [];
    for (const t of rawTalents) {
      if (typeof t === 'string') {
        talents.push({ id: t, name: this.formatIdToName(t), rank: 1 });
      } else if (t && typeof t === 'object') {
        const tId = t.id || t.data?.id || t.talent_id || t.name || 'unknown_talent';
        const tName = t.data?.name || t.name || this.formatIdToName(tId);
        const tRank = Number(t.rank || t.level || 1);
        talents.push({ id: tId, name: tName, rank: tRank });
      }
    }

    // 6. Gatilhos de Perícia (Skills / Skill Triggers)
    const skills: IPilotSkill[] = [];
    const rawSkills = Array.isArray(p.skills)
      ? p.skills
      : Array.isArray(p.skill_triggers)
      ? p.skill_triggers
      : [];

    for (const s of rawSkills) {
      if (typeof s === 'string') {
        skills.push({ id: s, name: this.formatIdToName(s), bonus: 2 });
      } else if (s && typeof s === 'object') {
        const sId = s.id || s.data?.id || s.skill_id || s.name || 'unknown_skill';
        const sName = s.data?.name || s.name || this.formatIdToName(sId);
        const sBonus = Number(s.bonus ?? (typeof s.rank === 'number' ? s.rank * 2 : 2));
        skills.push({ id: sId, name: sName, bonus: sBonus });
      }
    }

    // 7. Licenças (Licenses)
    const licenses: IPilotLicense[] = [];
    const rawLicenses = Array.isArray(p.licenses) ? p.licenses : [];
    for (const l of rawLicenses) {
      if (typeof l === 'string') {
        licenses.push({ id: this.formatIdToName(l), rank: 1 });
      } else if (l && typeof l === 'object') {
        const lId = l.stub?.name || l.name || (l.id ? this.formatIdToName(l.id) : 'unknown_license');
        licenses.push({ id: lId, rank: Number(l.rank || 1) });
      }
    }

    // 8. Mechs / Chassis
    const mechs: IPilotMech[] = [];
    let active_mech_name = '';
    let active_mech_frame = '';
    let active_mech_image = '';
    const activeMechId = p.state?.active_mech_id || p.active_mech_id || p.activeMechId;

    const rawMechs = Array.isArray(p.mechs)
      ? p.mechs
      : Array.isArray(data.mechs)
      ? data.mechs
      : [];

    for (const m of rawMechs) {
      if (m && typeof m === 'object') {
        const mId = m.id || `mech_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const mName = (m.name || 'GMS Everest Padrão').toString();
        const mFrame = (m.frameData?.name || m.frame || m.frame_id || 'GMS Standard Pattern I Everest').toString();
        const mImage = (m.cloud_portrait || m.img?.cloud_portrait || m.frameData?.image_url || m.portrait || '').toString().trim();
        const isTargetActive = activeMechId ? m.id === activeMechId : Boolean(m.active || m.is_active);
        const isActive = isTargetActive || (rawMechs.length === 1);

        // Se o mech tiver atributos próprios de HASE e o piloto não tiver, complementa
        if (hull === 0 && agility === 0 && systems === 0 && engineering === 0 && m.stats?.max) {
          hull = Number(m.stats.max.hull) || 0;
          agility = Number(m.stats.max.agi) || 0;
          systems = Number(m.stats.max.sys) || 0;
          engineering = Number(m.stats.max.eng) || 0;
        }

        const mechEntry: IPilotMech = {
          id: mId,
          name: mName,
          frame: mFrame,
          active: isActive,
          loadout: m.loadouts || m.loadout || null
        };
        mechs.push(mechEntry);

        if (isActive && !active_mech_name) {
          active_mech_name = mName;
          active_mech_frame = mFrame;
          active_mech_image = mImage;
        }
      }
    }

    if (mechs.length > 0 && !active_mech_name) {
      active_mech_name = mechs[0].name;
      active_mech_frame = mechs[0].frame;
      active_mech_image = (rawMechs[0]?.cloud_portrait || rawMechs[0]?.frameData?.image_url || '').toString().trim();
      mechs[0].active = true;
    }

    // 9. Share Code
    const detectedShareCode = this.cleanShareCode(
      providedShareCode || p.share_code || p.shareCode || p.cloud_id || data.share_code || ''
    );

    // 10. Validação de Regras do LANCER
    const warnings: string[] = [];

    // Verificação de HASE
    const totalHASE = hull + agility + systems + engineering;
    const maxAllowedHASE = license_level * 2;
    if (totalHASE > maxAllowedHASE) {
      warnings.push(
        `[HASE_OVERALLOCATION] Pontos de HASE investidos (${totalHASE}) excedem o permitido para LL ${license_level} (máx: ${maxAllowedHASE} pontos).`
      );
    }

    if (hull > 6 || agility > 6 || systems > 6 || engineering > 6) {
      warnings.push('[HASE_STAT_CAP] Nenhum atributo HASE pode exceder 6 pontos no regulamento padrão do LANCER.');
    }

    // Verificação de Talentos (LL0 = 3 pontos, +1 ponto por LL adicional)
    const totalTalentRanks = talents.reduce((sum, t) => sum + (t.rank || 1), 0);
    const maxAllowedTalentRanks = license_level + 3;
    if (totalTalentRanks > maxAllowedTalentRanks) {
      warnings.push(
        `[TALENTS_OVERALLOCATION] Ranks de Talentos alocados (${totalTalentRanks}) excedem o teto para LL ${license_level} (máx: ${maxAllowedTalentRanks} ranks).`
      );
    }

    // Verificação se há Mech ativo
    if (mechs.length === 0) {
      warnings.push('[NO_MECH_CONFIGURED] O piloto não possui nenhum chassi/mech configurado na ficha.');
    }

    return {
      callsign,
      name,
      license_level,
      grit,
      hull,
      agility,
      systems,
      engineering,
      talents,
      skills,
      licenses,
      mechs,
      active_mech_name: active_mech_name || 'GMS Everest Padrão',
      active_mech_frame: active_mech_frame || 'GMS Standard Pattern I Everest',
      active_mech_image,
      portrait,
      share_code: detectedShareCode,
      raw_data: data,
      validation_warnings: warnings,
      is_valid: warnings.length === 0
    };
  }

  /**
   * Resolve dados de ficha a partir de um Share Code do COMP/CON oficial via API na nuvem.
   */
  static async fetchByShareCode(rawCode: string): Promise<any> {
    const shareCode = this.cleanShareCode(rawCode);

    if (!shareCode) {
      throw new Error('[!] Share code ou URL do COMP/CON não informada.');
    }

    // 1. Consulta a API oficial do COMP/CON v3 no AWS API Gateway
    try {
      const apiUrl = `https://idu55qr85i.execute-api.us-east-1.amazonaws.com/prod/code?scope=item&codes=${encodeURIComponent(
        JSON.stringify([shareCode])
      )}`;

      const codeResponse = await axios.get(apiUrl, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Y5DnZ4miJi30iazqn9VV73A253Db7HRxamHEQeMr'
        }
      });

      const resData = codeResponse.data;
      const uri = resData?.uri || (Array.isArray(resData) && resData[0]?.uri);

      if (uri) {
        // Baixa o payload real do CloudFront S3
        const cfResponse = await axios.get(`https://ds69h3g1zxwgy.cloudfront.net/${uri}`, {
          timeout: 8000
        });

        if (cfResponse.data && (cfResponse.data.callsign || cfResponse.data.mechs || cfResponse.data.itemType === 'pilot')) {
          return cfResponse.data;
        }
      }
    } catch (err: any) {
      console.warn(`[!] Falha ao consultar API oficial do COMP/CON v3 para ${shareCode}:`, err.message);
    }

    // 2. URLs de Fallback do ecossistema legado
    const candidateUrls = [
      `https://compcon-app.firebaseio.com/shares/${shareCode}.json`,
      `https://cloud.compcon.app/api/share/${shareCode}`
    ];

    for (const url of candidateUrls) {
      try {
        const response = await axios.get(url, {
          timeout: 4000,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.data && (response.data.callsign || response.data.pilot || response.data.mechs)) {
          return response.data;
        }
      } catch (e) {
        // Continua
      }
    }

    throw new Error(
      `[!] Não foi possível localizar a ficha para o Share Code "${shareCode}" no COMP/CON. Verifique se o código está correto ou copie e cole o JSON exportado diretamente.`
    );
  }

  /**
   * Gera um resumo tático militar em estilo de terminal Omninet.
   */
  static generateTacticalSummary(pilot: {
    callsign: string;
    license_level: number;
    grit: number;
    hull: number;
    agility: number;
    systems: number;
    engineering: number;
    active_mech_name?: string;
    active_mech_frame?: string;
    status: string;
    talents?: IPilotTalent[];
    skills?: IPilotSkill[];
  }): string {
    const talentsStr = (pilot.talents || []).map((t) => `${t.name} (R${t.rank})`).join(', ') || 'NENHUM';
    const skillsStr = (pilot.skills || []).map((s) => `${s.name} (+${s.bonus})`).join(', ') || 'PADRÃO';

    return [
      `=============================================================`,
      `// OMNINET ARCHIVE RECORD // PILOT DOSSIER`,
      `=============================================================`,
      `INDICATIVO (CALLSIGN): ${pilot.callsign}`,
      `STATUS OPERACIONAL   : ${pilot.status}`,
      `NÍVEL DE LICENÇA (LL): ${pilot.license_level} | DETERMINAÇÃO (GRIT): +${pilot.grit}`,
      `ATRIBUTOS HASE       : CASCO:${pilot.hull} | AGI:${pilot.agility} | SIS:${pilot.systems} | ENG:${pilot.engineering}`,
      `MECH ATIVO           : ${pilot.active_mech_name || 'N/D'} [CHASSI: ${pilot.active_mech_frame || 'N/D'}]`,
      `TALENTOS             : ${talentsStr}`,
      `GATILHOS DE PERÍCIA  : ${skillsStr}`,
      `=============================================================`
    ].join('\n');
  }
}
