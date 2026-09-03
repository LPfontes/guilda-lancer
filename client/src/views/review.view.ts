import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { IPilot } from '../types/pilot.types.js';

export class ReviewView {
  private container: HTMLElement;
  private pilots: IPilot[] = [];
  private currentFilter: string = 'PENDING';
  private searchKeyword: string = '';
  private selectedPilotForReject: IPilot | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">CARREGANDO FICHAS PARA HOMOLOGAÇÃO...</div>
      </div>
    `;

    try {
      await this.loadPilots();
      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      this.renderError(err.message || 'Falha ao carregar fichas de pilotos para avaliação.');
    }
  }

  private async loadPilots() {
    const res = await pilotService.getAllPilots({ status: 'ALL', search: this.searchKeyword });
    this.pilots = res.pilots || [];
  }



  private renderContent() {
    const totalPending = this.pilots.filter(
      (p) => p.status === 'PENDING_APPROVAL' || (p.status as string) === 'PENDING'
    ).length;
    const totalApproved = this.pilots.filter((p) => p.status === 'APPROVED').length;
    const totalRejected = this.pilots.filter((p) => p.status === 'REJECTED').length;

    this.container.innerHTML = `
      <div class="review-container">
        <!-- Header da Tela de Avaliações -->
        <div class="review-header-bar">
          <div class="review-title-group">
            <div class="review-header-icon">
              ${getCompconIcon('review', 'compcon-icon-lg')}
            </div>
            <div>
              <div class="review-tagline">// TERMINAL DE AUDITORIA & COMPLIANCE // COMP/CON V3</div>
              <h1 class="review-main-title">HOMOLOGAÇÃO DE PILOTOS</h1>
              
            </div>
          </div>

          <div class="missions-top-actions">
            <a href="#/missions" class="btn btn-secondary">
              ${getCompconIcon('missions', 'compcon-icon')}
              <span>QUADRO DE MISSÕES</span>
            </a>
            <a href="#/hangar" class="btn btn-secondary">
              ${getCompconIcon('hangar', 'compcon-icon')}
              <span>HANGAR</span>
            </a>
          </div>
        </div>

        <!-- Métricas Rápidas -->
        <div class="review-metrics-row">
          <div class="review-metric-card metric-pending">
            <div class="metric-icon-box">
              <i class="mdi mdi-clock-alert-outline"></i>
            </div>
            <div class="metric-info">
              <span class="metric-value">${totalPending}</span>
              <span class="metric-label">AGUARDANDO AUDITORIA</span>
            </div>
          </div>

          <div class="review-metric-card metric-approved">
            <div class="metric-icon-box">
              <i class="mdi mdi-check-decagram-outline"></i>
            </div>
            <div class="metric-info">
              <span class="metric-value">${totalApproved}</span>
              <span class="metric-label">FICHAS HOMOLOGADAS</span>
            </div>
          </div>

          <div class="review-metric-card metric-rejected">
            <div class="metric-icon-box">
              <i class="mdi mdi-alert-circle-outline"></i>
            </div>
            <div class="metric-info">
              <span class="metric-value">${totalRejected}</span>
              <span class="metric-label">COM PENDÊNCIAS</span>
            </div>
          </div>
        </div>

        <!-- Toolbar de Filtros -->
        <div class="review-filter-toolbar">
          <div class="review-filter-group">
            <button type="button" class="filter-btn ${this.currentFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">
              PENDENTES <span class="review-filter-badge-count">${totalPending}</span>
            </button>
            <button type="button" class="filter-btn ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
              TODAS (${this.pilots.length})
            </button>
            <button type="button" class="filter-btn ${this.currentFilter === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED">
              APROVADAS (${totalApproved})
            </button>
            <button type="button" class="filter-btn ${this.currentFilter === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED">
              REJEITADAS (${totalRejected})
            </button>
          </div>

          <div class="filter-controls-group">
            <div class="filter-search-box">
              <i class="mdi mdi-magnify filter-search-icon"></i>
              <input type="text"
                     id="input-review-search"
                     class="filter-search-input"
                     placeholder="Buscar piloto, operador, chassi..."
                     value="${this.searchKeyword}" />
            </div>
          </div>
        </div>

