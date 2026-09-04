import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { IPilot } from '../types/pilot.types.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { localization } from '../services/localization.service.js';
import { buildMissionReportText } from '../services/mission-report.helper.js';
import {
  IMechCombatState,
  getStoredCombatState,
  saveCombatState,
  resetCombatState,
  getVitalWidthClass,
  WeaponCombatState,
  SystemCombatState
} from '../services/combat-tracker.helper.js';

interface IWeaponParsed {
  mountType: string;
  slotSize: string;
  name: string;
  modName?: string;
  weaponType?: string;
  range: string;
  damage: string;
  damageType: string;
  tags: Array<{ name: string; description: string }>;
  description?: string;
  isEmpty: boolean;
}

interface ISystemParsed {
  name: string;
  sp: number;
  type?: string;
  description: string;
  actions?: any[];
}

interface ITraitParsed {
  name: string;
  description: string;
}

interface ICoreSystemParsed {
  name: string;
  description?: string;
  passiveName?: string;
  passiveEffect?: string;
  activeName: string;
  activeEffect: string;
}

/**
 * Ficha Completa do Mecha (Chassis Combat Sheet).
 * Utiliza as traduções oficiais do repositório massif-press/compcon-locales (pt_BR)
 * combinadas com a leitura estrita e dinâmica do banco de dados (MongoDB / COMP/CON).
 */
export class MechSheetView {
  private container: HTMLElement;
  private pilotId: string | null = null;
  private pilotData: IPilot | null = null;
  private combatState: IMechCombatState | null = null;
  private maxHp: number = 10;
  private maxRepairs: number = 4;
  private totalHeat: number = 6;
  private abortController: AbortController = new AbortController();
  private weaponsListCached: IWeaponParsed[] = [];
  private systemsListCached: ISystemParsed[] = [];
  private canEdit: boolean = false;

