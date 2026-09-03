import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { IPilot } from '../types/pilot.types.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { localization } from '../services/localization.service.js';

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

  constructor(container: HTMLElement, pilotId: string | null = null) {
    this.container = container;
    this.pilotId = pilotId;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">LENDO TELEMETRIA DO BANCO DE DADOS...</div>
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
            <span>RETORNAR AO HANGAR</span>
          </a>
        </div>

        <div class="card sheet-empty-card">
          <div class="sheet-empty-content">
            <div class="sheet-empty-icon">
              ${getCompconIcon('mech', 'compcon-icon-empty')}
            </div>
            <div class="sheet-empty-tag">
              <i class="mdi mdi-alert-circle-outline"></i> NENHUM CHASSI NO BANCO DE DADOS
            </div>
            <h2 class="sheet-empty-title">NENHUM MECHA ENCONTRADO</h2>
            <p class="sheet-empty-desc">
              Não há fichas registradas para seu operador no banco de dados.
              Sincronize sua ficha do COMP/CON no Hangar para carregar o chassi.
            </p>
            <a href="#/hangar" class="btn btn-primary">
              <i class="mdi mdi-download"></i>
              <span>IMPORTAR NO HANGAR</span>
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

    this.container.innerHTML = `
      <div class="sheet-container">
        <!-- Navegação Superior -->
        <div class="sheet-nav-bar">
          <div class="sheet-breadcrumbs">
            <a href="#/hangar" class="sheet-back-link">
              <i class="mdi mdi-arrow-left"></i>
              <span>HANGAR</span>
            </a>
            <span class="sheet-crumb-separator">//</span>
            <span class="sheet-crumb-current">FICHA DO MECHA: ${mechName}</span>
          </div>

          <div class="sheet-top-actions">
            <a href="#/pilot?id=${p._id}" class="btn btn-secondary sheet-action-btn" title="Ver Dossiê do Piloto">
              ${getCompconIcon('pilot', 'compcon-icon')}
              <span>FICHA DO PILOTO</span>
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
            <button id="btn-print-sheet" class="btn btn-secondary sheet-action-btn" title="Imprimir Ficha">
              <i class="mdi mdi-printer"></i>
              <span>IMPRIMIR</span>
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
                    ? 'HOMOLOGADA // APROVADA'
                    : p.status === 'REJECTED'
                    ? 'NÃO-CONFORME // REJEITADA'
                    : 'AGUARDANDO HOMOLOGAÇÃO'
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
                  <span>APROVAR FICHA</span>
                </button>
              `
                  : ''
              }
              ${
                p.status !== 'REJECTED'
                  ? `
                <button type="button" id="btn-admin-reject" class="btn-reject-sheet" title="Apontar pendência e rejeitar ficha">
                  <i class="mdi mdi-close"></i>
                  <span>REJEITAR</span>
                </button>
              `
                  : ''
              }
              <a href="#/review" class="btn btn-secondary" title="Retornar à tela de avaliações">
                <i class="mdi mdi-format-list-checks"></i>
                <span>PAINEL DE AVALIAÇÃO</span>
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
                <span class="sheet-dossier-label">PILOTO RESPONSÁVEL:</span>
                <a href="#/pilot?id=${p._id}" class="sheet-operator-link">
                  <strong class="sheet-dossier-callsign">${p.callsign}</strong>
                </a>
                <span class="sheet-ll-badge">LL ${p.license_level}</span>
                <span class="sheet-grit-badge">BRIO +${p.grit}</span>
                ${p.is_active ? '<span class="sheet-active-tag">[ CHASSI ATIVO ]</span>' : ''}
              </div>

              <!-- Atributos H.A.S.E. / C.A.S.E. Aplicados ao Chassi -->
              <div class="sheet-hase-bar">
                <div class="sheet-hase-item hase-hull">
                  <span class="hase-label">CASCO</span>
                  <span class="hase-val">${hullBonus}</span>
                </div>
                <div class="sheet-hase-item hase-agility">
                  <span class="hase-label">AGILIDADE</span>
                  <span class="hase-val">${agiBonus}</span>
                </div>
                <div class="sheet-hase-item hase-systems">
                  <span class="hase-label">SISTEMAS</span>
                  <span class="hase-val">${sysBonus}</span>
                </div>
                <div class="sheet-hase-item hase-engineering">
                  <span class="hase-label">ENGENHARIA</span>
                  <span class="hase-val">${engBonus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Módulo 1: Gauges de Sobrevivência (Combat Vitals) -->
        <div class="sheet-vitals-grid">
          <div class="card sheet-vital-card">
            <div class="vital-card-header">
              <span class="vital-title">PONTOS DE VIDA (PV)</span>
              <span class="vital-counter">${totalHp} / ${totalHp} PV</span>
            </div>
            <div class="vital-progress-bar">
              <div class="vital-fill vital-fill-hp"></div>
            </div>
            <div class="vital-pips-container">
              <span class="vital-pips-label">ESTRUTURA:</span>
              <div class="pips-row">
                <span class="pip pip-structure active"></span>
                <span class="pip pip-structure active"></span>
                <span class="pip pip-structure active"></span>
                <span class="pip pip-structure active"></span>
              </div>
            </div>
          </div>

          <div class="card sheet-vital-card">
            <div class="vital-card-header">
              <span class="vital-title">CALOR</span>
              <span class="vital-counter">0 / ${totalHeat} CALOR</span>
            </div>
            <div class="vital-progress-bar">
              <div class="vital-fill vital-fill-heat"></div>
            </div>
            <div class="vital-pips-container">
              <span class="vital-pips-label">ESTRESSE DE REATOR:</span>
              <div class="pips-row">
                <span class="pip pip-stress active"></span>
                <span class="pip pip-stress active"></span>
                <span class="pip pip-stress active"></span>
                <span class="pip pip-stress active"></span>
              </div>
            </div>
          </div>

          <div class="card sheet-vital-card sheet-vital-compact">
            <div class="vital-card-header">
              <span class="vital-title">LOGÍSTICA & NÚCLEO</span>
              <span class="vital-counter">${totalRepairs} REPAROS</span>
            </div>
            <div class="vital-pips-container">
              <span class="vital-pips-label">REPAROS DE CAMPO:</span>
              <div class="pips-row">
                ${Array.from({ length: Math.min(8, totalRepairs) })
                  .map(() => `<span class="pip pip-repairs active"></span>`)
                  .join('')}
              </div>
            </div>
            <div class="vital-pips-container">
              <span class="vital-pips-label">PODER DE NÚCLEO:</span>
              <div class="core-power-pip active">
                <span>DISPONÍVEL</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Módulo 2: Matriz Estatística do Chassi (COMP/CON oficial) -->
        <div class="sheet-matrix-grid">
          <div class="matrix-box">
            <span class="matrix-label">TAMANHO</span>
            <span class="matrix-val">${size}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">ARMADURA</span>
            <span class="matrix-val">${armor}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">VELOCIDADE</span>
            <span class="matrix-val">${totalSpeed}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">EVASÃO</span>
            <span class="matrix-val">${totalEvasion}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">DEFESA-E</span>
            <span class="matrix-val">${totalEDefense}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">SENSORES</span>
            <span class="matrix-val">${sensors}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">ATQ TEC</span>
            <span class="matrix-val highlight-mint">${totalTechAttack}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">SALVAGUARDA</span>
            <span class="matrix-val">${totalSaveTarget}</span>
          </div>
        </div>

        <!-- Módulo 3: Traços Distintivos do Chassi (Frame Traits) -->
        ${
          traits.length > 0
            ? `
          <div class="sheet-section-title">
            <span>TRAÇOS DO CHASSI</span>
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
                  <div class="core-system-tag">// SISTEMA DE NÚCLEO DO CHASSI</div>
                  <h3 class="core-name">${coreSystem.name}</h3>
                </div>
              </div>
              <span class="core-activation-badge">1 CARGA DE NÚCLEO / MISSÃO</span>
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
                  <strong class="core-trait-title">HABILIDADE PASSIVA: ${coreSystem.passiveName}</strong>
                  <div class="core-trait-desc">${coreSystem.passiveEffect}</div>
                </div>
              `
                  : ''
              }
              ${
                coreSystem.activeName
                  ? `
                <div class="core-trait-block">
                  <strong class="core-trait-title core-active-title"><span class="action-tag action-protocol">PROTOCOLO ATIVO:</span> ${coreSystem.activeName}</strong>
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

        <!-- Módulo 5: Arsenal Mobilizado (Weapon Mounts) -->
        <div class="sheet-section-title">
          ${getCompconIcon('weapon', 'compcon-icon')}
          <span>ARSENAL MOBILIZADO // ENCAIXES DE ARMAS</span>
        </div>

        <div class="sheet-weapons-grid">
          ${
            weapons.length > 0
              ? weapons
                  .map(
                    (w) => `
            <div class="card sheet-mount-card ${w.isEmpty ? 'sheet-mount-empty' : ''}">
              <div class="mount-header">
                <span class="mount-tag">${w.mountType}</span>
                <span class="${w.isEmpty ? 'mount-status-empty' : 'mount-status-ok'}">
                  ${w.isEmpty ? 'ENCAIXE LIVRE' : 'OPERACIONAL'}
                </span>
              </div>
              <div class="mount-weapon-name">
                ${w.name}
                ${w.modName ? `<span class="weapon-mod-tag">+ ${w.modName}</span>` : ''}
              </div>
              ${
                !w.isEmpty
                  ? `
                <div class="mount-weapon-stats">
                  ${w.range ? `<span class="weapon-stat">ALCANCE: <strong>${w.range}</strong></span>` : ''}
                  ${w.damage ? `<span class="weapon-stat">DANO: <span class="dmg-pill ${w.damageType.toLowerCase().includes('ener') ? 'dmg-energy' : 'dmg-kinetic'}">${w.damage}</span></span>` : ''}
                  ${w.weaponType ? `<span class="weapon-stat">TIPO: <strong>${w.weaponType}</strong></span>` : ''}
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
                ${w.description ? `<div class="weapon-detail-desc">${w.description}</div>` : ''}
              `
                  : '<p class="system-desc">Nenhuma arma instalada neste encaixe.</p>'
              }
            </div>
          `
                  )
                  .join('')
              : `
            <div class="card sheet-mount-card">
              <p class="system-desc">Nenhum encaixe ou arma configurada para este chassi no banco de dados.</p>
            </div>
          `
          }
        </div>

        <!-- Módulo 6: Sistemas Instalados -->
        <div class="sheet-section-title">
          ${getCompconIcon('system', 'compcon-icon')}
          <span>SISTEMAS EMBARCADOS // PONTOS DE SISTEMAS: ${totalSpUsed} / ${maxSp} SP</span>
        </div>

        <div class="sheet-systems-grid">
          ${
            systems.length > 0
              ? systems
                  .map(
                    (s) => `
            <div class="card sheet-system-card">
              <div class="system-top-line">
                <span class="system-name">${s.name}</span>
                <span class="system-sp-cost">${s.sp} SP</span>
              </div>
              <div class="system-desc">${s.description}</div>
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
          `
                  )
                  .join('')
              : `
            <div class="card sheet-system-card">
              <p class="system-desc">Nenhum sistema opcional instalado neste chassi no banco de dados.</p>
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

  private bindEvents() {
    const copyBtn = this.container.querySelector('#btn-copy-sharecode');
    copyBtn?.addEventListener('click', async () => {
      if (this.pilotData?.share_code) {
        await navigator.clipboard.writeText(this.pilotData.share_code);
        ToastService.success(`Código de Compartilhamento "${this.pilotData.share_code}" copiado!`);
      }
    });

    const printBtn = this.container.querySelector('#btn-print-sheet');
    printBtn?.addEventListener('click', () => {
      window.print();
    });

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
    });

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
    });
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon-outline"></i>
        </div>
        <h2 class="sheet-error-title">FALHA AO RECUPERAR FICHA DO MECHA</h2>
        <p class="sheet-error-msg">${message}</p>
        <a href="#/hangar" class="btn btn-secondary">
          <i class="mdi mdi-arrow-left"></i>
          <span>VOLTAR AO HANGAR</span>
        </a>
      </div>
    `;
  }
}