        <!-- Lista de Cards de Fichas -->
        <div id="review-cards-container">
          ${this.renderPilotsList()}
        </div>

        <!-- Modal de Justificativa de Rejeição -->
        <div id="reject-modal" class="mission-modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="mission-modal-box">
            <div class="mission-modal-header">
              <div class="mission-modal-title-group">
                <i class="mdi mdi-alert-circle-outline mission-modal-icon"></i>
                <div>
                  <div class="mission-modal-tag">// AUDITORIA DE REGRAS // RETORNO AO PILOTO</div>
                  <h3 id="reject-modal-title" class="mission-modal-name">JUSTIFICATIVA DE NÃO-CONFORMIDADE</h3>
                </div>
              </div>
              <button id="btn-close-reject-modal" class="mission-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <form id="reject-form" class="mission-modal-body rejection-form">
              <p class="restricted-desc">
                Descreva com clareza quais pontos da ficha precisam ser ajustados pelo piloto (ex: excesso de SP, talentos incompatíveis, background em branco).
              </p>
              <div class="form-group">
                <label class="form-label" for="reject-reason-input">MOTIVO DA REJEIÇÃO *</label>
                <textarea id="reject-reason-input" class="form-textarea rejection-textarea" required placeholder="Ex: A soma dos sistemas instalados ultrapassou os Pontos de Sistema (SP) disponíveis no chassi. Favor rebalancear o loadout."></textarea>
              </div>

              <div class="form-actions-row">
                <button type="button" id="btn-cancel-reject" class="btn btn-secondary">CANCELAR</button>
                <button type="submit" class="btn btn-reject-sheet">
                  <i class="mdi mdi-close-circle-outline"></i>
                  <span>CONFIRMAR REJEIÇÃO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  private renderPilotsList(): string {
    const filtered = this.pilots.filter((p) => {
      const status = p.status as string;
      const isPending = status === 'PENDING_APPROVAL' || status === 'PENDING';

      if (this.currentFilter === 'PENDING') return isPending;
      if (this.currentFilter === 'APPROVED') return status === 'APPROVED';
      if (this.currentFilter === 'REJECTED') return status === 'REJECTED';
      return true;
    });

    if (filtered.length === 0) {
      return `
        <div class="missions-empty-container">
          <div class="missions-empty-icon">
            <i class="mdi mdi-check-all"></i>
          </div>
          <h3 class="missions-empty-title">NENHUMA FICHA NESTA CATEGORIA</h3>
          <p class="missions-empty-desc">
            Não há fichas registradas sob o filtro selecionado. O arquivo de auditoria da Omninet está atualizado.
          </p>
        </div>
      `;
    }

    return `
      <div class="review-cards-list">
        ${filtered.map((p) => this.renderReviewCard(p)).join('')}
      </div>
    `;
  }

