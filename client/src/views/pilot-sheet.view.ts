import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { IPilot } from '../types/pilot.types.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { localization } from '../services/localization.service.js';

/**
 * Ficha Completa do Piloto / Operador (Pilot Personnel Dossier).
 * Utiliza as traduções oficiais do repositório massif-press/compcon-locales (pt_BR)
 * combinadas com a leitura estrita e dinâmica do banco de dados (MongoDB / COMP/CON).
 */
export class PilotSheetView {
  private container: HTMLElement;
  private pilotId: string | null = null;
  private pilotData: IPilot | null = null;
  private resolvedTalents: any[] = [];

  constructor(container: HTMLElement, pilotId: string | null = null) {
    this.container = container;
    this.pilotId = pilotId;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">CARREGANDO DOSSIÊ DO PILOTO...</div>
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
      this.renderError(err.message || 'Falha ao carregar dossiê do piloto do banco de dados.');
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
        console.warn('[!] Falha ao carregar dossiê por ID via API:', err);
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
              ${getCompconIcon('pilot', 'compcon-icon-empty')}
            </div>
            <div class="sheet-empty-tag">
              <i class="mdi mdi-alert-circle-outline"></i> NENHUM OPERADOR VINCULADO
            </div>
            <h2 class="sheet-empty-title">NENHUM PILOTO NO BANCO DE DADOS</h2>
            <p class="sheet-empty-desc">
              Você ainda não possui um operador registrado no seu terminal.
              Importe sua ficha do COMP/CON no Hangar para carregar seu perfil de piloto.
            </p>
            <a href="#/hangar" class="btn btn-primary">
              <i class="mdi mdi-download"></i>
              <span>IMPORTAR FICHA NO HANGAR</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private renderContent() {
    if (!this.pilotData) return;
    const p = this.pilotData;
    const raw = p.compcon_raw;

    // Dados de Identificação Pessoal
    const callsign = p.callsign || raw?.callsign || 'PILOTO';
    const realName = p.name || raw?.name || raw?.player_name || '';
    const rawBackground = raw?.background || '';
    const background = localization.translateItemName(raw?.background_id, rawBackground);
    const rawHistory = raw?.history || raw?.notes || '';
    const history = rawHistory.replace(/<[^>]*>/g, '').trim();
    const portrait =
      p.portrait ||
      raw?.cloud_portrait ||
      raw?.img?.cloud_portrait ||
      raw?.img?.avatar?.image?.src ||
      '';

    // Regras oficiais de combate humano de piloto em LANCER (COMP/CON oficial)
    const pilotHp = 6 + (p.grit || 0);
    const pilotEvasion = 10;
    const pilotEDefense = 10;
    const pilotSpeed = 4;
    const pilotArmor = 0;

    // Lista de Chassis do Piloto
    const mechsList: any[] = raw?.mechs || p.mechs || [];

    // Core Bonuses (se houver no COMP/CON)
    const coreBonuses: any[] = raw?.core_bonuses || [];

    // Talentos do Piloto (mesclando p.talents com raw.talents para garantir dados de ranks e ações completas)
    const rawTalents: any[] = raw?.talents || [];
    this.resolvedTalents = (p.talents || []).map((pt: any) => {
      const rawMatch = rawTalents.find((rt: any) => rt.id === pt.id) || {};
      return {
        ...pt,
        data: rawMatch.data || pt.data || rawMatch
      };
    });

    this.container.innerHTML = `
      <div class="sheet-container">
        <!-- Navegação Superior / Breadcrumbs -->
        <div class="sheet-nav-bar">
          <div class="sheet-breadcrumbs">
            <a href="#/hangar" class="sheet-back-link">
              <i class="mdi mdi-arrow-left"></i>
              <span>HANGAR</span>
            </a>
            <span class="sheet-crumb-separator">//</span>
            <span class="sheet-crumb-current">DOSSIÊ DO PILOTO: ${callsign}</span>
          </div>

          <div class="sheet-top-actions">
            <a href="#/mech?id=${p._id}" class="btn btn-secondary sheet-action-btn" title="Acessar Ficha do Mecha">
              ${getCompconIcon('mech', 'compcon-icon')}
              <span>FICHA DO MECHA</span>
            </a>
            ${
              p.share_code
                ? `
              <button id="btn-copy-sharecode" class="btn btn-secondary sheet-action-btn" title="Copiar Código de Compartilhamento">
                <i class="mdi mdi-share-variant"></i>
                <span>CÓDIGO: ${p.share_code}</span>
              </button>
            `
                : ''
            }
            <button id="btn-print-sheet" class="btn btn-secondary sheet-action-btn" title="Imprimir Dossiê">
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
                <button type="button" id="btn-admin-approve-pilot" class="btn-approve-sheet" title="Aprovar e homologar ficha">
                  <i class="mdi mdi-check"></i>
                  <span>APROVAR FICHA</span>
                </button>
              `
                  : ''
              }
              ${
                p.status !== 'REJECTED'
                  ? `
                <button type="button" id="btn-admin-reject-pilot" class="btn-reject-sheet" title="Apontar pendência e rejeitar ficha">
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

        <!-- Banner do Piloto / Operador -->
        <div class="card sheet-hero-banner pilot-dossier-hero">
          <div class="sheet-hero-main">
            <!-- Retrato do Piloto -->
            <div class="sheet-portrait-box pilot-avatar-box">
              ${
                portrait
                  ? `<img src="${portrait}" alt="${callsign}" class="sheet-mech-img" />`
                  : `<div class="sheet-img-placeholder">${getCompconIcon('pilot', 'compcon-icon-hero')}</div>`
              }
              <div class="sheet-portrait-frame-tag">
                <i class="mdi mdi-account-badge-outline"></i>
                <span>PILOTO REGISTRADO</span>
              </div>
            </div>

            <!-- Identificação do Piloto -->
            <div class="sheet-identity-details">
              <div class="sheet-corp-badge badge-gms">
                OMNINET // REGISTRO OFICIAL DE PILOTO
              </div>

              <h1 class="sheet-mech-title">${callsign}</h1>
              ${realName ? `<div class="pilot-real-name">NOME CIVIL: ${realName}</div>` : ''}
              ${background ? `<div class="pilot-background-tag">ANTECEDENTE: <strong>${background}</strong></div>` : ''}
              ${history ? `<div class="pilot-background-tag">HISTÓRICO / NOTAS: <strong>${history}</strong></div>` : ''}

              <div class="sheet-pilot-dossier-line">
                <span class="sheet-ll-badge">NÍVEL DE LICENÇA: <strong>LL ${p.license_level}</strong></span>
                <span class="sheet-grit-badge">BRIO: <strong>+${p.grit}</strong></span>
                <span class="sheet-status-pill status-${p.status.toLowerCase().replace('_', '-')}">
                  ${p.status === 'APPROVED' ? 'APROVADO // COMBATE' : p.status === 'REJECTED' ? 'REJEITADO' : 'PENDENTE // AVALIAÇÃO'}
                </span>
              </div>

              <!-- Atributos H.A.S.E. / C.A.S.E. do Piloto -->
              <div class="sheet-hase-bar">
                <div class="sheet-hase-item hase-hull">
                  <span class="hase-label">CASCO</span>
                  <span class="hase-val">${p.hull || 0}</span>
                </div>
                <div class="sheet-hase-item hase-agility">
                  <span class="hase-label">AGILIDADE</span>
                  <span class="hase-val">${p.agility || 0}</span>
                </div>
                <div class="sheet-hase-item hase-systems">
                  <span class="hase-label">SISTEMAS</span>
                  <span class="hase-val">${p.systems || 0}</span>
                </div>
                <div class="sheet-hase-item hase-engineering">
                  <span class="hase-label">ENGENHARIA</span>
                  <span class="hase-val">${p.engineering || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="sheet-section-title">
          <i class="mdi mdi-heart-pulse"></i>
          <span>ESTATÍSTICAS DO PILOTO</span>
        </div>

        <div class="sheet-matrix-grid pilot-vitals-matrix">
          <div class="matrix-box">
            <span class="matrix-label">PV</span>
            <span class="matrix-val highlight-mint">${pilotHp}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">ARMADURA</span>
            <span class="matrix-val">${pilotArmor}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">EVASÃO</span>
            <span class="matrix-val">${pilotEvasion}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">DEFESA-E</span>
            <span class="matrix-val">${pilotEDefense}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">VELOCIDADE</span>
            <span class="matrix-val">${pilotSpeed}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">BRIO</span>
            <span class="matrix-val">+${p.grit}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">MISSÕES</span>
            <span class="matrix-val">${p.total_missions_played || 0}</span>
          </div>
          <div class="matrix-box">
            <span class="matrix-label">ESTADO</span>
            <span class="matrix-val highlight-mint">${p.is_active ? 'ATIVO' : 'RESERVA'}</span>
          </div>
        </div>

        <!-- Seção 2: Chassis Registrados do Piloto -->
        <div class="sheet-section-title">
          ${getCompconIcon('mech', 'compcon-icon')}
          <span>CHASSIS REGISTRADOS NO HANGAR (${mechsList.length})</span>
        </div>

        <div class="pilot-mechs-grid">
          ${
            mechsList.length > 0
              ? mechsList
                  .map((m: any) => {
                    const isMechActive = m.active || m.id === raw?.active_mech_id || (mechsList.length === 1);
                    const mName = m.name || p.active_mech_name || 'Chassi';
                    const rawFrameName = m.frameData?.name || m.frame || p.active_mech_frame || 'Everest';
                    const mFrame = localization.translateItemName(m.frameData?.id, rawFrameName);
                    const mImg = m.cloud_portrait || m.frameData?.image_url || p.active_mech_image || '';

                    return `
              <div class="card pilot-assigned-mech-card ${isMechActive ? 'mech-card-active' : ''}">
                <div class="assigned-mech-layout">
                  <div class="assigned-mech-img-box">
                    ${
                      mImg
                        ? `<img src="${mImg}" alt="${mName}" class="assigned-mech-thumb" />`
                        : `<div class="sheet-img-placeholder">${getCompconIcon('mech', 'compcon-icon')}</div>`
                    }
                  </div>
                  <div class="assigned-mech-info">
                    <div class="mech-frame-tag">
                      ${getCompconIcon('mech', 'compcon-icon-sm')}
                      <span>${mFrame}</span>
                      ${isMechActive ? '<span class="mech-badge-active">ATIVO</span>' : ''}
                    </div>
                    <h3 class="assigned-mech-title">${mName}</h3>
                  </div>
                  <div class="assigned-mech-action">
                    <a href="#/mech?id=${p._id}" class="btn btn-primary">
                      <i class="mdi mdi-card-bulleted-settings-outline"></i>
                      <span>ABRIR FICHA DO MECHA</span>
                    </a>
                  </div>
                </div>
              </div>
            `;
                  })
                  .join('')
              : `
            <div class="card sheet-subcard">
              <p class="system-desc">Nenhum chassi cadastrado para este piloto.</p>
            </div>
          `
          }
        </div>

        <!-- Seção 3: Bônus de Núcleo (Core Bonuses) -->
        ${
          coreBonuses.length > 0
            ? `
          <div class="sheet-section-title">
            <i class="mdi mdi-star-shooting-outline"></i>
            <span>BÔNUS DE NÚCLEO</span>
          </div>
          <div class="sheet-traits-grid">
            ${coreBonuses
              .map(
                (cb: any) => `
              <div class="card sheet-trait-card">
                <div class="sheet-trait-name">${localization.translateItemName(cb.id, cb.name || 'Bônus de Núcleo')}</div>
                <div class="sheet-trait-desc">${localization.translateItemDesc(cb.id, cb.description || cb.effect || '')}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Seção 4: Talentos, Gatilhos e Licenças -->
        <div class="sheet-pilot-view-grid">
          <!-- Talentos do Piloto -->
          <div class="card sheet-subcard">
            <h3 class="sheet-subcard-title">
              ${getCompconIcon('pilot', 'compcon-icon')}
              <span>TALENTOS DE PILOTO</span>
            </h3>
            <div class="sheet-talents-list">
              ${
                this.resolvedTalents && this.resolvedTalents.length > 0
                  ? this.resolvedTalents
                      .map((t, idx) => {
                        const translated = localization.translateTalent(t.id, t.data, t.rank);
                        return `
                    <button type="button"
                            class="sheet-talent-item talent-btn-trigger"
                            data-talent-index="${idx}"
                            title="Clique para ver a descrição completa do talento ${translated.name}">
                      <div class="talent-title-line">
                        <div class="talent-name-group">
                          <i class="mdi mdi-star-shooting-outline talent-lead-icon"></i>
                          <strong class="talent-name">${translated.name}</strong>
                        </div>
                        <div class="talent-badge-group">
                          <span class="talent-rank-badge">RANK ${t.rank}</span>
                          <i class="mdi mdi-eye-outline talent-inspect-icon"></i>
                        </div>
                      </div>
                      ${translated.terse ? `<div class="talent-terse-desc">${translated.terse}</div>` : ''}
                    </button>
                  `;
                      })
                      .join('')
                  : '<p class="system-desc">Nenhum talento registrado nesta ficha no banco de dados.</p>'
              }
            </div>
          </div>

          <!-- Gatilhos de Perícia Narrativa -->
          <div class="card sheet-subcard">
            <h3 class="sheet-subcard-title">
              <i class="mdi mdi-target-account"></i>
              <span>GATILHOS DE PILOTO</span>
            </h3>
            <div class="sheet-skills-list">
              ${
                p.skills && p.skills.length > 0
                  ? p.skills
                      .map(
                        (s) => `
                    <div class="sheet-skill-item">
                      <span class="skill-name">${localization.translateItemName(s.id, s.name)}</span>
                      <strong class="skill-bonus">+${s.bonus || 2}</strong>
                    </div>
                  `
                      )
                      .join('')
                  : '<p class="system-desc">Nenhum gatilho registrado nesta ficha no banco de dados.</p>'
              }
            </div>
          </div>

          <!-- Licenças de Fabricantes -->
          <div class="card sheet-subcard">
            <h3 class="sheet-subcard-title">
              <i class="mdi mdi-certificate-outline"></i>
              <span>LICENÇAS</span>
            </h3>
            <div class="sheet-licenses-list">
              ${
                p.licenses && p.licenses.length > 0
                  ? p.licenses
                      .map(
                        (l) => `
                    <div class="sheet-license-item">
                      <span class="license-name">${localization.translateItemName(l.id, l.id)}</span>
                      <span class="license-rank">NÍVEL ${l.rank}</span>
                    </div>
                  `
                      )
                      .join('')
                  : '<p class="system-desc">Nenhuma licença de fabricante registrada nesta ficha no banco de dados.</p>'
              }
            </div>
          </div>
        </div>

        <!-- Modal Popup de Descrição do Talento -->
        <div id="talent-modal" class="talent-modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="talent-modal-title">
          <div class="talent-modal-box">
            <div class="talent-modal-header">
              <div class="talent-modal-title-group">
                <i class="mdi mdi-star-shooting-outline talent-modal-icon"></i>
                <div>
                  <div class="talent-modal-tag">// DOSSIÊ DE TALENTO // COMP/CON</div>
                  <h3 id="talent-modal-title" class="talent-modal-name">NOME DO TALENTO</h3>
                </div>
              </div>
              <button id="btn-close-talent-modal" class="talent-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <div class="talent-modal-body">
              <div class="talent-modal-subline">
                <span id="talent-modal-rank-badge" class="talent-rank-badge-status badge-unlocked">
                  <i class="mdi mdi-lock-open-variant-outline"></i>
                  <span>RANK 3 ATIVO</span>
                </span>
                <span id="talent-modal-terse" class="talent-modal-terse-text"></span>
              </div>

              <div id="talent-modal-lore-box" class="talent-modal-lore-box">
                <p id="talent-modal-desc" class="talent-modal-lore-text"></p>
              </div>

              <div id="talent-modal-ranks-list" class="talent-modal-ranks-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;
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
    const approveBtn = this.container.querySelector('#btn-admin-approve-pilot');
    approveBtn?.addEventListener('click', async () => {
      if (!this.pilotData) return;
      try {
        await pilotService.reviewPilot(this.pilotData._id, 'APPROVED');
        ToastService.success(`Dossiê de "${this.pilotData.callsign}" homologado e aprovado com sucesso!`);
        await this.render();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao aprovar ficha.');
      }
    });

    const rejectBtn = this.container.querySelector('#btn-admin-reject-pilot');
    rejectBtn?.addEventListener('click', async () => {
      if (!this.pilotData) return;
      const reason = prompt(`Informe o motivo da não-conformidade / pendência para o piloto "${this.pilotData.callsign}":`);
      if (reason && reason.trim()) {
        try {
          await pilotService.reviewPilot(this.pilotData._id, 'REJECTED', reason.trim());
          ToastService.info(`Dossiê de "${this.pilotData.callsign}" rejeitado com pendência apontada.`);
          await this.render();
        } catch (err: any) {
          ToastService.error(err.message || 'Falha ao rejeitar ficha.');
        }
      }
    });

    // Triggers do Modal de Talento
    const talentBtns = this.container.querySelectorAll('.talent-btn-trigger');
    talentBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = Number(target.getAttribute('data-talent-index'));
        const talent = this.resolvedTalents[idx] || this.pilotData?.talents?.[idx];
        if (talent) {
          this.openTalentModal(talent);
        }
      });
    });

    const closeTalentBtn = this.container.querySelector('#btn-close-talent-modal');
    closeTalentBtn?.addEventListener('click', () => this.closeTalentModal());

    const talentModalOverlay = this.container.querySelector('#talent-modal');
    talentModalOverlay?.addEventListener('click', (e) => {
      if (e.target === talentModalOverlay) {
        this.closeTalentModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTalentModal();
      }
    });
  }

  private openTalentModal(t: any) {
    const modal = this.container.querySelector('#talent-modal');
    if (!modal) return;

    const translated = localization.translateTalent(t.id, t.data, t.rank);

    const titleEl = modal.querySelector('#talent-modal-title');
    const rankBadgeEl = modal.querySelector('#talent-modal-rank-badge');
    const terseEl = modal.querySelector('#talent-modal-terse');
    const descEl = modal.querySelector('#talent-modal-desc');
    const loreBox = modal.querySelector('#talent-modal-lore-box');
    const ranksListEl = modal.querySelector('#talent-modal-ranks-list');

    if (titleEl) titleEl.textContent = translated.name;
    if (rankBadgeEl) rankBadgeEl.innerHTML = `<i class="mdi mdi-lock-open-variant-outline"></i> <span>RANK ${t.rank} ATIVO</span>`;
    if (terseEl) terseEl.textContent = translated.terse;

    if (descEl && loreBox) {
      if (translated.description) {
        descEl.innerHTML = translated.description;
        loreBox.classList.remove('hidden');
      } else {
        loreBox.classList.add('hidden');
      }
    }

    if (ranksListEl) {
      ranksListEl.innerHTML = translated.ranks
        .map(
          (r: any) => `
        <div class="talent-rank-card ${r.isActive ? 'rank-active' : 'rank-locked'}">
          <div class="talent-rank-header">
            <strong class="talent-rank-card-title">RANQUE ${r.rankLevel}: ${r.name}</strong>
            <span class="talent-rank-badge-status ${r.isActive ? 'badge-unlocked' : 'badge-locked'}" title="${r.isActive ? 'Ranque Desbloqueado' : 'Ranque Bloqueado'}">
              <i class="mdi ${r.isActive ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline'}"></i>
            </span>
          </div>
          <div class="talent-rank-desc">${r.description || 'Nenhuma descrição adicional.'}</div>
          ${
            r.actions && r.actions.length > 0
              ? `
            <div class="talent-rank-actions-box">
              ${r.actions
                .map(
                  (act: any) => `
                <div class="talent-rank-action-item">
                  <div class="talent-action-header">
                    <span class="action-tag talent-action-type ${localization.getActionClass(act.activation)}">[${act.activation}]</span>
                    <strong class="talent-action-title">${act.name}</strong>
                  </div>
                  ${act.trigger ? `<div class="talent-action-trigger"><strong>GATILHO:</strong> ${act.trigger}</div>` : ''}
                  <div class="talent-action-detail">${act.detail}</div>
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
        .join('');
    }

    modal.classList.remove('hidden');
  }

  private closeTalentModal() {
    const modal = this.container.querySelector('#talent-modal');
    modal?.classList.add('hidden');
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon-outline"></i>
        </div>
        <h2 class="sheet-error-title">FALHA AO RECUPERAR DOSSIÊ DO PILOTO</h2>
        <p class="sheet-error-msg">${message}</p>
        <a href="#/hangar" class="btn btn-secondary">
          <i class="mdi mdi-arrow-left"></i>
          <span>VOLTAR AO HANGAR</span>
        </a>
      </div>
    `;
  }
}
