import { missionService, IMissionFilters } from '../services/mission.service.js';
import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { IMission } from '../types/mission.types.js';
import { IPilot } from '../types/pilot.types.js';
import { buildMissionReportText } from '../services/mission-report.helper.js';
import { chatService } from '../services/chat.service.js';
import { IChatMessage } from '../types/chat.types.js';

export class MissionsView {
  private container: HTMLElement;
  private missions: IMission[] = [];
  private activePilot: IPilot | null = null;
  private currentFilters: IMissionFilters = { status: 'ALL', search: '' };
  private editingMissionId: string | null = null;
  private abortController: AbortController = new AbortController();
  private activeAarMission: IMission | null = null;
  private activeChatMissionId: string | null = null;
  private chatUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">CARREGANDO QUADRO DE OPERAÇÕES OMNINET...</div>
      </div>
    `;

    try {
      await this.loadInitialData();
      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      this.renderError(err.message || 'Falha ao carregar quadro de operações.');
    }
  }

  private async loadInitialData() {
    // 1. Carrega piloto do usuário (se houver)
    try {
      const res = await pilotService.getMyPilots();
      this.activePilot =
        res.active_pilot ||
        res.pilots.find((p: IPilot) => p.is_active && p.status === 'APPROVED') ||
        res.pilots[0] ||
        null;
    } catch {
      this.activePilot = null;
    }

    // 2. Carrega lista de missões
    await this.fetchMissions();
  }

  private async fetchMissions() {
    const res = await missionService.getMissions(this.currentFilters);
    this.missions = res.missions || [];
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return 'A Definir';
    const clean = dateStr.trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return clean;
  }

  private renderDifficultyStars(diff: number | string): string {
    const stars = Math.max(1, Math.min(3, Number(diff) || 1));

    const starIcons = Array.from({ length: 3 }, (_, i) => {
      const filled = i < stars;
      return `<i class="mdi ${filled ? 'mdi-star difficulty-star-filled' : 'mdi-star-outline difficulty-star-empty'}"></i>`;
    }).join('');

    return `
      <span class="difficulty-stars-container" title="Dificuldade: ${stars} de 3 estrelas" aria-label="${stars} de 3 estrelas">
        ${starIcons}
      </span>
    `;
  }

  private renderContent() {
    const user = authService.currentUser;
    const isGmOrAdmin = user?.role === 'GM' || user?.role === 'ADMIN';

    this.container.innerHTML = `
      <div class="missions-container">
        <!-- Header da Tela de Operações -->
        <div class="missions-header-bar">
          <div class="missions-title-group">
            <div class="missions-header-icon">
              ${getCompconIcon('missions', 'compcon-icon-lg')}
            </div>
            <div>
              <div class="missions-tagline">// QUADRO DE MISSÕES TÁTICAS</div>
              <h1 class="missions-main-title">OPERAÇÕES DA GUILDA</h1>
            </div>
          </div>

          <div class="missions-top-actions">
            ${
              isGmOrAdmin
                ? `
              <button id="btn-open-create-mission" class="btn btn-primary" type="button">
                <i class="mdi mdi-plus-box"></i>
                <span>NOVA OPERAÇÃO</span>
              </button>
            `
                : ''
            }
            <a href="#/hangar" class="btn btn-secondary" title="Voltar ao Hangar">
              ${getCompconIcon('hangar', 'compcon-icon')}
              <span>HANGAR</span>
            </a>
          </div>
        </div>

        <!-- Toolbar de Filtros -->
        <div class="missions-filter-toolbar">
          <div class="filter-status-group">
            <button type="button" class="filter-btn ${this.currentFilters.status === 'ALL' ? 'active' : ''}" data-status="ALL">
              TODAS
            </button>
            <button type="button" class="filter-btn ${this.currentFilters.status === 'OPEN' ? 'active' : ''}" data-status="OPEN">
              ABERTAS
            </button>
            <button type="button" class="filter-btn ${this.currentFilters.status === 'IN_PROGRESS' ? 'active' : ''}" data-status="IN_PROGRESS">
              EM CURSO
            </button>
            <button type="button" class="filter-btn ${this.currentFilters.status === 'COMPLETED' ? 'active' : ''}" data-status="COMPLETED">
              CONCLUÍDAS
            </button>
          </div>

          <div class="filter-controls-group">
            <div class="filter-search-box">
              <i class="mdi mdi-magnify filter-search-icon"></i>
              <input type="text"
                     id="input-search-missions"
                     class="filter-search-input"
                     placeholder="Buscar operação, contratante..."
                     value="${this.currentFilters.search || ''}" />
            </div>
          </div>
        </div>

        <!-- Grid de Missões -->
        <div id="missions-grid-container">
          ${this.renderMissionsGrid()}
        </div>

        <!-- Modal de Detalhes da Missão -->
        <div id="mission-modal" class="mission-modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="mission-modal-box">
            <div class="mission-modal-header">
              <div class="mission-modal-title-group">
                <i class="mdi mdi-crosshairs-gps mission-modal-icon"></i>
                <div>
                  <div class="mission-modal-tag" id="modal-mission-tag">// BRIEFING OPERACIONAL // CONFIDENCIAL</div>
                  <div class="mission-title-row">
                    <h3 id="modal-mission-title" class="mission-modal-name">TÍTULO DA OPERAÇÃO</h3>
                    <div id="modal-mission-date-badge" class="mission-date-badge"></div>
                  </div>
                </div>
              </div>
              <button id="btn-close-mission-modal" class="mission-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <div class="mission-modal-body" id="modal-mission-body">
              <!-- Conteúdo injetado dinamicamente -->
            </div>
          </div>
        </div>

        <!-- Modal de Criação de Missão (GM / ADMIN) -->
        ${isGmOrAdmin ? this.renderCreateMissionModal() : ''}

        <!-- Modal de Relatório de Missão / AAR -->
        ${this.renderAarModal()}

        <!-- Modal Tático de Chat Pré-Missão -->
        ${this.renderPreMissionChatModal()}
      </div>
    `;
  }

  private renderMissionsGrid(): string {
    if (this.missions.length === 0) {
      return `
        <div class="missions-empty-container">
          <div class="missions-empty-icon">
            <i class="mdi mdi-radar"></i>
          </div>
          <h3 class="missions-empty-title">NENHUMA OPERAÇÃO ENCONTRADA</h3>
          <p class="missions-empty-desc">
            Nenhum contrato ativo corresponde aos filtros selecionados. Aguarde novas transmissões da Omninet.
          </p>
        </div>
      `;
    }

    return `
      <div class="missions-grid">
        ${this.missions.map((m) => this.renderMissionCard(m)).join('')}
      </div>
    `;
  }

  private renderMissionCard(m: IMission): string {
    const statusClass = `status-${(m.status || 'OPEN').toLowerCase().replace('_', '-')}`;
    const statusLabel =
      m.status === 'OPEN'
        ? 'INSCRIÇÕES ABERTAS'
        : m.status === 'IN_PROGRESS'
        ? 'EM ANDAMENTO'
        : m.status === 'COMPLETED'
        ? 'CONCLUÍDA'
        : 'CANCELADA';

    const user = authService.currentUser;
    const isOwnerGm = !!(
      user && m.gm_id && (
        (typeof m.gm_id === 'object' && String((m.gm_id as any)._id) === String(user._id)) ||
        String(m.gm_id) === String(user._id)
      )
    );
    const canManageMission = isOwnerGm || user?.role === 'ADMIN';

    const pilotApp = this.activePilot
      ? (m.applications || []).find((a: any) => {
          const appPilotId = typeof a.pilot_id === 'object' ? a.pilot_id?._id : a.pilot_id;
          return String(appPilotId) === String(this.activePilot?._id);
        })
      : null;

    const acceptedCount = (m.applications || []).filter((a: any) => a.status === 'SELECTED').length;
    const totalApplicants = (m.applications || []).length;

    return `
      <div class="mission-card ${statusClass}">
        <div class="mission-card-header">
          <span class="mission-contractor-tag">
            <i class="mdi mdi-office-building"></i>
            <span>${m.contractor || 'Union / GMS'}</span>
          </span>
          <span class="mission-status-pill status-${m.status.toLowerCase()}">
            ${statusLabel}
          </span>
        </div>