  private renderReviewCard(p: IPilot): string {
    const isPending = p.status === 'PENDING_APPROVAL' || (p.status as string) === 'PENDING';
    const statusClass = isPending ? 'status-pending' : `status-${p.status.toLowerCase()}`;
    const statusLabel = isPending ? 'AGUARDANDO APROVAÇÃO' : p.status === 'APPROVED' ? 'HOMOLOGADO' : 'REJEITADO';

    const userObj = p.user_id as any;
    const reviewerObj = p.reviewed_by as any;
    const isAdmin = authService.currentUser?.role === 'ADMIN';

    return `
      <div class="review-card ${statusClass}">
        <div class="review-card-header">
          <div class="review-card-pilot-info">
            <div class="review-pilot-avatar-box">
              <i class="mdi mdi-account-card-details"></i>
            </div>
            <div>
              <h3 class="review-pilot-callsign">
                <span>${p.callsign || 'PILOTO DESCONHECIDO'}</span>
                <span class="telemetry-val highlight-ll">[LL ${p.license_level ?? 0}]</span>
              </h3>
              <div class="review-pilot-user">
                <span>Nome: <strong>${p.name || '-'}</strong></span>
                <span> // Operador: <strong>@${userObj?.username || userObj?.name || 'Desconhecido'}</strong></span>
              </div>
            </div>
          </div>

          <span class="review-status-pill ${statusClass}">
            <i class="mdi ${
              isPending
                ? 'mdi-clock-outline'
                : p.status === 'APPROVED'
                ? 'mdi-check-decagram'
                : 'mdi-alert-octagon-outline'
            }"></i>
            <span>${statusLabel}</span>
          </span>
        </div>

        <div class="review-card-body">
          <div class="review-telemetry-grid">
            <div class="review-telemetry-item">
              <span class="review-telemetry-lbl">Nome</span>
              <span class="review-telemetry-val">${p.active_mech_name || 'N/A'}</span>
            </div>
            <div class="review-telemetry-item">
              <span class="review-telemetry-lbl">Chassi</span>
              <span class="review-telemetry-val">${p.active_mech_frame || 'GMS Everest'}</span>
            </div>
            <div class="review-telemetry-item">
              <span class="review-telemetry-lbl">Atributos</span>
              <span class="review-telemetry-val">C:${p.hull || 0} / A:${p.agility || 0} / S:${p.systems || 0} / E:${p.engineering || 0}</span>
            </div>
            <div class="review-telemetry-item">
              <span class="review-telemetry-lbl">Talentos</span>
              <span class="review-telemetry-val">${(p.talents || []).length} // ${p.skills.length}</span>
            </div>
          </div>

          ${
            p.status === 'REJECTED' && p.rejection_reason
              ? `
            <div class="review-rejection-box">
              <div class="rejection-box-header">
                <i class="mdi mdi-alert-circle"></i>
                <span>PENDÊNCIA APONTADA PELO AVALIADOR</span>
              </div>
              <p class="rejection-box-text">${p.rejection_reason}</p>
            </div>
          `
              : ''
          }
        </div>

        <div class="review-card-footer">
          <div class="review-auditor-stamp">
            ${
              reviewerObj
                ? `
              <i class="mdi mdi-shield-check"></i>
              <span>Avaliado por: <strong>@${reviewerObj.username || reviewerObj.name}</strong> em ${this.formatDate(
                    p.reviewed_at as any
                  )}</span>
            `
                : `
              <i class="mdi mdi-information-outline"></i>
              <span>Ficha submetida pelo operador. Aguardando conferência de regras.</span>
            `
            }
          </div>

          <div class="review-action-btns">
            <a href="#/mech?id=${p._id}" class="btn btn-secondary" title="Ver ficha técnica completa de combate">
              
              <span>FICHA MECHA</span>
            </a>
            <a href="#/pilot?id=${p._id}" class="btn btn-secondary" title="Ver dossiê completo do piloto">
              
              <span>DOSSIÊ PILOTO</span>
            </a>

            ${
              isAdmin && p.status !== 'APPROVED'
                ? `
              <button type="button"
                      class="btn-approve-sheet"
                      data-pilot-id="${p._id}"
                      data-callsign="${p.callsign}"
                      title="Homologar e aprovar esta ficha">
                <i class="mdi mdi-check"></i>
                <span>APROVAR</span>
              </button>
            `
                : ''
            }

            ${
              isAdmin && p.status !== 'REJECTED'
                ? `
              <button type="button"
                      class="btn-reject-sheet"
                      data-pilot-id="${p._id}"
                      data-callsign="${p.callsign}"
                      title="Rejeitar ficha apontando o motivo da não-conformidade">
                <i class="mdi mdi-close"></i>
                <span>REJEITAR</span>
              </button>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private formatDate(dateVal?: string | Date): string {
    if (!dateVal) return 'Recente';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private bindEvents() {
    // 1. Filtros de Status
    const filterBtns = this.container.querySelectorAll('.review-filter-group .filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const filter = target.getAttribute('data-filter') || 'ALL';
        this.currentFilter = filter;

        filterBtns.forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        const listContainer = this.container.querySelector('#review-cards-container');
        if (listContainer) {
          listContainer.innerHTML = this.renderPilotsList();
        }
      });
    });

