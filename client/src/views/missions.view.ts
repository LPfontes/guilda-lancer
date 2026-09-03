import { missionService, IMissionFilters } from '../services/mission.service.js';
import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { IMission } from '../types/mission.types.js';
import { IPilot } from '../types/pilot.types.js';

export class MissionsView {
  private container: HTMLElement;
  private missions: IMission[] = [];
  private activePilot: IPilot | null = null;
  private currentFilters: IMissionFilters = { status: 'ALL', search: '' };

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
              m.status === 'OPEN'
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
                <div class="mission-modal-tag">// TERMINAL DO MESTRE // NOVO CONTRATO</div>
                <h3 class="mission-modal-name">CRIAR NOVA OPERAÇÃO TÁTICA</h3>
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
                <span>PUBLICAR OPERAÇÃO</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private bindEvents() {
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
      });
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
    });

    // 3. Botão Candidatar
    this.container.addEventListener('click', async (e) => {
      const applyBtn = (e.target as HTMLElement).closest('.btn-apply-mission') as HTMLElement;
      if (applyBtn) {
        const missionId = applyBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.handleApply(missionId);
        }
      }
    });

    // 4. Botão Cancelar Candidatura
    this.container.addEventListener('click', async (e) => {
      const cancelBtn = (e.target as HTMLElement).closest('.btn-cancel-app') as HTMLElement;
      if (cancelBtn) {
        const missionId = cancelBtn.getAttribute('data-mission-id');
        if (missionId) {
          await this.handleCancelApplication(missionId);
        }
      }
    });

    // 5. Botão Ver Detalhes
    this.container.addEventListener('click', (e) => {
      const viewBtn = (e.target as HTMLElement).closest('.btn-view-mission') as HTMLElement;
      if (viewBtn) {
        const missionId = viewBtn.getAttribute('data-mission-id');
        if (missionId) {
          this.openMissionDetailModal(missionId);
        }
      }
    });

    // 6. Fechamento do Modal de Detalhes
    const closeDetailBtn = this.container.querySelector('#btn-close-mission-modal');
    closeDetailBtn?.addEventListener('click', () => this.closeMissionDetailModal());

    const detailOverlay = this.container.querySelector('#mission-modal');
    detailOverlay?.addEventListener('click', (e) => {
      if (e.target === detailOverlay) this.closeMissionDetailModal();
    });

    // 7. Abertura do Modal de Criação (GM / ADMIN)
    const openCreateBtn = this.container.querySelector('#btn-open-create-mission');
    openCreateBtn?.addEventListener('click', () => {
      const createModal = this.container.querySelector('#create-mission-modal');
      createModal?.classList.remove('hidden');

      // Preenche data padrão com amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateInput = this.container.querySelector('#mission-start-date-input') as HTMLInputElement;
      if (dateInput && !dateInput.value) {
        dateInput.value = tomorrow.toISOString().split('T')[0];
      }
    });

    // 8. Fechamento do Modal de Criação
    const closeCreateBtn = this.container.querySelector('#btn-close-create-modal');
    closeCreateBtn?.addEventListener('click', () => this.closeCreateModal());

    const cancelCreateBtn = this.container.querySelector('#btn-cancel-create');
    cancelCreateBtn?.addEventListener('click', () => this.closeCreateModal());

    const createOverlay = this.container.querySelector('#create-mission-modal');
    createOverlay?.addEventListener('click', (e) => {
      if (e.target === createOverlay) this.closeCreateModal();
    });

    // 9. Submissão do Formulário de Criação
    const createForm = this.container.querySelector('#create-mission-form') as HTMLFormElement;
    createForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this.handleCreateMission(createForm);
    });

    // 10. Tecla Escape fecha modais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMissionDetailModal();
        this.closeCreateModal();
      }
    });
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

      await missionService.createMission(payload);
      ToastService.success('Nova operação cadastrada e publicada no Quadro da Omninet!');
      this.closeCreateModal();
      form.reset();
      await this.refreshGrid();
    } catch (err: any) {
      ToastService.error(err.message || 'Erro ao publicar operação.');
    }
  }

  private openMissionDetailModal(missionId: string) {
    const mission = this.missions.find((m) => m._id === missionId);
    if (!mission) return;

    const modal = this.container.querySelector('#mission-modal');
    if (!modal) return;

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
    const isGmOrAdmin = user?.role === 'GM' || user?.role === 'ADMIN';

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="mission-telemetry-strip">
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
                      const p = app.pilot_id || {};
                      return `
                  <div class="roster-pilot-card">
                    <div class="roster-pilot-info">
                      <i class="mdi mdi-account-circle"></i>
                      <div>
                        <strong class="roster-pilot-name">${p.callsign ? `${p.callsign} (${p.name})` : 'Piloto da Guilda'}</strong>
                        <div class="roster-pilot-frame">Chassi: ${p.active_mech_name || 'N/A'} [LL ${p.license_level ?? '?'}]</div>
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
                        isGmOrAdmin && mission.status === 'OPEN'
                          ? `
                        <div class="roster-gm-controls">
                          <button type="button"
                                  class="btn-roster-action btn-roster-select"
                                  data-pilot-id="${p._id || app.pilot_id}"
                                  data-status="SELECTED"
                                  title="Escalar para o esquadrão principal">
                            <i class="mdi mdi-check"></i> ESCALAR
                          </button>
                          <button type="button"
                                  class="btn-roster-action btn-roster-waitlist"
                                  data-pilot-id="${p._id || app.pilot_id}"
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
          isGmOrAdmin
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

      const completeBtn = bodyEl.querySelector('#btn-complete-mission');
      completeBtn?.addEventListener('click', async () => {
        const aar = prompt('Insira o AAR (After Action Report) resumindo os resultados da missão:');
        if (aar !== null) {
          try {
            await missionService.completeMission(mission._id, aar);
            ToastService.success('Operação concluída com sucesso! Histórico arquivado na Omninet.');
            this.closeMissionDetailModal();
            await this.refreshGrid();
          } catch (err: any) {
            ToastService.error(err.message || 'Falha ao concluir operação.');
          }
        }
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

  private closeMissionDetailModal() {
    const modal = this.container.querySelector('#mission-modal');
    modal?.classList.add('hidden');
  }

  private closeCreateModal() {
    const modal = this.container.querySelector('#create-mission-modal');
    modal?.classList.add('hidden');
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