        <div class="mission-card-body">
          <div class="mission-title-row">
            <h3 class="mission-title">${m.title}</h3>
            <div class="mission-date-badge" title="Data e Horário da Operação">
              <i class="mdi mdi-calendar-clock"></i>
              <span>${this.formatDate(m.start_date)} às ${m.start_time} BRT</span>
            </div>
          </div>

          <div class="mission-telemetry-strip">
            <div class="telemetry-cell">
              <span class="telemetry-label">NÍVEL LICENÇA</span>
              <span class="telemetry-val highlight-ll">LL ${m.min_ll} - ${m.max_ll}</span>
            </div>
            <div class="telemetry-cell">
              <span class="telemetry-label">DIFICULDADE</span>
              <span class="telemetry-val highlight-diff">${this.renderDifficultyStars(m.difficulty)}</span>
            </div>
            <div class="telemetry-cell">
              <span class="telemetry-label">ESQUADRÃO</span>
              <span class="telemetry-val">${acceptedCount} / ${m.slots_total} (${totalApplicants} cand.)</span>
            </div>
          </div>

          <p class="mission-briefing-excerpt">${m.briefing}</p>

          <div class="mission-logistics-line">
            <span class="logistics-item" title="Plataforma">
              <i class="mdi mdi-monitor-dashboard"></i>
              <span>${m.platform || 'Foundry VTT'}</span>
            </span>
            <span class="logistics-item" title="Canal de Voz">
              <i class="mdi mdi-microphone"></i>
              <span>${m.voice_channel || '#operacoes'}</span>
            </span>
          </div>

          ${
            pilotApp
              ? `
            <div class="mission-app-status-bar">
              <span class="mission-app-badge ${
                pilotApp.status === 'SELECTED'
                  ? 'app-selected'
                  : pilotApp.status === 'WAITLIST'
                  ? 'app-waitlist'
                  : 'app-pending'
              }">
                <i class="mdi ${
                  pilotApp.status === 'SELECTED'
                    ? 'mdi-check-decagram'
                    : pilotApp.status === 'WAITLIST'
                    ? 'mdi-clock-outline'
                    : 'mdi-file-document-edit-outline'
                }"></i>
                <span>${
                  pilotApp.status === 'SELECTED'
                    ? 'ESQUADRÃO ESCALADO'
                    : pilotApp.status === 'WAITLIST'
                    ? 'LISTA DE ESPERA'
                    : 'CANDIDATURA SUBMETIDA'
                }</span>
              </span>
            </div>
          `
              : ''
          }
        </div>

        <div class="mission-card-footer">
          <div class="mission-gm-badge" title="Mestre da Operação">
            <i class="mdi mdi-crown mission-gm-icon"></i>
            <span>GM: <strong>${m.gm_id?.name || m.gm_id?.username || 'Mestre da Guilda'}</strong></span>
          </div>