  constructor(container: HTMLElement, pilotId: string | null = null) {
    this.container = container;
    this.pilotId = pilotId;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">${localization.t('common.loading', 'LENDO TELEMETRIA DO BANCO DE DADOS...')}</div>
      </div>
    `;

    try {
      await this.loadData();

      if (!this.pilotData) {
        this.renderEmptyState();
        return;
      }

      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      this.renderError(err.message || 'Falha ao carregar ficha do mecha do banco de dados.');
    }
  }

  private async loadData() {
    if (this.pilotId) {
      try {
        const pilot = await pilotService.getPilotById(this.pilotId);
        if (pilot) {
          this.pilotData = pilot;
          return;
        }
      } catch (err) {
        console.warn('[!] Falha ao carregar ficha por ID via API:', err);
      }
    }

    const res = await pilotService.getMyPilots();
    const pilots = res.pilots || [];

    if (this.pilotId) {
      this.pilotData = pilots.find((p) => p._id === this.pilotId) || null;
    }

    if (!this.pilotData) {
      this.pilotData = res.active_pilot || pilots[0] || null;
    }
  }

  private renderEmptyState() {
    this.container.innerHTML = `
      <div class="sheet-container">
        <div class="sheet-nav-bar">
          <a href="#/hangar" class="sheet-back-link">
            <i class="mdi mdi-arrow-left"></i>
            <span>${localization.t('sheet.return_to_hangar', 'RETORNAR AO HANGAR')}</span>
          </a>
        </div>

        <div class="card sheet-empty-card">
          <div class="sheet-empty-content">
            <div class="sheet-empty-icon">
              ${getCompconIcon('mech', 'compcon-icon-empty')}
            </div>
            <div class="sheet-empty-tag">
              <i class="mdi mdi-alert-circle-outline"></i> ${localization.t('sheet.no_mech_title', 'NENHUM CHASSI NO BANCO DE DADOS')}
            </div>
            <h2 class="sheet-empty-title">${localization.t('sheet.no_mech_title', 'NENHUM MECHA ENCONTRADO')}</h2>
            <p class="sheet-empty-desc">
              ${localization.t('sheet.no_mech_desc', 'Não há fichas registradas para seu operador no banco de dados. Sincronize sua ficha do COMP/CON no Hangar para carregar o chassi.')}
            </p>
            <a href="#/hangar" class="btn btn-primary">
              <i class="mdi mdi-download"></i>
              <span>${localization.t('hangar.import_btn', 'IMPORTAR NO HANGAR')}</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private renderContent() {
    if (!this.pilotData) return;
    const p = this.pilotData;

    // 1. Identificar o chassi ativo a partir de compcon_raw ou mechs do banco
    const raw = p.compcon_raw;
    const activeMech =
      raw?.mechs?.find((m: any) => m.id === raw?.active_mech_id || m.active) ||
      raw?.mechs?.[0] ||
      p.mechs?.find((m) => m.active) ||
      p.mechs?.[0];

    const frameData = activeMech?.frameData;
    const mechName = activeMech?.name || p.active_mech_name || 'Chassi Não Nomeado';
    const rawFrameName = frameData?.name || activeMech?.frame || p.active_mech_frame || 'Everest';
    const frameName = localization.translateItemName(frameData?.id, rawFrameName);
    const manufacturer = localization.translateManufacturer(frameData?.source);
    const isHorus = frameData?.source === 'HORUS' || rawFrameName.toUpperCase().includes('HORUS');
    const mechImage =
      p.active_mech_image ||
      activeMech?.cloud_portrait ||
      frameData?.image_url ||
      activeMech?.img?.cloud_portrait ||
      '';

    // 2. Extrair atributos reais do Frame (stats) do banco
    const frameStats = frameData?.stats || activeMech?.stats?.max || {};
    const baseHp = typeof frameStats.hp === 'number' ? frameStats.hp : 10;
    const baseHeat = typeof frameStats.heatcap === 'number' ? frameStats.heatcap : 6;
    const baseRepairs = typeof frameStats.repcap === 'number' ? frameStats.repcap : 4;
    const armor = typeof frameStats.armor === 'number' ? frameStats.armor : 0;
    const baseSpeed = typeof frameStats.speed === 'number' ? frameStats.speed : 4;
    const baseEvasion = typeof frameStats.evasion === 'number' ? frameStats.evasion : 8;
    const baseEDefense = typeof frameStats.edef === 'number' ? frameStats.edef : 8;
    const sensors = typeof frameStats.sensor_range === 'number' ? frameStats.sensor_range : 10;
    const baseTechAttack = typeof frameStats.tech_attack === 'number' ? frameStats.tech_attack : 0;
    const baseSave = typeof frameStats.save === 'number' ? frameStats.save : 10;
    const size = frameStats.size !== undefined ? String(frameStats.size) : '1';

    // Bônus H.A.S.E. do Piloto
    const hullBonus = p.hull || 0;
    const agiBonus = p.agility || 0;
    const sysBonus = p.systems || 0;
    const engBonus = p.engineering || 0;
    const gritBonus = p.grit || 0;

    // Verificar bônus extra de sistemas (ex: Personalizations +2 HP)
    const loadout = activeMech?.loadouts?.[0] || activeMech?.loadout;
    const systemsList: any[] = loadout?.systems || [];
    let extraHp = 0;
    for (const s of systemsList) {
      const bonuses = s.data?.bonuses || [];
      for (const b of bonuses) {
        if (b.id === 'hp') extraHp += Number(b.val) || 0;
      }
    }

    // Extrair Bônus de Núcleo (Core Bonuses diretamente do banco para exibição)
    const rawCbList: any[] = (
      p.compcon_raw?.core_bonuses ||
      p.compcon_raw?.pilot?.core_bonuses ||
      p.compcon_raw?.data?.core_bonuses ||
      (p as any).core_bonuses ||
      activeMech?.core_bonuses ||
      loadout?.core_bonuses ||
      []
    );
    const coreBonuses = rawCbList.map((cb) => (typeof cb === 'string' ? { id: cb, name: cb, effect: '', description: '' } : cb));

    const totalHp = baseHp + hullBonus * 2 + gritBonus + extraHp;
    const totalHeat = baseHeat + engBonus;
    const totalSpeed = baseSpeed + Math.floor(agiBonus / 2);
    const totalEvasion = baseEvasion + agiBonus;
    const totalEDefense = baseEDefense + sysBonus;
    const totalTechAtkVal = baseTechAttack + sysBonus;
    const totalTechAttack = totalTechAtkVal >= 0 ? `+${totalTechAtkVal}` : `${totalTechAtkVal}`;
    const totalSaveTarget = baseSave + gritBonus;
    const totalRepairs = baseRepairs + Math.floor(hullBonus / 2);
    const maxSp = (typeof frameStats.sp === 'number' ? frameStats.sp : 6) + gritBonus;

    // 3. Extrair Armas, Sistemas, Traits e Core System reais e localizados
    const weapons = this.extractWeapons(loadout);
    const systems = this.extractSystems(systemsList);
    const frameId = frameData?.id || activeMech?.frame;
    const traits = this.extractTraits(frameData, frameId);
    const coreSystem = this.extractCoreSystem(frameData, frameId);
    const totalSpUsed = systems.reduce((acc, s) => acc + s.sp, 0);

    this.maxHp = totalHp;
    this.totalHeat = totalHeat;
    this.maxRepairs = totalRepairs;
    this.weaponsListCached = weapons;
    this.systemsListCached = systems;

    // Permissões: apenas o dono da ficha e um administrador podem alterar o estado do chassi
    const currentUser = authService.currentUser;
    const isAdmin = currentUser?.role === 'ADMIN';
    const pilotUserId = typeof p.user_id === 'object' && p.user_id !== null ? (p.user_id as any)._id : p.user_id;
    const isOwner = Boolean(
      (currentUser?._id && pilotUserId && String(currentUser._id) === String(pilotUserId)) ||
      (authService.activePilot?._id && String(authService.activePilot._id) === String(p._id))
    );
    this.canEdit = Boolean(isAdmin || isOwner);

    if (!this.combatState) {
      this.combatState = getStoredCombatState(p._id, {
        maxHp: totalHp,
        maxRepairs: totalRepairs
      });
    }
    const cs = this.combatState;

    this.container.innerHTML = `
      <div class="sheet-container">
        <!-- Navegação Superior -->
        <div class="sheet-nav-bar">
          <div class="sheet-breadcrumbs">
            <a href="#/hangar" class="sheet-back-link">
              <i class="mdi mdi-arrow-left"></i>
              <span>${localization.t('nav.hangar', 'HANGAR')}</span>
            </a>
            <span class="sheet-crumb-separator">//</span>
            <span class="sheet-crumb-current">${localization.t('sheet.mech_sheet', 'FICHA DO MECHA')}: ${mechName}</span>
          </div>

          <div class="sheet-top-actions">
            ${
              this.canEdit
                ? `
              <button id="btn-full-repair" class="btn-full-repair sheet-action-btn" title="Descanso Completo: Restaura PV, Estrutura, Estresse, Reparos e repara Armas/Sistemas">
                <i class="mdi mdi-wrench-clock"></i>
                <span>${localization.t('sheet.full_repair', 'REPARO COMPLETO')}</span>
              </button>
            `
                : `
              <span class="sheet-readonly-badge" title="Ficha aberta em modo de leitura (apenas o operador proprietário e administradores podem alterar)">
                <i class="mdi mdi-eye-outline"></i>
                <span>${localization.t('sheet.readonly_mode', 'MODO LEITURA // TELEMETRIA')}</span>
              </span>
            `
            }
            <a href="#/pilot?id=${p._id}" class="btn btn-secondary sheet-action-btn" title="Ver Dossiê do Piloto">
              ${getCompconIcon('pilot', 'compcon-icon')}
              <span>${localization.t('sheet.pilot_sheet', 'FICHA DO PILOTO')}</span>
            </a>
            ${
              p.share_code
                ? `
              <button id="btn-copy-sharecode" class="btn btn-secondary sheet-action-btn" title="Copiar Share Code">
                <i class="mdi mdi-share-variant"></i>
                <span>SHARE: ${p.share_code}</span>
              </button>
            `
                : ''
            }
            
            <button id="btn-pilot-aar" class="btn btn-secondary sheet-action-btn" title="Copiar Modelo Oficial de Relatório de Missão">
              <i class="mdi mdi-clipboard-text-outline"></i>
              <span>${localization.t('sheet.mission_report', 'RELATÓRIO DE MISSÃO')}</span>
            </button>
          </div>
        </div>

        <!-- Barra de Homologação do Administrador (Aprovação / Rejeição) -->
        ${
          authService.currentUser?.role === 'ADMIN'
            ? `
          <div class="sheet-admin-audit-bar">
            <div class="sheet-audit-status">
              <span class="review-status-pill status-${(p.status || 'PENDING_APPROVAL').toLowerCase()}">
                <i class="mdi ${
                  p.status === 'APPROVED'
                    ? 'mdi-check-decagram'
                    : p.status === 'REJECTED'
                    ? 'mdi-alert-circle'
                    : 'mdi-clock-outline'
                }"></i>
                <span>STATUS: ${
                  p.status === 'APPROVED'
                    ? localization.t('sheet.status_approved', 'HOMOLOGADA // APROVADA')
                    : p.status === 'REJECTED'
                    ? localization.t('sheet.status_rejected', 'NÃO-CONFORME // REJEITADA')
                    : localization.t('sheet.status_pending', 'AGUARDANDO HOMOLOGAÇÃO')
                }</span>
              </span>
              ${
                p.status === 'REJECTED' && p.rejection_reason
                  ? `<span class="sheet-audit-reason">// PENDÊNCIA: ${p.rejection_reason}</span>`
                  : ''
              }
            </div>

            <div class="sheet-audit-actions">
              ${
                p.status !== 'APPROVED'
                  ? `
                <button type="button" id="btn-admin-approve" class="btn-approve-sheet" title="Aprovar e homologar ficha">
                  <i class="mdi mdi-check"></i>
                  <span>${localization.t('sheet.approve_sheet', 'APROVAR FICHA')}</span>
                </button>
              `
                  : ''
              }
              ${
                p.status !== 'REJECTED'
                  ? `
                <button type="button" id="btn-admin-reject" class="btn-reject-sheet" title="Apontar pendência e rejeitar ficha">
                  <i class="mdi mdi-close"></i>
                  <span>${localization.t('sheet.reject_sheet', 'REJEITAR')}</span>
                </button>
              `
                  : ''
              }
              <a href="#/review" class="btn btn-secondary" title="Retornar à tela de avaliações">
                <i class="mdi mdi-format-list-checks"></i>
                <span>${localization.t('sheet.audit_panel', 'PAINEL DE AVALIAÇÃO')}</span>
              </a>
            </div>
          </div>
        `
            : ''
        }

        <!-- Banner do Mecha -->
        <div class="card sheet-hero-banner">
          <div class="sheet-hero-main">
            <div class="sheet-portrait-box">
              ${
                mechImage
                  ? `<img src="${mechImage}" alt="${mechName}" class="sheet-mech-img" />`
                  : `<div class="sheet-img-placeholder">${getCompconIcon('mech', 'compcon-icon-hero')}</div>`
              }
              <div class="sheet-portrait-frame-tag">
                ${getCompconIcon('mech', 'compcon-icon-sm')}
                <span>${frameName}</span>
              </div>
            </div>

            <div class="sheet-identity-details">
              <div class="sheet-corp-badge ${isHorus ? 'badge-horus' : 'badge-gms'}">
                ${isHorus ? `<code class="horus">${manufacturer}</code>` : manufacturer}
              </div>

              <h1 class="sheet-mech-title">${mechName}</h1>

              <div class="sheet-pilot-dossier-line">
                <span class="sheet-dossier-label">${localization.t('sheet.pilot_operator', 'PILOTO RESPONSÁVEL')}:</span>
                <a href="#/pilot?id=${p._id}" class="sheet-operator-link">
                  <strong class="sheet-dossier-callsign">${p.callsign}</strong>
                </a>
                <span class="sheet-ll-badge">LL ${p.license_level}</span>
                <span class="sheet-grit-badge">${localization.t('sheet.grit', 'BRIO').toUpperCase()} +${p.grit}</span>
                ${p.is_active ? `<span class="sheet-active-tag">[ ${localization.t('hangar.active_badge', 'CHASSI ATIVO')} ]</span>` : ''}
              </div>

              <!-- Atributos H.A.S.E. / C.A.S.E. Aplicados ao Chassi -->
              <div class="sheet-hase-bar">
                <div class="sheet-hase-item hase-hull">
                  <span class="hase-label">${localization.t('sheet.hull', 'CASCO').toUpperCase()}</span>
                  <span class="hase-val">${hullBonus}</span>
                </div>
                <div class="sheet-hase-item hase-agility">
                  <span class="hase-label">${localization.t('sheet.agility', 'AGILIDADE').toUpperCase()}</span>
                  <span class="hase-val">${agiBonus}</span>
                </div>
                <div class="sheet-hase-item hase-systems">
                  <span class="hase-label">${localization.t('sheet.systems_stat', 'SISTEMAS').toUpperCase()}</span>
                  <span class="hase-val">${sysBonus}</span>
                </div>
                <div class="sheet-hase-item hase-engineering">
                  <span class="hase-label">${localization.t('sheet.engineering', 'ENGENHARIA').toUpperCase()}</span>
                  <span class="hase-val">${engBonus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Módulo 1: Gauges de Sobrevivência (Combat Vitals Interativos) -->
        <div class="sheet-vitals-grid">
          <!-- Card de PV & Estrutura -->
          <div class="card sheet-vital-card">
            <div class="vital-card-header">
              <span class="vital-title">${localization.t('sheet.hp', 'PONTOS DE VIDA (PV)')}</span>
              <span class="vital-counter">${cs.currentHp} / ${totalHp} PV</span>
            </div>
            <div class="vital-progress-bar">
              <div class="vital-fill vital-fill-hp ${getVitalWidthClass(cs.currentHp, totalHp)}"></div>
            </div>
            ${
              this.canEdit
                ? `
            <div class="vital-tracker-controls">
              <div class="vital-tracker-btn-group">
                <button type="button" class="btn-vital-step btn-vital-minus" data-vital="hp" data-delta="-5" title="-5 PV">-5</button>
                <button type="button" class="btn-vital-step btn-vital-minus" data-vital="hp" data-delta="-1" title="-1 PV">-1</button>
              </div>
              <span class="vital-value-display">${cs.currentHp} PV</span>
              <div class="vital-tracker-btn-group">
                <button type="button" class="btn-vital-step btn-vital-plus" data-vital="hp" data-delta="1" title="+1 PV">+1</button>
                <button type="button" class="btn-vital-step btn-vital-plus" data-vital="hp" data-delta="5" title="+5 PV">+5</button>
              </div>
            </div>
            `
                : ''
            }
            <div class="vital-pips-container">
              <span class="vital-pips-label">${localization.t('sheet.structure', 'ESTRUTURA')}:</span>
              <div class="pips-row">
                ${[1, 2, 3, 4]
                  .map((idx) =>
                    this.canEdit
                      ? `<button type="button" class="pip pip-structure pip-interactive ${idx <= cs.currentStructure ? 'active' : ''}" data-vital-pip="structure" data-val="${idx}" title="Definir Estrutura para ${idx}"></button>`
                      : `<span class="pip pip-structure pip-static ${idx <= cs.currentStructure ? 'active' : ''}"></span>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- Card de Calor & Estresse -->
          <div class="card sheet-vital-card">
            <div class="vital-card-header">
              <span class="vital-title">${localization.t('sheet.heat', 'CALOR / REATOR')}</span>
              <div class="vital-counter-box">
                ${cs.currentHeat >= totalHeat ? '<span class="badge-overheat"><i class="mdi mdi-fire-alert"></i></span>' : ''}
                <span class="vital-counter">${cs.currentHeat} / ${totalHeat} CALOR</span>
              </div>
            </div>
            <div class="vital-progress-bar">
              <div class="vital-fill vital-fill-heat ${getVitalWidthClass(cs.currentHeat, totalHeat)}"></div>
            </div>
            ${
              this.canEdit
                ? `
            <div class="vital-tracker-controls">
              <div class="vital-tracker-btn-group">
                <button type="button" class="btn-vital-step btn-vital-minus" data-vital="heat" data-delta="-2" title="-2 Calor">-2</button>
                <button type="button" class="btn-vital-step btn-vital-minus" data-vital="heat" data-delta="-1" title="-1 Calor">-1</button>
              </div>
              <span class="vital-value-display">${cs.currentHeat} CALOR</span>
              <div class="vital-tracker-btn-group">
                <button type="button" class="btn-vital-step btn-vital-plus" data-vital="heat" data-delta="1" title="+1 Calor">+1</button>
                <button type="button" class="btn-vital-step btn-vital-plus" data-vital="heat" data-delta="2" title="+2 Calor">+2</button>
              </div>
            </div>
            `
                : ''
            }
            <div class="vital-pips-container">
              <span class="vital-pips-label">${localization.t('sheet.stress', 'ESTRESSE DE REATOR')}:</span>
              <div class="pips-row">
                ${[1, 2, 3, 4]
                  .map((idx) =>
                    this.canEdit
                      ? `<button type="button" class="pip pip-stress pip-interactive ${idx <= cs.currentStress ? 'active' : ''}" data-vital-pip="stress" data-val="${idx}" title="Definir Estresse para ${idx}"></button>`
                      : `<span class="pip pip-stress pip-static ${idx <= cs.currentStress ? 'active' : ''}"></span>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <!-- Card de Reparos & Poder de Núcleo -->
          <div class="card sheet-vital-card sheet-vital-compact">
            <div class="vital-card-header">
              <span class="vital-title">${localization.t('sheet.logistics_core', 'LOGÍSTICA & NÚCLEO')}</span>
              <span class="vital-counter">${cs.currentRepairs} / ${totalRepairs} REPAROS</span>
            </div>
            ${
              this.canEdit
                ? `
            <div class="vital-tracker-controls">
              <button type="button" class="btn-vital-step btn-vital-minus" data-vital="repairs" data-delta="-1" title="-1 Reparo de Campo">-1</button>
              <span class="vital-value-display">${cs.currentRepairs} REPAROS</span>
              <button type="button" class="btn-vital-step btn-vital-plus" data-vital="repairs" data-delta="1" title="+1 Reparo de Campo">+1</button>
            </div>
            `
                : ''
            }
            <div class="vital-pips-container">
              <span class="vital-pips-label">${localization.t('sheet.repairs', 'REPAROS DE CAMPO')}:</span>
              <div class="pips-row">
                ${Array.from({ length: Math.min(8, totalRepairs) })
                  .map((_, i) => {
                    const val = i + 1;
                    return this.canEdit
                      ? `<button type="button" class="pip pip-repairs pip-interactive ${val <= cs.currentRepairs ? 'active' : ''}" data-vital-pip="repairs" data-val="${val}" title="Definir Reparos para ${val}"></button>`
                      : `<span class="pip pip-repairs pip-static ${val <= cs.currentRepairs ? 'active' : ''}"></span>`;
                  })
                  .join('')}
              </div>
            </div>
            <div class="vital-pips-container">
              <span class="vital-pips-label">${localization.t('sheet.core_power', 'PODER DE NÚCLEO')}:</span>
              ${
                this.canEdit
                  ? `
                <button type="button" id="btn-toggle-core-power" class="core-power-pip ${cs.corePowerUsed ? 'depleted' : 'active'}" title="Clique para alternar disponibilidade do Poder de Núcleo">
                  <i class="mdi ${cs.corePowerUsed ? 'mdi-checkbox-blank-circle-outline' : 'mdi-checkbox-marked-circle'}"></i>
                  <span>${cs.corePowerUsed ? localization.t('sheet.core_power_used', 'UTILIZADO [0/1]') : localization.t('sheet.core_power_ready', 'DISPONÍVEL [1/1]')}</span>
                </button>
              `
                  : `
                <div class="core-power-pip core-power-static ${cs.corePowerUsed ? 'depleted' : 'active'}">
                  <i class="mdi ${cs.corePowerUsed ? 'mdi-checkbox-blank-circle-outline' : 'mdi-checkbox-marked-circle'}"></i>
                  <span>${cs.corePowerUsed ? localization.t('sheet.core_power_used', 'UTILIZADO [0/1]') : localization.t('sheet.core_power_ready', 'DISPONÍVEL [1/1]')}</span>
                </div>
              `
              }
            </div>
          </div>
        </div>

        <!-- Módulo 2: Matriz Estatística do Chassi (COMP/CON oficial) -->
        <div class="sheet-matrix-grid">
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.size', 'TAMANHO')}</span>
            <span class="matrix-val">${size}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.armor', 'ARMADURA')}</span>
            <span class="matrix-val">${armor}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.speed', 'VELOCIDADE')}</span>
            <span class="matrix-val">${totalSpeed}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.evasion', 'EVASÃO')}</span>
            <span class="matrix-val">${totalEvasion}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.edefense', 'DEFESA-E')}</span>
            <span class="matrix-val">${totalEDefense}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.sensors', 'SENSORES')}</span>
            <span class="matrix-val">${sensors}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.tech_attack', 'ATQ TEC')}</span>
            <span class="matrix-val highlight-mint">${totalTechAttack}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">${localization.t('sheet.save_target', 'SALVAGUARDA')}</span>
            <span class="matrix-val">${totalSaveTarget}</span>
          </div>
        </div>

        <!-- Módulo 3: Traços Distintivos do Chassi (Frame Traits) -->
        ${
          traits.length > 0
            ? `
          <div class="sheet-section-title">
            <span>${localization.t('sheet.traits', 'TRAÇOS DO CHASSI')}</span>
          </div>
          <div class="sheet-traits-grid">
            ${traits
              .map(
                (t) => `
              <div class="card sheet-trait-card">
                <div class="sheet-trait-name">${t.name}</div>
                <div class="sheet-trait-desc">${t.description}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Módulo 4: Sistema de Núcleo (Core System) -->
        ${
          coreSystem
            ? `
          <div class="card sheet-core-system-card">
            <div class="core-header">
              <div class="core-title-group">
                <div>
                  <div class="core-system-tag">// ${localization.t('sheet.core_system', 'SISTEMA DE NÚCLEO DO CHASSI')}</div>
                  <h3 class="core-name">${coreSystem.name}</h3>
                </div>
              </div>
              <span class="core-activation-badge">${localization.t('sheet.core_charge_note', '1 CARGA DE NÚCLEO / MISSÃO')}</span>
            </div>

            <div class="core-content-body">
              ${
                coreSystem.description
                  ? `<p class="core-intro-desc">${coreSystem.description}</p>`
                  : ''
              }
              ${
                coreSystem.passiveName
                  ? `
                <div class="core-trait-block">
                  <strong class="core-trait-title">${localization.t('sheet.passive_trait', 'HABILIDADE PASSIVA')}: ${coreSystem.passiveName}</strong>
                  <div class="core-trait-desc">${coreSystem.passiveEffect}</div>
                </div>
              `
                  : ''
              }
              ${
                coreSystem.activeName
                  ? `
                <div class="core-trait-block">
                  <strong class="core-trait-title core-active-title"><span class="action-tag action-protocol">${localization.t('sheet.active_protocol', 'PROTOCOLO ATIVO')}:</span> ${coreSystem.activeName}</strong>
                  <div class="core-trait-desc">${coreSystem.activeEffect}</div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        `
            : ''
        }

        <!-- Módulo 4b: Bônus de Núcleo Instalados (Core Bonuses) -->
        ${
          coreBonuses.length > 0
            ? `
          <div class="sheet-section-title">
            <i class="mdi mdi-star-shooting-outline"></i>
            <span>${localization.t('sheet.core_bonuses', 'BÔNUS DE NÚCLEO INSTALADOS')}</span>
            <span class="sheet-section-counter">[${coreBonuses.length}]</span>
          </div>
          <div class="sheet-traits-grid">
            ${coreBonuses
              .map((cb: any) => {
                const name = localization.translateItemName(cb.id, cb.name || 'Bônus de Núcleo');
                const effect = localization.translateCoreBonusEffect(cb.id, cb.effect || '');
                const description = localization.translateCoreBonusDescription(cb.id, cb.description || '');
                return `
              <div class="card sheet-trait-card sheet-core-bonus-card">
                <div class="core-bonus-card-header">
                  ${cb.source ? `<span class="sheet-corp-badge">${cb.source}</span>` : ''}
                  <span class="core-bonus-type-tag">${localization.t('sheet.core_bonuses', 'BÔNUS DE NÚCLEO')}</span>
                </div>
                <div class="sheet-trait-name">${name}</div>
                ${
                  effect
                    ? `
                  <div class="core-bonus-effect-box">
                    <div class="core-bonus-effect-label">${localization.t('sheet.effect', 'EFEITO')}:</div>
                    <div class="sheet-trait-desc core-bonus-effect-text">${effect}</div>
                  </div>
                `
                    : ''
                }
                ${
                  description && description !== effect
                    ? `<div class="core-bonus-lore">${description}</div>`
                    : ''
                }
              </div>
            `;
              })
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Módulo 5: Arsenal Mobilizado (Weapon Mounts) -->
        <div class="sheet-section-title">
          ${getCompconIcon('weapon', 'compcon-icon')}
          <span>${localization.t('sheet.weapons', 'ARSENAL MOBILIZADO // ENCAIXES DE ARMAS')}</span>
        </div>

        <div class="sheet-weapons-grid">
          ${
            weapons.length > 0
              ? weapons
                  .map((w, idx) => {
                    const wState = cs.weaponsState[idx] || 'OPERATIONAL';
                    const hasLoadingTag = w.tags?.some(
                      (t) => t.name.toLowerCase().includes('recarga') || t.name.toLowerCase().includes('loading')
                    );
                    const cardStateClass =
                      wState === 'DESTROYED'
                        ? 'mount-card-destroyed'
                        : wState === 'UNLOADED'
                        ? 'mount-card-unloaded'
                        : '';

                    return `
            <div class="card sheet-mount-card ${w.isEmpty ? 'sheet-mount-empty' : ''} ${cardStateClass}">
              <div class="mount-header">
                <span class="mount-tag">${w.mountType}</span>
                ${
                  w.isEmpty
                    ? `<span class="mount-status-empty">${localization.t('sheet.free_mount', 'ENCAIXE LIVRE')}</span>`
                    : this.canEdit
                    ? `
                  <button type="button" class="weapon-status-btn ${
                    wState === 'DESTROYED'
                      ? 'weapon-status-destroyed'
                      : wState === 'UNLOADED'
                      ? 'weapon-status-unloaded'
                      : 'weapon-status-operational'
                  }" data-weapon-idx="${idx}" title="Clique para alternar estado (Operacional / ${hasLoadingTag ? 'Descarregada / ' : ''}Destruída)">
                    <i class="mdi ${
                      wState === 'DESTROYED'
                        ? 'mdi-close-octagon'
                        : wState === 'UNLOADED'
                        ? 'mdi-reload-alert'
                        : 'mdi-check-circle'
                    }"></i>
                    <span>${
                      wState === 'DESTROYED'
                        ? localization.t('sheet.destroyed', 'DESTRUÍDA')
                        : wState === 'UNLOADED'
                        ? localization.t('sheet.unloaded', 'DESCARREGADA')
                        : localization.t('sheet.operational', 'OPERACIONAL')
                    }</span>
                  </button>
                `
                    : `
                  <span class="weapon-status-badge ${
                    wState === 'DESTROYED'
                      ? 'weapon-status-destroyed'
                      : wState === 'UNLOADED'
                      ? 'weapon-status-unloaded'
                      : 'weapon-status-operational'
                  }">
                    <i class="mdi ${
                      wState === 'DESTROYED'
                        ? 'mdi-close-octagon'
                        : wState === 'UNLOADED'
                        ? 'mdi-reload-alert'
                        : 'mdi-check-circle'
                    }"></i>
                    <span>${
                      wState === 'DESTROYED'
                        ? localization.t('sheet.destroyed', 'DESTRUÍDA')
                        : wState === 'UNLOADED'
                        ? localization.t('sheet.unloaded', 'DESCARREGADA')
                        : localization.t('sheet.operational', 'OPERACIONAL')
                    }</span>
                  </span>
                `
                }
              </div>
              <div class="mount-weapon-name">
                ${w.name}
                ${w.modName ? `<span class="weapon-mod-tag">+ ${w.modName}</span>` : ''}
              </div>
              ${
                !w.isEmpty
                  ? `
                <div class="mount-weapon-stats">
                  ${w.range ? `<span class="weapon-stat">${localization.t('sheet.range', 'ALCANCE')}: <strong>${w.range}</strong></span>` : ''}
                  ${w.damage ? `<span class="weapon-stat">${localization.t('sheet.damage', 'DANO')}: <span class="dmg-pill ${w.damageType.toLowerCase().includes('ener') ? 'dmg-energy' : 'dmg-kinetic'}">${w.damage}</span></span>` : ''}
                  ${w.weaponType ? `<span class="weapon-stat">${localization.t('sheet.type', 'TIPO')}: <strong>${w.weaponType}</strong></span>` : ''}
                </div>
                ${
                  w.tags.length > 0
                    ? `
                  <div class="weapon-tags-list">
                    ${w.tags
                      .map(
                        (tag) => `
                      <span class="tag-pill tag-tooltip-container" tabindex="0">
                        <span class="tag-label">${tag.name}</span>
                        <span class="tag-tooltip-box">${tag.description}</span>
                      </span>
                    `
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
                ${
                  wState === 'DESTROYED'
                    ? '<div class="destroyed-notice"><i class="mdi mdi-alert-octagon"></i> SISTEMA DE ARMA DESTRUÍDO // AVARIA EM COMBATE</div>'
                    : wState === 'UNLOADED'
                    ? '<div class="unloaded-notice"><i class="mdi mdi-alert"></i> ARMA DESCARREGADA // REQUER AÇÃO DE RECARGA</div>'
                    : ''
                }
                ${w.description ? `<div class="weapon-detail-desc">${w.description}</div>` : ''}
              `
                  : `<p class="system-desc">${localization.t('sheet.empty_weapons', 'Nenhuma arma instalada neste encaixe.')}</p>`
              }
            </div>
          `;
                  })
                  .join('')
              : `
            <div class="card sheet-mount-card">
              <p class="system-desc">${localization.t('sheet.empty_weapons', 'Nenhum encaixe ou arma configurada para este chassi no banco de dados.')}</p>
            </div>
          `
          }
        </div>

        <!-- Módulo 6: Sistemas Instalados -->
        <div class="sheet-section-title">
          ${getCompconIcon('system', 'compcon-icon')}
          <span>${localization.t('sheet.systems', 'SISTEMAS EMBARCADOS')} // ${localization.t('sheet.sp_points', 'PONTOS DE SISTEMAS')}: ${totalSpUsed} / ${maxSp} SP</span>
        </div>

        <div class="sheet-systems-grid">
          ${
            systems.length > 0
              ? systems
                  .map((s, idx) => {
                    const sysState = cs.systemsState[idx] || 'OPERATIONAL';
                    const isDestroyed = sysState === 'DESTROYED';

                    return `
            <div class="card sheet-system-card ${isDestroyed ? 'system-card-destroyed' : ''}">
              <div class="system-top-line">
                <span class="system-name">${s.name}</span>
                <div class="system-top-actions">
                  <span class="system-sp-cost">${s.sp} SP</span>
                  ${
                    this.canEdit
                      ? `
                    <button type="button" class="system-status-btn ${
                      isDestroyed ? 'system-status-destroyed' : 'system-status-operational'
                    }" data-system-idx="${idx}" title="Clique para alternar estado (Operacional / Destruído)">
                      <i class="mdi ${isDestroyed ? 'mdi-close-octagon' : 'mdi-check-circle'}"></i>
                      <span>${isDestroyed ? localization.t('sheet.destroyed_masc', 'DESTRUÍDO') : localization.t('sheet.operational', 'OPERACIONAL')}</span>
                    </button>
                  `
                      : `
                    <span class="system-status-badge ${
                      isDestroyed ? 'system-status-destroyed' : 'system-status-operational'
                    }">
                      <i class="mdi ${isDestroyed ? 'mdi-close-octagon' : 'mdi-check-circle'}"></i>
                      <span>${isDestroyed ? localization.t('sheet.destroyed_masc', 'DESTRUÍDO') : localization.t('sheet.operational', 'OPERACIONAL')}</span>
                    </span>
                  `
                  }
                </div>
              </div>
              <div class="system-desc">${s.description}</div>
              ${
                isDestroyed
                  ? '<div class="destroyed-notice"><i class="mdi mdi-alert-octagon"></i> SISTEMA AVARIADO // INOPERANTE</div>'
                  : ''
              }
              ${
                s.actions && s.actions.length > 0
                  ? `
                <div class="system-actions-box">
                  ${s.actions
                    .map(
                      (a: any) => `
                    <div class="system-action-row">
                      <span class="action-tag ${localization.getActionClass(a.activation)}">${localization.translateActivation(a.activation)}:</span>
                      <span class="action-detail">${a.detail || a.name || ''}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
            </div>
          `;
                  })
                  .join('')
              : `
            <div class="card sheet-system-card">
              <p class="system-desc">${localization.t('sheet.empty_systems', 'Nenhum sistema opcional instalado neste chassi no banco de dados.')}</p>
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  // Extração de armas utilizando compcon-locales pt_BR
  private extractWeapons(loadout: any): IWeaponParsed[] {
    const results: IWeaponParsed[] = [];
    const mounts = loadout?.mounts;

    if (Array.isArray(mounts)) {
      for (const m of mounts) {
        const rawMountType = m.mount_type || m.type || 'Mount';
        const mountType = localization.translateMountType(rawMountType).toUpperCase();
        const slots = m.slots || [];

        for (const slot of slots) {
          const rawSlotSize = slot.size || rawMountType;
          const slotSize = localization.translateMountType(rawSlotSize);
          const w = slot.weapon;

          if (w && w.data) {
            const data = w.data;
            const weaponId = w.id || data.id;
            const localizedName = localization.translateItemName(weaponId, data.name);
            const localizedDesc = localization.translateItemDesc(weaponId, data.description);

            // Tradução do Mod se houver
            let localizedModName: string | undefined = undefined;
            if (w.mod) {
              const modId = w.mod.id || w.mod.data?.id;
              localizedModName = localization.translateItemName(modId, w.mod.data?.name);
            }

            // Tradução de Dano
            const damageStr = Array.isArray(data.damage)
              ? data.damage
                  .map((d: any) => `${d.val} ${localization.translateDamageType(d.type)}`)
                  .join(' + ')
              : 'N/A';
            const damageType =
              Array.isArray(data.damage) && data.damage[0]
                ? localization.translateDamageType(data.damage[0].type)
                : 'Cinético';

            // Tradução de Alcance
            const rangeStr = Array.isArray(data.range)
              ? data.range
                  .map((r: any) => `${localization.translateRangeType(r.type)} ${r.val}`)
                  .join(', ')
              : '';

            // Tradução das Tags com descrição para o Tooltip
            const tagsList: Array<{ name: string; description: string }> = [];
            if (Array.isArray(data.tags)) {
              for (const t of data.tags) {
                const tagInfo = localization.translateTagInfo(t.id || t, t.val);
                if (tagInfo.label) {
                  tagsList.push({ name: tagInfo.label, description: tagInfo.description });
                }
              }
            }
            if (w.mod?.data?.added_tags) {
              for (const t of w.mod.data.added_tags) {
                const tagInfo = localization.translateTagInfo(t.id || t, t.val);
                if (tagInfo.label) {
                  tagsList.push({ name: tagInfo.label, description: tagInfo.description });
                }
              }
            }

            // Tradução do Tipo de Arma
            const typeMap: Record<string, string> = {
              launcher: 'Lançador',
              rifle: 'Fuzil',
              cqb: 'CQB',
              cannon: 'Canhão',
              melee: 'Corpo a Corpo',
              nexus: 'Nexo'
            };
            const rawType = (data.type || '').toLowerCase();
            const weaponType = typeMap[rawType] || data.type;

            results.push({
              mountType,
              slotSize,
              name: localizedName,
              modName: localizedModName,
              weaponType,
              range: rangeStr,
              damage: damageStr,
              damageType,
              tags: tagsList,
              description: localizedDesc,
              isEmpty: false
            });
          } else {
            results.push({
              mountType,
              slotSize,
              name: 'ENCAIXE LIVRE',
              range: '',
              damage: '',
              damageType: '',
              tags: [],
              isEmpty: true
            });
          }
        }
      }
    }

    return results;
  }

  // Extração de sistemas utilizando compcon-locales pt_BR
  private extractSystems(systemsList: any[]): ISystemParsed[] {
    const results: ISystemParsed[] = [];

    if (Array.isArray(systemsList)) {
      for (const s of systemsList) {
        if (s) {
          const data = s.data || s;
          const sysId = s.id || data.id;
          const sp = Number(data.sp || s.sp || s.cost || 0);
          const translated = localization.translateSystem(sysId, data);

          results.push({
            name: translated.name,
            sp,
            type: data.type,
            description: translated.description,
            actions: translated.actions
          });
        }
      }
    }

    return results;
  }

  // Extração de traços do chassi utilizando compcon-locales pt_BR
  private extractTraits(frameData: any, fallbackFrameId?: string): ITraitParsed[] {
    const results: ITraitParsed[] = [];
    const traits = frameData?.traits;
    const frameId = frameData?.id || fallbackFrameId || '';

    if (Array.isArray(traits)) {
      for (const t of traits) {
        if (t && t.name) {
          const translated = localization.translateTrait(frameId, t);
          results.push({
            name: translated.name,
            description: translated.description
          });
        }
      }
    }

    return results;
  }

  // Extração de Sistema de Núcleo utilizando compcon-locales pt_BR
  private extractCoreSystem(frameData: any, fallbackFrameId?: string): ICoreSystemParsed | null {
    const core = frameData?.core_system;
    if (!core) return null;

    const frameId = frameData?.id || fallbackFrameId || '';
    const translated = localization.translateCoreSystem(frameId, core);

    return {
      name: translated.name,
      description: translated.description,
      passiveName: translated.passiveName,
      passiveEffect: translated.passiveEffect,
      activeName: translated.activeName,
      activeEffect: translated.activeEffect
    };
  }

  private updateCombat(mutator: (state: IMechCombatState) => void) {
    if (!this.canEdit) {
      ToastService.warning('Apenas o proprietário da ficha ou um Administrador possui permissão para modificar o estado de combate.');
      return;
    }
    if (!this.pilotData || !this.combatState) return;
    mutator(this.combatState);
    saveCombatState(this.pilotData._id, this.combatState);
    this.renderContent();
    this.bindEvents();
  }

  private bindEvents() {
    // Resetar listeners anteriores para evitar vazamentos e disparos múltiplos
    this.abortController.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const copyBtn = this.container.querySelector('#btn-copy-sharecode');
    copyBtn?.addEventListener('click', async () => {
      if (this.pilotData?.share_code) {
        await navigator.clipboard.writeText(this.pilotData.share_code);
        ToastService.success(`Código de Compartilhamento "${this.pilotData.share_code}" copiado!`);
      }
    }, { signal });

    

    const aarBtn = this.container.querySelector('#btn-pilot-aar');
    aarBtn?.addEventListener('click', async () => {
      if (this.pilotData) {
        const text = buildMissionReportText(this.pilotData);
        await navigator.clipboard.writeText(text);
        ToastService.success('Relatório de Missão do Mecha copiado para a área de transferência!');
      }
    }, { signal });

    // Se não tiver permissão para editar (não for dono nem admin), não ativa eventos de combate
    if (!this.canEdit) {
      // Eventos de Homologação do Administrador ainda podem rodar se for admin
      this.bindAdminEvents(signal);
      return;
    }

    // Botão de Reparo Completo (Descanso Completo)
    const fullRepairBtn = this.container.querySelector('#btn-full-repair');
    fullRepairBtn?.addEventListener('click', () => {
      if (!this.pilotData) return;
      const confirmReset = window.confirm(
        'Executar REPARO COMPLETO no Chassi?\n\nIsso restaurará todos os Pontos de Vida (PV), Estrutura, Estresse, Reparos de Campo, Carga de Núcleo e reparará todas as Armas e Sistemas avariados.'
      );
      if (confirmReset) {
        this.combatState = resetCombatState(this.pilotData._id, {
          maxHp: this.maxHp,
          maxRepairs: this.maxRepairs
        });
        ToastService.success('Reparo Completo executado: Chassi 100% operacional!');
        this.renderContent();
        this.bindEvents();
      }
    }, { signal });

    // Controles de Incremento / Decremento de Vitais (PV, Calor, Reparos)
    this.container.querySelectorAll<HTMLButtonElement>('.btn-vital-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vital = btn.dataset.vital;
        const delta = Number(btn.dataset.delta) || 0;
        this.updateCombat((st) => {
          if (vital === 'hp') {
            st.currentHp = Math.max(0, Math.min(this.maxHp, st.currentHp + delta));
          } else if (vital === 'heat') {
            const prevHeat = st.currentHeat;
            st.currentHeat = Math.max(0, st.currentHeat + delta);
            if (st.currentHeat >= this.totalHeat && prevHeat < this.totalHeat) {
              ToastService.warning(`Alerta: Reator em Superaquecimento (${st.currentHeat}/${this.totalHeat} Calor)!`);
            }
          } else if (vital === 'repairs') {
            st.currentRepairs = Math.max(0, Math.min(this.maxRepairs, st.currentRepairs + delta));
          }
        });
      }, { signal });
    });

    // Pips Interativos (Estrutura, Estresse, Reparos)
    this.container.querySelectorAll<HTMLButtonElement>('button.pip.pip-interactive').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vital = btn.dataset.vitalPip;
        const val = Number(btn.dataset.val);
        this.updateCombat((st) => {
          if (vital === 'structure') {
            st.currentStructure = st.currentStructure === val ? val - 1 : val;
          } else if (vital === 'stress') {
            st.currentStress = st.currentStress === val ? val - 1 : val;
          } else if (vital === 'repairs') {
            st.currentRepairs = st.currentRepairs === val ? val - 1 : val;
          }
        });
      }, { signal });
    });

    // Alternar Poder de Núcleo
    const corePowerBtn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-core-power');
    corePowerBtn?.addEventListener('click', () => {
      this.updateCombat((st) => {
        st.corePowerUsed = !st.corePowerUsed;
      });
    }, { signal });

    // Alternar Estado de Armas (Operacional / Descarregada / Destruída)
    this.container.querySelectorAll<HTMLButtonElement>('.weapon-status-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.weaponIdx);
        const w = this.weaponsListCached[idx];
        const hasLoading = w?.tags?.some(
          (t) => t.name.toLowerCase().includes('recarga') || t.name.toLowerCase().includes('loading')
        );

        this.updateCombat((st) => {
          const curr = st.weaponsState[idx] || 'OPERATIONAL';
          let next: WeaponCombatState;
          if (hasLoading) {
            // OPERATIONAL -> UNLOADED -> DESTROYED -> OPERATIONAL
            next = curr === 'OPERATIONAL' ? 'UNLOADED' : curr === 'UNLOADED' ? 'DESTROYED' : 'OPERATIONAL';
          } else {
            // OPERATIONAL -> DESTROYED -> OPERATIONAL
            next = curr === 'OPERATIONAL' ? 'DESTROYED' : 'OPERATIONAL';
          }
          st.weaponsState[idx] = next;
        });
      }, { signal });
    });

    // Alternar Estado de Sistemas (Operacional / Destruído)
    this.container.querySelectorAll<HTMLButtonElement>('.system-status-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.systemIdx);
        const sys = this.systemsListCached[idx];
        const sysName = sys?.name || `Sistema #${idx + 1}`;

        this.updateCombat((st) => {
          const curr = st.systemsState[idx] || 'OPERATIONAL';
          const next: SystemCombatState = curr === 'OPERATIONAL' ? 'DESTROYED' : 'OPERATIONAL';
          st.systemsState[idx] = next;
          if (next === 'DESTROYED') {
            ToastService.info(`${sysName} avariado em combate.`);
          }
        });
      }, { signal });
    });

    this.bindAdminEvents(signal);
  }

  private bindAdminEvents(signal: AbortSignal) {

    // Eventos de Homologação do Administrador
    const approveBtn = this.container.querySelector('#btn-admin-approve');
    approveBtn?.addEventListener('click', async () => {
      if (!this.pilotData) return;
      try {
        await pilotService.reviewPilot(this.pilotData._id, 'APPROVED');
        ToastService.success(`Ficha de "${this.pilotData.callsign}" homologada e aprovada com sucesso!`);
        await this.render();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao aprovar ficha.');
      }
    }, { signal });

    const rejectBtn = this.container.querySelector('#btn-admin-reject');
    rejectBtn?.addEventListener('click', async () => {
      if (!this.pilotData) return;
      const reason = prompt(`Informe o motivo da não-conformidade / pendência para o piloto "${this.pilotData.callsign}":`);
      if (reason && reason.trim()) {
        try {
          await pilotService.reviewPilot(this.pilotData._id, 'REJECTED', reason.trim());
          ToastService.info(`Ficha de "${this.pilotData.callsign}" rejeitada com pendência apontada.`);
          await this.render();
        } catch (err: any) {
          ToastService.error(err.message || 'Falha ao rejeitar ficha.');
        }
      }
    }, { signal });
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon-outline"></i>
        </div>
        <h2 class="sheet-error-title">${localization.t('common.error', 'FALHA AO RECUPERAR FICHA DO MECHA')}</h2>
        <p class="sheet-error-msg">${message}</p>
        <a href="#/hangar" class="btn btn-secondary">
          <i class="mdi mdi-arrow-left"></i>
          <span>${localization.t('sheet.return_to_hangar', 'VOLTAR AO HANGAR')}</span>
        </a>
      </div>
    `;
  }
}