    // 2. Busca por Texto
    const searchInput = this.container.querySelector('#input-review-search') as HTMLInputElement;
    let debounceTimeout: any = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        this.searchKeyword = searchInput.value.trim();
        await this.loadPilots();
        const listContainer = this.container.querySelector('#review-cards-container');
        if (listContainer) {
          listContainer.innerHTML = this.renderPilotsList();
        }
      }, 350);
    });

    // 3. Botão Aprovar Ficha
    this.container.addEventListener('click', async (e) => {
      const approveBtn = (e.target as HTMLElement).closest('.btn-approve-sheet') as HTMLElement;
      if (approveBtn) {
        const pilotId = approveBtn.getAttribute('data-pilot-id');
        const callsign = approveBtn.getAttribute('data-callsign') || 'Piloto';
        if (pilotId) {
          await this.handleApprovePilot(pilotId, callsign);
        }
      }
    });

    // 4. Botão Rejeitar Ficha (Abre Modal)
    this.container.addEventListener('click', (e) => {
      const rejectBtn = (e.target as HTMLElement).closest('.btn-reject-sheet') as HTMLElement;
      if (rejectBtn) {
        const pilotId = rejectBtn.getAttribute('data-pilot-id');
        if (pilotId) {
          const pilot = this.pilots.find((p) => String(p._id) === String(pilotId));
          if (pilot) {
            this.openRejectModal(pilot);
          }
        }
      }
    });

    // 5. Fechamento do Modal de Rejeição
    const closeRejectBtn = this.container.querySelector('#btn-close-reject-modal');
    closeRejectBtn?.addEventListener('click', () => this.closeRejectModal());

    const cancelRejectBtn = this.container.querySelector('#btn-cancel-reject');
    cancelRejectBtn?.addEventListener('click', () => this.closeRejectModal());

    const rejectOverlay = this.container.querySelector('#reject-modal');
    rejectOverlay?.addEventListener('click', (e) => {
      if (e.target === rejectOverlay) this.closeRejectModal();
    });

    // 6. Submissão do Formulário de Rejeição
    const rejectForm = this.container.querySelector('#reject-form') as HTMLFormElement;
    rejectForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await this.handleConfirmReject(rejectForm);
    });

    // 7. Escape fecha modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeRejectModal();
      }
    });
  }

  private async handleApprovePilot(pilotId: string, callsign: string) {
    try {
      await pilotService.reviewPilot(pilotId, 'APPROVED');
      ToastService.success(`Ficha de "${callsign}" homologada e aprovada com sucesso!`);
      await this.loadPilots();
      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao aprovar ficha.');
    }
  }

  private openRejectModal(pilot: IPilot) {
    this.selectedPilotForReject = pilot;
    const modal = this.container.querySelector('#reject-modal');
    const titleEl = modal?.querySelector('#reject-modal-title');
    const reasonInput = modal?.querySelector('#reject-reason-input') as HTMLTextAreaElement;

    if (titleEl) {
      titleEl.textContent = `APONTAR PENDÊNCIA // ${pilot.callsign}`;
    }
    if (reasonInput) {
      reasonInput.value = pilot.rejection_reason || '';
    }

    modal?.classList.remove('hidden');
    reasonInput?.focus();
  }

  private closeRejectModal() {
    const modal = this.container.querySelector('#reject-modal');
    modal?.classList.add('hidden');
    this.selectedPilotForReject = null;
  }

  private async handleConfirmReject(form: HTMLFormElement) {
    if (!this.selectedPilotForReject) return;

    const reasonInput = form.querySelector('#reject-reason-input') as HTMLTextAreaElement;
    const reason = reasonInput.value.trim();

    if (!reason) {
      ToastService.error('O motivo da não-conformidade é obrigatório.');
      return;
    }

    try {
      await pilotService.reviewPilot(this.selectedPilotForReject._id, 'REJECTED', reason);
      ToastService.info(`Ficha de "${this.selectedPilotForReject.callsign}" marcada como rejeitada.`);
      this.closeRejectModal();
      form.reset();
      await this.loadPilots();
      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao rejeitar ficha.');
    }
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon"></i>
        </div>
        <h2 class="sheet-error-title">ERRO NO TERMINAL DE HOMOLOGAÇÃO</h2>
        <p class="sheet-error-msg">${message}</p>
        <button class="btn btn-secondary" onclick="window.location.reload()">TENTAR NOVAMENTE</button>
      </div>
    `;
  }
}