          <div class="mission-card-actions">
            ${
              canManageMission
                ? `
              <button type="button"
                      class="btn btn-secondary btn-edit-mission"
                      data-mission-id="${m._id}"
                      title="Editar parâmetros desta operação">
                <i class="mdi mdi-pencil-outline"></i>
                <span>EDITAR</span>
              </button>
            `
                : m.status === 'OPEN'
                ? pilotApp
                  ? `
                <button type="button"
                        class="btn btn-secondary btn-cancel-app"
                        data-mission-id="${m._id}"
                        title="Cancelar sua inscrição nesta missão">
                  <i class="mdi mdi-close-circle-outline"></i>
                  <span>CANCELAR</span>
                </button>
              `
                  : `
                <button type="button"
                        class="btn btn-primary btn-apply-mission"
                        data-mission-id="${m._id}"
                        title="Candidatar seu piloto ativo nesta missão">
                  <i class="mdi mdi-target-account"></i>
                  <span>CANDIDATAR</span>
                </button>
              `
                : ''
            }
            <button type="button"
                    class="btn-mission-chat"
                    data-mission-id="${m._id}"
                    title="Abrir canal pré-missão para conversar e alinhar com o GM e pilotos">
              <i class="mdi mdi-chat-processing-outline"></i>
              <span>CHAT PRÉ-MISSÃO</span>
            </button>
            <button type="button"
                    class="btn btn-secondary btn-view-mission"
                    data-mission-id="${m._id}"
                    title="Ver briefing completo e esquadrão">
              <i class="mdi mdi-eye-outline"></i>
              <span>DETALHES</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderCreateMissionModal(): string {
    return `
      <div id="create-mission-modal" class="mission-modal-overlay hidden" role="dialog" aria-modal="true">
        <div class="mission-modal-box">
          <div class="mission-modal-header">
            <div class="mission-modal-title-group">
              <i class="mdi mdi-plus-box-multiple mission-modal-icon"></i>
              <div>
                <div id="create-modal-tag" class="mission-modal-tag">// TERMINAL DO MESTRE // NOVO CONTRATO</div>
                <h3 id="create-modal-name" class="mission-modal-name">CRIAR NOVA OPERAÇÃO TÁTICA</h3>
              </div>
            </div>
            <button id="btn-close-create-modal" class="mission-modal-close" type="button" aria-label="Fechar">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <form id="create-mission-form" class="mission-modal-body create-mission-form">
            <div class="form-group">
              <label class="form-label" for="mission-title-input">TÍTULO DA OPERAÇÃO *</label>
              <input type="text" id="mission-title-input" class="form-input" required placeholder="Ex: OPERAÇÃO TEMPESTADE DE AREIA // SEGUNDO ANEL" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="mission-contractor-input">CONTRATANTE / FACÇÃO *</label>
                <input type="text" id="mission-contractor-input" class="form-input" required placeholder="Ex:IPS-N, HORUS..." value="Union / GMS" />
              </div>

              <div class="form-group">
                <label class="form-label" for="mission-difficulty-input">DIFICULDADE (1 A 3 ESTRELAS) *</label>
                <select id="mission-difficulty-input" class="form-select">
                  <option value="1">★☆☆ (1 Estrela)</option>
                  <option value="2">★★☆ (2 Estrelas)</option>
                  <option value="3">★★★ (3 Estrelas)</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="mission-min-ll-input">LN MÍNIMO</label>
                <input type="number" id="mission-min-ll-input" class="form-input" min="0" max="12" value="0" />
              </div>

              <div class="form-group">
                <label class="form-label" for="mission-max-ll-input">LN MÁXIMO</label>
                <input type="number" id="mission-max-ll-input" class="form-input" min="0" max="12" value="3" />
              </div>

              <div class="form-group">
                <label class="form-label" for="mission-slots-input">VAGAS DO ESQUADRÃO</label>
                <input type="number" id="mission-slots-input" class="form-input" min="1" max="12" value="4" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="mission-start-date-input">DATA DE INÍCIO *</label>
                <input type="date" id="mission-start-date-input" class="form-input" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="mission-start-time-input">HORÁRIO</label>
                <input type="time" id="mission-start-time-input" class="form-input" required value="19:30" />
              </div>

              <div class="form-group">
                <label class="form-label" for="mission-platform-input">PLATAFORMA VTT</label>
                <input type="text" id="mission-platform-input" class="form-input" value="Foundry VTT" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="mission-voice-input">CANAL DE ÁUDIO / DISCORD</label>
              <input type="text" id="mission-voice-input" class="form-input" value="#op-bravo-01" />
            </div>

            <div class="form-group">
              <label class="form-label" for="mission-briefing-input">BRIEFING DA MISSÃO (HISTÓRIA E OBJETIVOS) *</label>
              <textarea id="mission-briefing-input" class="form-textarea" required placeholder="Descreva a situação tática, localização, forças inimigas esperadas e objetivos primários/secundários..."></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="mission-rules-input">REGRAS ESPECIAIS / CONDIÇÕES DE AMBIENTE</label>
              <input type="text" id="mission-rules-input" class="form-input" placeholder="Ex: Gravidade Zero, Tempestade de Areia, Situações de Furtividade..." />
            </div>

            <div class="form-actions-row">
              <button id="btn-cancel-create" type="button" class="btn btn-secondary">CANCELAR</button>
              <button type="submit" class="btn btn-primary">
                <i class="mdi mdi-check"></i>
                <span id="create-modal-submit-text">PUBLICAR OPERAÇÃO</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderAarModal(): string {
    return `
      <div id="aar-modal" class="mission-modal-overlay hidden" role="dialog" aria-modal="true">
        <div class="mission-modal-box aar-modal-box">
          <div class="mission-modal-header">
            <div class="mission-modal-title-group">
              <i class="mdi mdi-clipboard-text-clock-outline mission-modal-icon"></i>
              <div>
                <div id="aar-modal-tag" class="mission-modal-tag">// TERMINAL OMNINET // RELATÓRIO PÓS-AÇÃO</div>
                <h3 id="aar-modal-title" class="mission-modal-name">RELATÓRIO DE MISSÃO (AAR)</h3>
              </div>
            </div>
            <button id="btn-close-aar-modal" class="mission-modal-close" type="button" aria-label="Fechar">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <div class="mission-modal-body" id="aar-modal-body">
            <div class="aar-template-selector-bar">
              <label class="aar-selector-label" for="select-aar-pilot">PILOTO / MODELO:</label>
              <select id="select-aar-pilot" class="form-select aar-select">
                <option value="GENERIC">Modelo Padrão em Branco</option>
              </select>
              <button type="button" id="btn-load-aar-template" class="btn btn-secondary" title="Carregar modelo do piloto selecionado">
                <i class="mdi mdi-refresh"></i>
                <span>CARREGAR</span>
              </button>
            </div>

            <div class="form-group">
              <textarea id="aar-text-content" class="form-textarea aar-textarea" placeholder="Relatório de Missão..."></textarea>
            </div>

            <div class="aar-actions-row">
              <div class="aar-actions-left">
                <button type="button" id="btn-copy-aar-text" class="btn btn-secondary">
                  <i class="mdi mdi-content-copy"></i>
                  <span>COPIAR TEXTO</span>
                </button>
                <button type="button" id="btn-reset-aar-template" class="btn btn-secondary">
                  <i class="mdi mdi-restore"></i>
                  <span>RESTAURAR</span>
                </button>
              </div>
              <div class="aar-actions-right">
                <button type="button" id="btn-cancel-aar" class="btn btn-secondary">FECHAR</button>
                <button type="button" id="btn-submit-aar-complete" class="btn btn-primary hidden">
                  <i class="mdi mdi-check-all"></i>
                  <span>CONCLUIR E ARQUIVAR MISSÃO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    this.abortController.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // 1. Filtros de Status
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const status = target.getAttribute('data-status') || 'ALL';
        this.currentFilters.status = status;

        filterBtns.forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        await this.refreshGrid();
      }, { signal });
    });

    // 2. Busca por Texto
    const searchInput = this.container.querySelector('#input-search-missions') as HTMLInputElement;
    let debounceTimeout: any = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        this.currentFilters.search = searchInput.value.trim();
        await this.refreshGrid();
      }, 350);
    }, { signal });

    // 3. Clique unificado para ações nos Cards do Grid
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      const applyBtn = target.closest('.btn-apply-mission') as HTMLElement;
      if (applyBtn) {
        const missionId = applyBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.handleApply(missionId);
        }
        return;
      }

      const cancelBtn = target.closest('.btn-cancel-app') as HTMLElement;
      if (cancelBtn) {
        const missionId = cancelBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.handleCancelApplication(missionId);
        }
        return;
      }

      const viewBtn = target.closest('.btn-view-mission') as HTMLElement;
      if (viewBtn) {
        const missionId = viewBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.openMissionDetailModal(missionId);
        }
        return;
      }

      const editBtn = target.closest('.btn-edit-mission') as HTMLElement;
      if (editBtn) {
        const missionId = editBtn.getAttribute('data-mission-id');
        const mission = this.missions.find((m) => m._id === missionId);
        if (mission) {
          this.openEditMissionModal(mission);
        }
        return;
      }

      const chatBtn = target.closest('.btn-mission-chat') as HTMLElement;
      if (chatBtn) {
        const missionId = chatBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.openPreMissionChat(missionId);
        }
        return;
      }
    }, { signal });

    // 4. Fechamento do Modal de Detalhes
    const closeDetailBtn = this.container.querySelector('#btn-close-mission-modal');
    closeDetailBtn?.addEventListener('click', () => this.closeMissionDetailModal(), { signal });

    const detailOverlay = this.container.querySelector('#mission-modal');
    detailOverlay?.addEventListener('click', (e) => {
      if (e.target === detailOverlay) this.closeMissionDetailModal();
    }, { signal });

    // 5. Abertura do Modal de Criação (GM / ADMIN)
    const openCreateBtn = this.container.querySelector('#btn-open-create-mission');
    openCreateBtn?.addEventListener('click', () => {
      this.openCreateModal();
    }, { signal });

    // 6. Fechamento do Modal de Criação
    const closeCreateBtn = this.container.querySelector('#btn-close-create-modal');
    closeCreateBtn?.addEventListener('click', () => this.closeCreateModal(), { signal });

    const cancelCreateBtn = this.container.querySelector('#btn-cancel-create');
    cancelCreateBtn?.addEventListener('click', () => this.closeCreateModal(), { signal });

    const createOverlay = this.container.querySelector('#create-mission-modal');
    createOverlay?.addEventListener('click', (e) => {
      if (e.target === createOverlay) this.closeCreateModal();
    }, { signal });

    // 7. Submissão do Formulário de Criação
    const createForm = this.container.querySelector('#create-mission-form') as HTMLFormElement;
    createForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this.handleCreateMission(createForm);
    }, { signal });

    // 8. Fechamento do Modal de Relatório AAR
    const closeAarBtn = this.container.querySelector('#btn-close-aar-modal');
    closeAarBtn?.addEventListener('click', () => this.closeAarModal(), { signal });

    const cancelAarBtn = this.container.querySelector('#btn-cancel-aar');
    cancelAarBtn?.addEventListener('click', () => this.closeAarModal(), { signal });

    const aarOverlay = this.container.querySelector('#aar-modal');
    aarOverlay?.addEventListener('click', (e) => {
      if (e.target === aarOverlay) this.closeAarModal();
    }, { signal });

    // 9. Copiar texto do AAR
    const copyAarBtn = this.container.querySelector('#btn-copy-aar-text');
    copyAarBtn?.addEventListener('click', async () => {
      const textarea = this.container.querySelector('#aar-text-content') as HTMLTextAreaElement;
      if (textarea && textarea.value) {
        await navigator.clipboard.writeText(textarea.value);
        ToastService.success('Relatório de Missão copiado para a área de transferência!');
      }
    }, { signal });

    // 10. Restaurar / Carregar modelo do Piloto Selecionado
    const loadAarBtn = this.container.querySelector('#btn-load-aar-template');
    const pilotSelect = this.container.querySelector('#select-aar-pilot') as HTMLSelectElement;
    loadAarBtn?.addEventListener('click', async () => {
      if (pilotSelect) {
        await this.populateAarTextarea(pilotSelect.value);
        ToastService.info('Modelo de relatório atualizado.');
      }
    }, { signal });

    pilotSelect?.addEventListener('change', async () => {
      await this.populateAarTextarea(pilotSelect.value);
    }, { signal });

    const resetAarBtn = this.container.querySelector('#btn-reset-aar-template');
    resetAarBtn?.addEventListener('click', async () => {
      if (pilotSelect) {
        await this.populateAarTextarea(pilotSelect.value);
        ToastService.info('Modelo restaurado para os valores originais.');
      }
    }, { signal });

    // 11. Concluir e arquivar missão via modal AAR
    const submitAarBtn = this.container.querySelector('#btn-submit-aar-complete');
    submitAarBtn?.addEventListener('click', async () => {
      if (!this.activeAarMission) return;
      const textarea = this.container.querySelector('#aar-text-content') as HTMLTextAreaElement;
      const aarContent = textarea?.value?.trim() || '';
      try {
        await missionService.completeMission(this.activeAarMission._id, aarContent);
        ToastService.success('Operação concluída com sucesso! Histórico e AAR arquivados na Omninet.');
        this.closeAarModal();
        this.closeMissionDetailModal();
        await this.refreshGrid();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao concluir operação.');
      }
    }, { signal });

    // 12. Fechamento e Envio do Chat Pré-Missão
    const closeChatBtn = this.container.querySelector('#btn-close-chat-modal');
    closeChatBtn?.addEventListener('click', () => this.closePreMissionChat(), { signal });

    const chatOverlay = this.container.querySelector('#mission-chat-modal');
    chatOverlay?.addEventListener('click', (e) => {
      if (e.target === chatOverlay) this.closePreMissionChat();
    }, { signal });

    const chatForm = this.container.querySelector('#form-mission-chat-input') as HTMLFormElement;
    const chatTextarea = this.container.querySelector('#input-mission-chat-text') as HTMLTextAreaElement;

    chatTextarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm?.requestSubmit();
      }
    }, { signal });

    let isSendingChat = false;
    chatForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSendingChat) return;
      if (!this.activeChatMissionId || !chatTextarea) return;
      const content = chatTextarea.value.trim();
      if (!content) return;

      isSendingChat = true;
      chatTextarea.value = '';
      try {
        await chatService.sendMissionMessage(this.activeChatMissionId, content);
      } catch (err: any) {
        chatTextarea.value = content;
        ToastService.error(err.message || 'Falha ao transmitir mensagem.');
      } finally {
        isSendingChat = false;
      }
    }, { signal });

    // 13. Tecla Escape fecha todos os modais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMissionDetailModal();
        this.closeCreateModal();
        this.closeAarModal();
        this.closePreMissionChat();
      }
    }, { signal });
  }

  private async refreshGrid() {
    const gridContainer = this.container.querySelector('#missions-grid-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">FILTRANDO OPERAÇÕES...</div>
      </div>
    `;

    try {
      await this.fetchMissions();
      gridContainer.innerHTML = this.renderMissionsGrid();
    } catch (err: any) {
      gridContainer.innerHTML = `<div class="sheet-error-msg">${err.message}</div>`;
    }
  }

  private async handleApply(missionId: string) {
    try {
      await missionService.applyToMission(missionId, this.activePilot?._id);
      ToastService.success('Candidatura submetida com sucesso! Aguarde a escalação do GM.');
      await this.refreshGrid();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao se candidatar à missão.');
    }
  }

  private async handleCancelApplication(missionId: string) {
    try {
      await missionService.cancelApplication(missionId);
      ToastService.info('Candidatura cancelada.');
      await this.refreshGrid();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao cancelar candidatura.');
    }
  }

  private async handleCreateMission(form: HTMLFormElement) {
    const titleInput = form.querySelector('#mission-title-input') as HTMLInputElement;
    const contractorInput = form.querySelector('#mission-contractor-input') as HTMLInputElement;
    const difficultyInput = form.querySelector('#mission-difficulty-input') as HTMLSelectElement;
    const minLlInput = form.querySelector('#mission-min-ll-input') as HTMLInputElement;
    const maxLlInput = form.querySelector('#mission-max-ll-input') as HTMLInputElement;
    const slotsInput = form.querySelector('#mission-slots-input') as HTMLInputElement;
    const startDateInput = form.querySelector('#mission-start-date-input') as HTMLInputElement;
    const startTimeInput = form.querySelector('#mission-start-time-input') as HTMLInputElement;
    const platformInput = form.querySelector('#mission-platform-input') as HTMLInputElement;
    const voiceInput = form.querySelector('#mission-voice-input') as HTMLInputElement;
    const briefingInput = form.querySelector('#mission-briefing-input') as HTMLTextAreaElement;
    const rulesInput = form.querySelector('#mission-rules-input') as HTMLInputElement;

    try {
      const payload: Partial<IMission> = {
        title: titleInput.value.trim(),
        contractor: contractorInput.value.trim() || 'Union / GMS',
        difficulty: difficultyInput.value,
        min_ll: Number(minLlInput.value) || 0,
        max_ll: Number(maxLlInput.value) || 12,
        slots_total: Number(slotsInput.value) || 4,
        start_date: startDateInput.value,
        start_time: startTimeInput.value,
        end_date: startDateInput.value,
        platform: platformInput.value.trim() || 'Foundry VTT',
        voice_channel: voiceInput.value.trim() || '#op-bravo-01',
        briefing: briefingInput.value.trim(),
        optional_rules: rulesInput.value.trim()
      };

      if (this.editingMissionId) {
        await missionService.updateMission(this.editingMissionId, payload);
        ToastService.success('Operação tática atualizada com sucesso!');
      } else {
        await missionService.createMission(payload);
        ToastService.success('Nova operação cadastrada e publicada no Quadro da Omninet!');
      }
      this.closeCreateModal();
      form.reset();
      this.editingMissionId = null;
      await this.refreshGrid();
    } catch (err: any) {
      ToastService.error(err.message || 'Erro ao salvar operação.');
    }
  }

  private openCreateModal() {
    this.editingMissionId = null;
    const modal = this.container.querySelector('#create-mission-modal');
    if (!modal) return;

    const modalTag = modal.querySelector('#create-modal-tag');
    const modalName = modal.querySelector('#create-modal-name');
    const submitText = modal.querySelector('#create-modal-submit-text');
    const form = modal.querySelector('#create-mission-form') as HTMLFormElement;

    if (modalTag) modalTag.textContent = '// TERMINAL DO MESTRE // NOVO CONTRATO';
    if (modalName) modalName.textContent = 'CRIAR NOVA OPERAÇÃO TÁTICA';
    if (submitText) submitText.textContent = 'PUBLICAR OPERAÇÃO';
    form?.reset();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = modal.querySelector('#mission-start-date-input') as HTMLInputElement;
    if (dateInput) {
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
  }

  private openEditMissionModal(mission: IMission) {
    this.editingMissionId = mission._id;
    const modal = this.container.querySelector('#create-mission-modal');
    if (!modal) return;

    const modalTag = modal.querySelector('#create-modal-tag');
    const modalName = modal.querySelector('#create-modal-name');
    const submitText = modal.querySelector('#create-modal-submit-text');

    if (modalTag) modalTag.textContent = '// TERMINAL DO MESTRE // ATUALIZAR CONTRATO';
    if (modalName) modalName.textContent = 'EDITAR OPERAÇÃO TÁTICA';
    if (submitText) submitText.textContent = 'SALVAR ALTERAÇÕES';

    const titleInput = modal.querySelector('#mission-title-input') as HTMLInputElement;
    const contractorInput = modal.querySelector('#mission-contractor-input') as HTMLInputElement;
    const difficultyInput = modal.querySelector('#mission-difficulty-input') as HTMLSelectElement;
    const minLlInput = modal.querySelector('#mission-min-ll-input') as HTMLInputElement;
    const maxLlInput = modal.querySelector('#mission-max-ll-input') as HTMLInputElement;
    const slotsInput = modal.querySelector('#mission-slots-input') as HTMLInputElement;
    const startDateInput = modal.querySelector('#mission-start-date-input') as HTMLInputElement;
    const startTimeInput = modal.querySelector('#mission-start-time-input') as HTMLInputElement;
    const platformInput = modal.querySelector('#mission-platform-input') as HTMLInputElement;
    const voiceInput = modal.querySelector('#mission-voice-input') as HTMLInputElement;
    const briefingInput = modal.querySelector('#mission-briefing-input') as HTMLTextAreaElement;
    const rulesInput = modal.querySelector('#mission-rules-input') as HTMLInputElement;

    if (titleInput) titleInput.value = mission.title || '';
    if (contractorInput) contractorInput.value = mission.contractor || 'Union / GMS';
    if (difficultyInput) {
      const numDiff = Math.max(1, Math.min(3, Number(mission.difficulty) || 1));
      difficultyInput.value = String(numDiff);
    }
    if (minLlInput) minLlInput.value = String(mission.min_ll ?? 0);
    if (maxLlInput) maxLlInput.value = String(mission.max_ll ?? 12);
    if (slotsInput) slotsInput.value = String(mission.slots_total ?? 4);

    if (startDateInput) {
      const d = mission.start_date ? new Date(mission.start_date) : new Date();
      startDateInput.value = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    }
    if (startTimeInput) startTimeInput.value = mission.start_time || '19:30';
    if (platformInput) platformInput.value = mission.platform || 'Foundry VTT';
    if (voiceInput) voiceInput.value = mission.voice_channel || '#op-bravo-01';
    if (briefingInput) briefingInput.value = mission.briefing || '';
    if (rulesInput) rulesInput.value = mission.optional_rules || '';

    modal.classList.remove('hidden');
  }

  private async openMissionDetailModal(missionId: string) {
    let mission = this.missions.find((m) => m._id === missionId);
    if (!mission) return;

    const modal = this.container.querySelector('#mission-modal');
    if (!modal) return;

    // Busca detalhes completos e atualizados da missão com pilotos populados
    try {
      const full = await missionService.getMissionById(missionId);
      if (full && full._id) {
        mission = full;
        const idx = this.missions.findIndex((m) => m._id === missionId);
        if (idx !== -1) this.missions[idx] = full;
      }
    } catch {
      // continua com dados do cache se offline
    }

    const titleEl = modal.querySelector('#modal-mission-title');
    const tagEl = modal.querySelector('#modal-mission-tag');
    const bodyEl = modal.querySelector('#modal-mission-body');

    const dateEl = modal.querySelector('#modal-mission-date-badge');
    if (dateEl) {
      dateEl.innerHTML = `<i class="mdi mdi-calendar-clock"></i> <span>${this.formatDate(mission.start_date)} às ${mission.start_time} BRT</span>`;
    }

    if (titleEl) titleEl.textContent = mission.title;
    if (tagEl) tagEl.textContent = `// CONTRATANTE: ${mission.contractor.toUpperCase()} // STATUS: ${mission.status}`;

    const user = authService.currentUser;
    const isOwnerGm = !!(
      user && mission.gm_id && (
        (typeof mission.gm_id === 'object' && String((mission.gm_id as any)._id) === String(user._id)) ||
        String(mission.gm_id) === String(user._id)
      )
    );
    const canManageMission = isOwnerGm || user?.role === 'ADMIN';

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="mission-telemetry-strip modal-telemetry-strip">
          <div class="telemetry-cell">
            <span class="telemetry-label">FAIXA DE LICENÇA</span>
            <span class="telemetry-val highlight-ll">LL ${mission.min_ll} até LL ${mission.max_ll}</span>
          </div>
          <div class="telemetry-cell">
            <span class="telemetry-label">DIFICULDADE</span>
            <span class="telemetry-val highlight-diff">${this.renderDifficultyStars(mission.difficulty)}</span>
          </div>
          <div class="telemetry-cell">
            <span class="telemetry-label">VAGAS TÁTICAS</span>
            <span class="telemetry-val">${mission.slots_total} Pilotos</span>
          </div>
          <div class="telemetry-cell">
            <span class="telemetry-label">HORÁRIO</span>
            <span class="telemetry-val">${this.formatDate(mission.start_date)} @ ${mission.start_time} BRT</span>
          </div>
        </div>

        <div class="mission-briefing-box">
          <div class="briefing-box-title">
            <i class="mdi mdi-text-box-search-outline"></i>
            <span>BRIEFING CONFIDENCIAL</span>
          </div>
          <p class="briefing-full-text">${mission.briefing}</p>
        </div>

        ${
          mission.optional_rules
            ? `
          <div class="card sheet-subcard">
            <h4 class="sheet-subcard-title">
              <i class="mdi mdi-alert-circle-outline"></i>
              <span>CONDIÇÕES DO CAMPO DE BATALHA & REGRAS OPCIONAIS</span>
            </h4>
            <p class="system-desc">${mission.optional_rules}</p>
          </div>
        `
            : ''
        }

        <div class="mission-roster-section">
          <h4 class="mission-roster-title">
            <i class="mdi mdi-account-group"></i>
            <span>CANDIDATOS & ESQUADRÃO MOBILIZADO (${(mission.applications || []).length} PILOTOS)</span>
          </h4>

          <div class="mission-roster-list">
            ${
              (mission.applications || []).length > 0
                ? (mission.applications || [])
                    .map((app: any) => {
                      const p = typeof app.pilot_id === 'object' && app.pilot_id !== null ? app.pilot_id : {};
                      const pilotCallsign = p.callsign || '';
                      const pilotRealName = p.name ? ` (${p.name})` : '';
                      const displayName = pilotCallsign ? `${pilotCallsign}${pilotRealName}` : (p.name || 'Piloto da Guilda');
                      const frameName = p.active_mech_name || p.active_mech_frame || 'Chassi Padrão GMS';
                      const llText = p.license_level !== undefined ? `LL ${p.license_level}` : 'LL ?';
                      const pilotId = p._id || (typeof app.pilot_id === 'string' ? app.pilot_id : '');

                      return `
                  <div class="roster-pilot-card">
                    <div class="roster-pilot-info">
                      <i class="mdi mdi-account-circle roster-pilot-avatar"></i>
                      <div class="roster-pilot-details">
                        <div class="roster-pilot-title-row">
                          ${
                            pilotId
                              ? `
                            <a href="#/mech?id=${pilotId}" class="roster-mech-link" title="Inspecionar Ficha de Combate do Mecha" target="_blank">
                              <strong class="roster-pilot-name">${displayName}</strong>
                            </a>
                          `
                              : ''
                          }
                        </div>
                        <div class="roster-pilot-frame">
                          <span class="roster-frame-label">Chassi:</span>
                          <span class="roster-frame-highlight">${frameName}</span>
                          <span class="roster-ll-badge">${llText}</span>
                        </div>
                      </div>
                    </div>
                    <div class="roster-pilot-actions">
                      <span class="mission-app-badge ${
                        app.status === 'SELECTED'
                          ? 'app-selected'
                          : app.status === 'WAITLIST'
                          ? 'app-waitlist'
                          : 'app-pending'
                      }">
                        ${app.status === 'SELECTED' ? 'ESCALADO' : app.status === 'WAITLIST' ? 'ESPERA' : 'PENDENTE'}
                      </span>
                      ${
                        pilotId
                          ? `
                        <button type="button"
                                class="btn-roster-aar"
                                data-pilot-id="${pilotId}"
                                title="Gerar modelo de Relatório de Missão para este Piloto">
                          <i class="mdi mdi-clipboard-text-outline"></i>
                          <span>RELATÓRIO</span>
                        </button>
                      `
                          : ''
                      }
                      ${
                        canManageMission && mission.status === 'OPEN'
                          ? `
                        <div class="roster-gm-controls">
                          <button type="button"
                                  class="btn-roster-action btn-roster-select"
                                  data-pilot-id="${pilotId}"
                                  data-status="SELECTED"
                                  title="Escalar para o esquadrão principal">
                            <i class="mdi mdi-check"></i> ESCALAR
                          </button>
                          <button type="button"
                                  class="btn-roster-action btn-roster-waitlist"
                                  data-pilot-id="${pilotId}"
                                  data-status="WAITLIST"
                                  title="Colocar na lista de espera">
                            <i class="mdi mdi-clock-outline"></i> ESPERA
                          </button>
                        </div>
                      `
                          : ''
                      }
                    </div>
                  </div>
                `;
                    })
                    .join('')
                : '<p class="system-desc">Nenhum piloto submeteu candidatura para esta operação ainda.</p>'
            }
          </div>
        </div>

        ${
          mission.aar
            ? `
          <div class="mission-modal-section mission-aar-section">
            <div class="mission-aar-header">
              <h4 class="mission-modal-label">
                <i class="mdi mdi-clipboard-text-clock-outline"></i>
                RELATÓRIO PÓS-AÇÃO // AFTER ACTION REPORT (AAR)
              </h4>
              <button type="button" id="btn-copy-modal-aar" class="btn btn-secondary btn-copy-aar" title="Copiar relatório pós-ação completo">
                <i class="mdi mdi-content-copy"></i>
                <span>COPIAR RELATÓRIO</span>
              </button>
            </div>
            <pre class="mission-aar-content">${mission.aar}</pre>
          </div>
        `
            : ''
        }

        <!-- Seção de Acesso ao Canal Pré-Missão -->
        <div class="mission-modal-section">
          <button type="button" class="btn-mission-chat btn-mission-chat-full" data-mission-id="${mission._id}" title="Conversar com o GM e pilotos no canal pré-missão">
            <i class="mdi mdi-chat-processing-outline"></i>
            <span>CANAL PRÉ-MISSÃO // BRIEFING & ALINHAMENTO COM O GM</span>
          </button>
        </div>

        ${
          canManageMission
            ? `
          <div class="form-actions-row">
            ${
              mission.status === 'OPEN'
                ? `
              <button type="button" id="btn-start-mission" class="btn btn-primary" data-mission-id="${mission._id}">
                <i class="mdi mdi-play"></i>
                <span>INICIAR OPERAÇÃO</span>
              </button>
            `
                : mission.status === 'IN_PROGRESS'
                ? `
              <button type="button" id="btn-complete-mission" class="btn btn-primary" data-mission-id="${mission._id}">
                <i class="mdi mdi-check-all"></i>
                <span>CONCLUIR OPERAÇÃO (AAR)</span>
              </button>
            `
                : ''
            }
            ${
              !['COMPLETED', 'CANCELLED'].includes(mission.status)
                ? `
              <button type="button" id="btn-edit-modal-mission" class="btn btn-secondary">
                <i class="mdi mdi-pencil-outline"></i>
                <span>EDITAR</span>
              </button>
            `
                : ''
            }
            <button type="button" id="btn-delete-mission" class="btn btn-secondary" data-mission-id="${mission._id}">
              <i class="mdi mdi-trash-can-outline"></i>
              <span>EXCLUIR</span>
            </button>
          </div>
        `
            : ''
        }
      `;

      // Ações do GM para selecionar / escalar pilotos no esquadrão
      bodyEl.querySelectorAll('.btn-roster-action').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget as HTMLElement;
          const pilotId = target.getAttribute('data-pilot-id');
          const newStatus = target.getAttribute('data-status') as any;
          if (pilotId && newStatus) {
            try {
              const currentSelections = (mission.applications || []).map((a: any) => {
                const aPilotId = typeof a.pilot_id === 'object' ? a.pilot_id?._id : a.pilot_id;
                return {
                  pilot_id: String(aPilotId),
                  status: String(aPilotId) === String(pilotId) ? newStatus : a.status
                };
              });
              await missionService.selectPilots(mission._id, currentSelections);
              ToastService.success('Escalação do piloto atualizada!');
              await this.fetchMissions();
              this.openMissionDetailModal(mission._id);
            } catch (err: any) {
              ToastService.error(err.message || 'Falha ao escalar piloto.');
            }
          }
        });
      });

      // Eventos dos botões do GM no modal
      const editModalBtn = bodyEl.querySelector('#btn-edit-modal-mission');
      editModalBtn?.addEventListener('click', () => {
        this.closeMissionDetailModal();
        this.openEditMissionModal(mission);
      });

      const startBtn = bodyEl.querySelector('#btn-start-mission');
      startBtn?.addEventListener('click', async () => {
        try {
          await missionService.startMission(mission._id);
          ToastService.success('Operação iniciada! Pilotos mobilizados no campo de batalha.');
          this.closeMissionDetailModal();
          await this.refreshGrid();
        } catch (err: any) {
          ToastService.error(err.message || 'Falha ao iniciar operação.');
        }
      });

      // Evento de clique para o botão RELATÓRIO nos cards do esquadrão
      bodyEl.querySelectorAll('.btn-roster-aar').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const pilotId = (e.currentTarget as HTMLElement).getAttribute('data-pilot-id');
          if (pilotId) {
            await this.openAarModal(mission, { pilotId, isConcluding: false });
          }
        });
      });

      // Evento para copiar AAR no mission-modal
      const copyModalAarBtn = bodyEl.querySelector('#btn-copy-modal-aar');
      copyModalAarBtn?.addEventListener('click', async () => {
        if (mission.aar) {
          await navigator.clipboard.writeText(mission.aar);
          ToastService.success('Relatório Pós-Ação (AAR) copiado para a área de transferência!');
        }
      });

      const completeBtn = bodyEl.querySelector('#btn-complete-mission');
      completeBtn?.addEventListener('click', async () => {
        await this.openAarModal(mission, { isConcluding: true });
      });

      const deleteBtn = bodyEl.querySelector('#btn-delete-mission');
      deleteBtn?.addEventListener('click', async () => {
        if (confirm(`Tem certeza que deseja cancelar e excluir a operação "${mission.title}"?`)) {
          try {
            await missionService.deleteMission(mission._id);
            ToastService.info('Operação removida.');
            this.closeMissionDetailModal();
            await this.refreshGrid();
          } catch (err: any) {
            ToastService.error(err.message || 'Falha ao excluir operação.');
          }
        }
      });
    }

    modal.classList.remove('hidden');
  }

  private async openAarModal(mission: IMission, options: { pilotId?: string; isConcluding?: boolean } = {}) {
    this.activeAarMission = mission;
    const modal = this.container.querySelector('#aar-modal');
    if (!modal) return;

    const modalTag = modal.querySelector('#aar-modal-tag');
    const modalTitle = modal.querySelector('#aar-modal-title');
    const pilotSelect = modal.querySelector('#select-aar-pilot') as HTMLSelectElement;
    const submitBtn = modal.querySelector('#btn-submit-aar-complete');

    if (options.isConcluding) {
      if (modalTag) modalTag.textContent = '// DEBRIEFING TÁTICO // CONCLUIR OPERAÇÃO';
      if (modalTitle) modalTitle.textContent = `CONCLUIR MISSÃO: ${mission.title.toUpperCase()}`;
      submitBtn?.classList.remove('hidden');
    } else {
      if (modalTag) modalTag.textContent = '// TELEMETRIA DE RECESSO // RELATÓRIO DO PILOTO';
      if (modalTitle) modalTitle.textContent = 'RELATÓRIO DE MISSÃO // PILOTO';
      submitBtn?.classList.add('hidden');
    }

    // Popula o select de pilotos
    if (pilotSelect) {
      pilotSelect.innerHTML = '<option value="GENERIC">Modelo Padrão em Branco</option>';
      const applications = mission.applications || [];
      applications.forEach((app: any) => {
        const p = typeof app.pilot_id === 'object' && app.pilot_id !== null ? app.pilot_id : null;
        if (p) {
          const pilotName = p.callsign || p.name || 'Piloto';
          const mechName = p.active_mech_name || p.active_mech_frame || 'Chassi';
          const opt = document.createElement('option');
          opt.value = String(p._id);
          opt.textContent = `${pilotName} (${mechName}) [LL ${p.license_level ?? 0}]`;
          if (options.pilotId && String(p._id) === String(options.pilotId)) {
            opt.selected = true;
          }
          pilotSelect.appendChild(opt);
        }
      });
      if (applications.length > 1) {
        const allOpt = document.createElement('option');
        allOpt.value = 'ALL_ROSTER';
        allOpt.textContent = 'Todos os Pilotos Escalados (Concatenados)';
        pilotSelect.appendChild(allOpt);
      }
    }

    // Carrega o template
    await this.populateAarTextarea(options.pilotId || pilotSelect?.value || 'GENERIC');

    modal.classList.remove('hidden');
  }

  private closeAarModal() {
    const modal = this.container.querySelector('#aar-modal');
    modal?.classList.add('hidden');
    this.activeAarMission = null;
  }

  private async populateAarTextarea(selectedVal: string) {
    const textarea = this.container.querySelector('#aar-text-content') as HTMLTextAreaElement;
    if (!textarea) return;

    if (selectedVal === 'GENERIC') {
      textarea.value = buildMissionReportText();
      return;
    }

    if (selectedVal === 'ALL_ROSTER' && this.activeAarMission) {
      const reports: string[] = [];
      const selectedApps = (this.activeAarMission.applications || []).filter(
        (a: any) => a.status === 'SELECTED' || a.status === 'PENDING'
      );
      for (const app of selectedApps) {
        const p = typeof app.pilot_id === 'object' && app.pilot_id !== null ? app.pilot_id : null;
        if (p && p._id) {
          try {
            const fullPilot = await pilotService.getPilotById(String(p._id));
            reports.push(buildMissionReportText(fullPilot));
          } catch {
            reports.push(buildMissionReportText(p));
          }
        }
      }
      textarea.value = reports.length > 0
        ? reports.join('\n\n' + '='.repeat(40) + '\n\n')
        : buildMissionReportText();
      return;
    }

    // Piloto individual selecionado
    try {
      const fullPilot = await pilotService.getPilotById(selectedVal);
      textarea.value = buildMissionReportText(fullPilot);
    } catch {
      const app = (this.activeAarMission?.applications || []).find((a: any) => {
        const pId = typeof a.pilot_id === 'object' ? a.pilot_id?._id : a.pilot_id;
        return String(pId) === String(selectedVal);
      });
      const p = typeof app?.pilot_id === 'object' ? app?.pilot_id : null;
      textarea.value = buildMissionReportText(p);
    }
  }

  private closeMissionDetailModal() {
    const modal = this.container.querySelector('#mission-modal');
    modal?.classList.add('hidden');
  }

  private closeCreateModal() {
    const modal = this.container.querySelector('#create-mission-modal');
    modal?.classList.add('hidden');
  }

  private renderPreMissionChatModal(): string {
    return `
      <div id="mission-chat-modal" class="mission-chat-modal-overlay is-hidden" role="dialog" aria-modal="true">
        <div class="mission-chat-modal-box">
          <div class="mission-chat-header">
            <div class="mission-chat-title-group">
              <span class="mission-chat-sub">
                <span class="link-online-pulse"></span>
                // CANAL PRÉ-MISSÃO // BRIEFING & ALINHAMENTO COM O GM
              </span>
              <h2 id="chat-modal-mission-title" class="mission-chat-title">OPERAÇÃO</h2>
            </div>
            <div class="mission-chat-header-actions">
              <button type="button" id="btn-close-chat-modal" class="mission-chat-close-btn" title="Fechar Canal">
                <i class="mdi mdi-close"></i>
              </button>
            </div>
          </div>

          <!-- Lista de Mensagens de Alinhamento -->
          <div id="mission-chat-messages" class="mission-chat-messages-area">
            <div class="comms-empty-state">
              <div class="comms-empty-icon"><i class="mdi mdi-forum-outline"></i></div>
              <div>Carregando transmissões do canal pré-missão...</div>
            </div>
          </div>

          <!-- Barra de Entrada de Transmissão -->
          <form id="form-mission-chat-input" class="mission-chat-input-bar">
            <textarea id="input-mission-chat-text" class="mission-chat-input" placeholder="Tire dúvidas sobre regras, cenário, sinergia de chassis ou combine detalhes com o GM (Enter para transmitir)..." rows="1"></textarea>
            <button type="submit" class="btn-transmit">
              <i class="mdi mdi-send"></i>
              <span>TRANSMITIR</span>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  private async openPreMissionChat(missionId: string) {
    this.activeChatMissionId = missionId;
    const mission = this.missions.find((m) => m._id === missionId);
    const modalEl = this.container.querySelector('#mission-chat-modal') as HTMLElement;
    const titleEl = this.container.querySelector('#chat-modal-mission-title');
    const messagesArea = this.container.querySelector('#mission-chat-messages');

    if (titleEl && mission) {
      titleEl.textContent = mission.title;
    }

    if (modalEl) {
      modalEl.classList.remove('is-hidden');
    }

    chatService.joinMission(missionId);

    // Carrega mensagens anteriores
    if (messagesArea) {
      messagesArea.innerHTML = `
        <div class="comms-empty-state">
          <div class="comms-empty-icon"><i class="mdi mdi-forum-outline"></i></div>
          <div>Lendo transmissões do terminal Omninet...</div>
        </div>
      `;

      try {
        const msgs = await chatService.getMissionMessages(missionId);
        if (msgs.length === 0) {
          messagesArea.innerHTML = `
            <div class="comms-empty-state">
              <div class="comms-empty-icon"><i class="mdi mdi-message-text-outline"></i></div>
              <div>Nenhuma transmissão registrada neste canal pré-missão ainda.</div>
              <div class="comms-empty-hint">Utilize o campo abaixo para tirar dúvidas e alinhar estratégias com o GM e os pilotos.</div>
            </div>
          `;
        } else {
          messagesArea.innerHTML = '';
          msgs.forEach((m) => this.appendChatMessage(m));
        }
      } catch {
        messagesArea.innerHTML = `
          <div class="comms-empty-state">
            <div>Falha ao carregar mensagens anteriores.</div>
          </div>
        `;
      }
    }

    // Listener de novas mensagens em tempo real
    if (this.chatUnsubscribe) {
      this.chatUnsubscribe();
    }
    this.chatUnsubscribe = chatService.onNewMessage((newMsg) => {
      const msgMissionId = typeof newMsg.mission_id === 'object' && newMsg.mission_id !== null
        ? (newMsg.mission_id as any)._id
        : newMsg.mission_id;

      if (String(msgMissionId) === String(this.activeChatMissionId)) {
        const emptyState = messagesArea?.querySelector('.comms-empty-state');
        if (emptyState) emptyState.remove();
        this.appendChatMessage(newMsg);
      }
    });
  }

  private closePreMissionChat() {
    if (this.activeChatMissionId) {
      chatService.leaveMission(this.activeChatMissionId);
      this.activeChatMissionId = null;
    }
    const modalEl = this.container.querySelector('#mission-chat-modal') as HTMLElement;
    if (modalEl) {
      modalEl.classList.add('is-hidden');
    }
    if (this.chatUnsubscribe) {
      this.chatUnsubscribe();
      this.chatUnsubscribe = null;
    }
  }

  private appendChatMessage(msg: IChatMessage) {
    const messagesArea = this.container.querySelector('#mission-chat-messages');
    if (!messagesArea) return;

    // Deduplicação estrita: se a mensagem já foi renderizada na área, ignora
    const msgId = msg._id ? String(msg._id) : null;
    if (msgId && messagesArea.querySelector(`[data-msg-id="${msgId}"]`)) {
      return;
    }

    const currentUserId = authService.currentUser?._id;
    const authorId = typeof msg.author_id === 'object' && msg.author_id !== null
      ? (msg.author_id as any)._id
      : msg.author_id;

    const isOwn = String(authorId) === String(currentUserId);
    const isGm = msg.author_role === 'GM';
    const isSystem = msg.message_type === 'SYSTEM';

    const timeFormatted = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const row = document.createElement('div');
    row.className = `transmission-row ${isOwn ? 'is-own' : ''} ${isGm ? 'is-gm' : ''} ${isSystem ? 'is-system' : ''}`;
    if (msgId) {
      row.setAttribute('data-msg-id', msgId);
    }

    const roleBadgeClass = isGm ? 'badge-role-gm' : msg.author_role === 'ADMIN' ? 'badge-role-admin' : 'badge-role-pilot';

    row.innerHTML = `
      <div class="transmission-meta">
        <div class="transmission-author-info">
          <span class="author-role-badge ${roleBadgeClass}">${msg.author_role}</span>
          <strong class="transmission-callsign">${msg.pilot_callsign || msg.author_name}</strong>
          ${msg.pilot_callsign && msg.author_name !== msg.pilot_callsign ? `<span class="transmission-author-username">(@${msg.author_name})</span>` : ''}
        </div>
        <span class="transmission-time">${timeFormatted}</span>
      </div>
      <div class="transmission-text">${msg.content}</div>
    `;

    messagesArea.appendChild(row);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon"></i>
        </div>
        <h2 class="sheet-error-title">ERRO NO QUADRO DE OPERAÇÕES</h2>
        <p class="sheet-error-msg">${message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()">TENTAR NOVAMENTE</button>
      </div>
    `;
  }
}
