import { chatService } from '../services/chat.service.js';
import { pilotService } from '../services/pilot.service.js';
import { missionService } from '../services/mission.service.js';
import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { localization } from '../services/localization.service.js';
import { IChatMessage, IReportData } from '../types/chat.types.js';
import { IPilot } from '../types/pilot.types.js';
import { IMission } from '../types/mission.types.js';

export class ReportsView {
  private container: HTMLElement;
  private reports: IChatMessage[] = [];
  private activePilot: IPilot | null = null;
  private missionsList: IMission[] = [];
  private currentFilter: 'ALL' | 'PENDING' | 'VALIDATED' = 'ALL';
  private abortController: AbortController = new AbortController();
  private expandedCommentsMap: Map<string, IChatMessage[]> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">${localization.t('common.loading', 'CARREGANDO FEED DE RELATÓRIOS OMNINET...')}</div>
      </div>
    `;

    try {
      await this.loadInitialData();
      chatService.joinReports();
      this.renderContent();
      this.bindEvents();
      this.setupRealtime();
    } catch (err: any) {
      this.renderError(err.message || 'Falha ao carregar feed de relatórios.');
    }
  }

  private async loadInitialData() {
    // 1. Piloto do usuário
    try {
      const pRes = await pilotService.getMyPilots();
      this.activePilot =
        pRes.active_pilot ||
        pRes.pilots?.find((p: IPilot) => p.is_active && p.status === 'APPROVED') ||
        pRes.pilots?.[0] ||
        null;
    } catch {
      this.activePilot = null;
    }

    // 2. Missões para vincular no seletor
    try {
      const mRes = await missionService.getMissions();
      this.missionsList = mRes.missions || [];
    } catch {
      this.missionsList = [];
    }

    // 3. Relatórios
    await this.fetchReports();
  }

  private async fetchReports() {
    const filterParam = this.currentFilter === 'ALL' ? undefined : this.currentFilter;
    this.reports = await chatService.getReports({ filter: filterParam });
  }

  private setupRealtime() {
    chatService.onNewReport((newRep) => {
      if (!this.reports.some((r) => r._id === newRep._id)) {
        this.reports.unshift(newRep);
        this.renderContent();
        this.bindEvents();
        ToastService.info(`Novo Relatório de Missão emitido por ${newRep.pilot_callsign || newRep.author_name}!`);
      }
    });

    chatService.onReportValidated((updatedRep) => {
      const idx = this.reports.findIndex((r) => r._id === updatedRep._id);
      if (idx !== -1) {
        this.reports[idx] = updatedRep;
        this.renderContent();
        this.bindEvents();
        ToastService.success(`Relatório de ${updatedRep.pilot_callsign || 'Piloto'} homologado pelo Mestre!`);
      }
    });

    chatService.onReportComment(async ({ reportId, comment }) => {
      if (this.expandedCommentsMap.has(reportId)) {
        const comments = this.expandedCommentsMap.get(reportId) || [];
        comments.push(comment);
        this.expandedCommentsMap.set(reportId, comments);
        this.renderContent();
        this.bindEvents();
      }
    });
  }

  private renderContent() {
    const user = authService.currentUser;
    const isGmOrAdmin = user?.role === 'GM' || user?.role === 'ADMIN';

    this.container.innerHTML = `
      <div class="reports-container">
        <!-- Header da Seção de Relatórios -->
        <div class="reports-header-bar">
          <div class="reports-header-info">
            <span class="reports-header-tag">${localization.t('reports.channel_tag', '// CANAL DE PÓS-AÇÃO')}</span>
            <h1 class="reports-header-title">
              <i class="mdi mdi-clipboard-text-outline"></i>
              <span>${localization.t('reports.title', 'FEED DE RELATÓRIOS DE MISSÃO')}</span>
            </h1>
            <p class="reports-header-desc">
              ${localization.t('reports.desc', 'Registro público das telemetrias de combate, avarias de chassi, ações de recesso e homologações do Mestre.')}
            </p>
          </div>

          <button type="button" id="btn-open-submit-modal" class="btn-submit-report" title="Submeter Relatório de Missão">
            <i class="mdi mdi-plus-box-outline"></i>
            <span>${localization.t('reports.new_report', 'SUBMETER NOVO RELATÓRIO')}</span>
          </button>
        </div>

        <!-- Filtros Rápidos -->
        <div class="reports-filter-bar">
          <button type="button" class="reports-filter-tab ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
            ${localization.t('reports.filter_all', 'TODOS OS RELATÓRIOS')} (${this.reports.length})
          </button>
          <button type="button" class="reports-filter-tab ${this.currentFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">
            <i class="mdi mdi-clock-outline"></i> ${localization.t('reports.filter_pending', 'AGUARDANDO HOMOLOGAÇÃO')}
          </button>
          <button type="button" class="reports-filter-tab ${this.currentFilter === 'VALIDATED' ? 'active' : ''}" data-filter="VALIDATED">
            <i class="mdi mdi-check-decagram"></i> ${localization.t('reports.filter_validated', 'HOMOLOGADOS PELO GM')}
          </button>
        </div>

        <!-- Feed de Relatórios -->
        <div class="reports-feed-grid">
          ${
            this.reports.length > 0
              ? this.reports.map((rep) => this.renderReportCard(rep, isGmOrAdmin)).join('')
              : `
            <div class="card reports-empty-card">
              <div class="reports-empty-icon"><i class="mdi mdi-clipboard-outline"></i></div>
              <h3 class="reports-empty-title">${localization.t('reports.no_reports_title', 'NENHUM RELATÓRIO REGISTRADO')}</h3>
              <p>${localization.t('reports.no_reports_desc', 'Nenhum relatório de missão foi arquivado ainda com os filtros atuais.')}</p>
            </div>
          `
          }
        </div>
      </div>

      <!-- Modal de Submissão de Relatório -->
      <div id="submit-report-modal" class="mission-chat-modal-overlay is-hidden">
        <div class="report-modal-box">
          <div class="mission-chat-header">
            <div class="mission-chat-title-group">
              <span class="mission-chat-sub">${localization.t('reports.modal_tag', '// TRANSMISSÃO DE PÓS-AÇÃO')}</span>
              <h2 class="mission-chat-title">${localization.t('reports.modal_title', 'SUBMETER RELATÓRIO DE MISSÃO')}</h2>
            </div>
            <button type="button" id="btn-close-submit-modal" class="mission-chat-close-btn" title="Fechar">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <form id="form-submit-report" class="report-modal-body">
            <!-- Piloto & Chassi Identificados -->
            <div class="report-live-preview-box">
              <div class="report-live-preview-title">${localization.t('reports.linked_data', '// DADOS VINCULADOS DO CHASSI ATIVO')}</div>
              <div class="report-active-pilot-info">
                <strong>Piloto:</strong> ${this.activePilot?.callsign || 'Sem Piloto'} 
                (${this.activePilot?.name || 'Não informado'}) — 
                <strong>Chassi:</strong> ${this.activePilot?.active_mech_name || 'Chassi Padrão'} 
                [${this.activePilot?.active_mech_frame || 'Everest'}]
              </div>
            </div>

            <!-- Seleção de Missão -->
            <div class="report-form-group">
              <label class="report-form-label">${localization.t('reports.linked_operation', 'OPERAÇÃO VINCULADA:')}</label>
              <select id="report-mission-select" class="report-form-select">
                <option value="">${localization.t('reports.select_free_mission', '-- Missão Livre / Sem Vínculo Específico --')}</option>
                ${this.missionsList
                  .map(
                    (m) => `
                  <option value="${m._id}">${m.title} [${m.contractor || 'GMS'}]</option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <!-- Ação de Recesso Escolhida -->
            <div class="report-form-group">
              <label class="report-form-label">${localization.t('reports.downtime_action', 'AÇÃO DE RECESSO ESCOLHIDA:')}</label>
              <input type="text" id="report-downtime-action" class="report-form-input" 
                placeholder="Ex: Aquisição de Recursos, Modificar Mecha, Treinamento..." required />
            </div>

            <!-- Resultado da Ação de Recesso -->
            <div class="report-form-group">
              <label class="report-form-label">${localization.t('reports.downtime_result', 'RESULTADO DO DADO & RECURSO OBTIDO:')}</label>
              <input type="text" id="report-downtime-result" class="report-form-input" 
                placeholder="Ex: Sucesso Total (Rolagem 21) - Obtido Recurso 'Contatos no Subsolo'" required />
            </div>

            <!-- Observações & Avarias -->
            <div class="report-form-group">
              <label class="report-form-label">${localization.t('reports.damaged_notes', 'OBSERVAÇÕES ADICIONAIS & REPAROS:')}</label>
              <textarea id="report-notes" class="report-form-textarea" 
                placeholder="Descreva que itens foram destruídos, reparos gastos ou eventos narrativos marcantes..."></textarea>
            </div>

            <div class="report-modal-actions">
              <button type="button" id="btn-cancel-submit-modal" class="btn btn-secondary">${localization.t('common.cancel', 'CANCELAR')}</button>
              <button type="submit" class="btn btn-primary">
                <i class="mdi mdi-send"></i>
                <span>${localization.t('reports.publish_feed', 'PUBLICAR NO FEED')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderReportCard(rep: IChatMessage, isGmOrAdmin: boolean): string {
    const rd = rep.report_data;
    const authorUser = typeof rep.author_id === 'object' ? rep.author_id : null;
    const avatar = rep.author_avatar || (authorUser as any)?.avatar || '';
    const mission = typeof rep.mission_id === 'object' ? (rep.mission_id as any) : null;
    const dateFormatted = new Date(rep.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isPending = !rd?.is_validated_by_gm;
    const comments = this.expandedCommentsMap.get(rep._id) || [];
    const isCommentsOpen = this.expandedCommentsMap.has(rep._id);

    return `
      <div class="report-card" data-report-id="${rep._id}">
        <!-- Topo do Card -->
        <div class="report-card-header">
          <div class="report-author-block">
            ${
              avatar
                ? `<img src="${avatar}" alt="${rep.pilot_callsign || rep.author_name}" class="report-author-avatar" />`
                : `<div class="report-author-avatar"><i class="mdi mdi-account-circle"></i></div>`
            }
            <div class="report-author-details">
              <div class="report-author-name-line">
                <strong class="report-author-callsign">${rep.pilot_callsign || rep.author_name}</strong>
                ${rd?.pilot_name ? `<span class="report-pilot-civil-name">(${rd.pilot_name})</span>` : ''}
                <span class="report-mech-badge">// CHASSI: ${rd?.mech_name || 'Mecha'}</span>
              </div>
              <div class="report-transmission-sub">
                TRANSMISSÃO: ${dateFormatted} 
                ${mission ? `— MISSÃO: <strong class="report-mission-highlight">${mission.title}</strong>` : ''}
              </div>
            </div>
          </div>

          <!-- Carimbo de Homologação -->
          <div>
            ${
              isPending
                ? `<span class="report-stamp report-stamp-pending"><i class="mdi mdi-clock-outline"></i> ${localization.t('reports.awaiting_gm', 'AGUARDANDO GM')}</span>`
                : `<span class="report-stamp report-stamp-validated"><i class="mdi mdi-check-decagram"></i> ${localization.t('reports.gm_approved', 'HOMOLOGADO // RECURSO CONCEDIDO')}</span>`
            }
          </div>
        </div>

        <!-- Mini-Grid de Vitais do Mecha -->
        ${
          rd
            ? `
          <div class="report-vitals-strip">
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.hp', 'PONTOS DE VIDA')}</span>
              <span class="report-vital-value ${rd.current_hp < rd.max_hp ? 'vital-damaged' : ''}">${rd.current_hp} / ${rd.max_hp} PV</span>
            </div>
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.structure', 'ESTRUTURA')}</span>
              <span class="report-vital-value ${rd.current_structure < 4 ? 'vital-damaged' : ''}">${rd.current_structure} / 4</span>
            </div>
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.stress', 'ESTRESSE REATOR')}</span>
              <span class="report-vital-value ${rd.current_stress < 4 ? 'vital-damaged' : ''}">${rd.current_stress} / 4</span>
            </div>
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.heat', 'CALOR')}</span>
              <span class="report-vital-value">${rd.current_heat} / ${rd.total_heat}</span>
            </div>
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.repairs', 'REPAROS DE CAMPO')}</span>
              <span class="report-vital-value">${rd.current_repairs} / ${rd.max_repairs}</span>
            </div>
            <div class="report-vital-item">
              <span class="report-vital-label">${localization.t('reports.core_power', 'PODER DE NÚCLEO')}</span>
              <span class="report-vital-value">${rd.core_power_used ? localization.t('sheet.core_power_used', 'UTILIZADO [0/1]') : localization.t('sheet.core_power_ready', 'DISPONÍVEL [1/1]')}</span>
            </div>
          </div>
        `
            : ''
        }

        <!-- Seção de Recesso -->
        <div class="report-downtime-section">
          <div class="report-downtime-title">
            <i class="mdi mdi-dice-multiple-outline"></i>
            <span>${localization.t('reports.downtime_action', 'AÇÃO DE RECESSO:')} ${rd?.downtime_action || 'Não especificada'}</span>
          </div>
          <div class="report-downtime-content">
            <strong>Resultado:</strong> 
            <span class="report-downtime-result">${rd?.downtime_result || 'Sem resultado anotado'}</span>
          </div>
          ${
            rd?.damaged_notes
              ? `
            <div class="report-damaged-notes">
              <strong>Observações / Avarias:</strong> ${rd.damaged_notes}
            </div>
          `
              : ''
          }
        </div>

        <!-- Se já homologado, exibe a nota do GM -->
        ${
          !isPending && rd?.gm_notes
            ? `
          <div class="report-gm-dispatch-box">
            <i class="mdi mdi-check-circle-outline"></i> 
            <strong>${localization.t('reports.gm_dispatch', 'DESPACHO DO MESTRE')} (${rd.validated_by_name || 'GM'}):</strong> ${rd.gm_notes}
          </div>
        `
            : ''
        }

        <!-- Barra de Ações do Rodapé -->
        <div class="report-gm-actions-bar">
          <button type="button" class="btn-toggle-comments btn btn-secondary" data-report-id="${rep._id}">
            <i class="mdi mdi-comment-text-multiple-outline"></i>
            <span>${isCommentsOpen ? localization.t('reports.hide_comments', 'OCULTAR COMENTÁRIOS') : localization.t('reports.comments', 'DEBATE / COMENTÁRIOS')} (${comments.length})</span>
          </button>

          <!-- Ação do GM para homologar -->
          ${
            isPending && isGmOrAdmin
              ? `
            <button type="button" class="btn-validate-downtime" data-report-id="${rep._id}" title="Homologar Recesso e Conceder Recursos">
              <i class="mdi mdi-check"></i>
              <span>${localization.t('reports.validate_downtime', 'HOMOLOGAR RECESSO')}</span>
            </button>
          `
              : ''
          }
        </div>

        <!-- Thread de Comentários (se expandida) -->
        ${
          isCommentsOpen
            ? `
          <div class="report-comments-box">
            <div class="report-comments-title">${localization.t('reports.comments_title', '// DISCUSSÃO OPERACIONAL DE DEBRIEFING')}</div>
            <div class="report-comments-list">
              ${
                comments.length > 0
                  ? comments
                      .map(
                        (c) => `
                    <div class="report-comment-item">
                      <div class="report-comment-meta">
                        <strong class="report-comment-author">${c.pilot_callsign || c.author_name} [${c.author_role}]</strong>
                        <span>${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div class="report-comment-text">${c.content}</div>
                    </div>
                  `
                      )
                      .join('')
                  : `<div class="report-comments-empty">${localization.t('reports.no_comments', 'Nenhum comentário ainda neste relatório.')}</div>`
              }
            </div>

            <!-- Input de Comentário -->
            <div class="report-comment-input-row">
              <input type="text" class="input-report-comment" data-report-id="${rep._id}" placeholder="${localization.t('reports.write_comment', 'Escrever comentário...')}" />
              <button type="button" class="btn-send-report-comment btn btn-primary" data-report-id="${rep._id}">
                ${localization.t('reports.send', 'ENVIAR')}
              </button>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private bindEvents() {
    this.abortController.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Filtros
    this.container.querySelectorAll<HTMLButtonElement>('.reports-filter-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        const f = tab.dataset.filter as any;
        if (f) {
          this.currentFilter = f;
          await this.fetchReports();
          this.renderContent();
          this.bindEvents();
        }
      }, { signal });
    });

    // Abrir Modal de Submissão
    const openModalBtn = this.container.querySelector('#btn-open-submit-modal');
    const modalEl = this.container.querySelector('#submit-report-modal') as HTMLElement;
    openModalBtn?.addEventListener('click', () => {
      if (modalEl) modalEl.classList.remove('is-hidden');
    }, { signal });

    // Fechar Modal
    const closeModalBtn = this.container.querySelector('#btn-close-submit-modal');
    const cancelModalBtn = this.container.querySelector('#btn-cancel-submit-modal');
    closeModalBtn?.addEventListener('click', () => {
      if (modalEl) modalEl.classList.add('is-hidden');
    }, { signal });
    cancelModalBtn?.addEventListener('click', () => {
      if (modalEl) modalEl.classList.add('is-hidden');
    }, { signal });

    // Submissão do Formulário
    const form = this.container.querySelector('#form-submit-report') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const missionSelect = this.container.querySelector('#report-mission-select') as HTMLSelectElement;
      const actionInput = this.container.querySelector('#report-downtime-action') as HTMLInputElement;
      const resultInput = this.container.querySelector('#report-downtime-result') as HTMLInputElement;
      const notesInput = this.container.querySelector('#report-notes') as HTMLTextAreaElement;

      // Puxa o estado atual do combat tracker do localStorage se houver
      let storedCombat: any = null;
      if (this.activePilot?._id) {
        try {
          const raw = localStorage.getItem(`lancer_combat_${this.activePilot._id}`);
          if (raw) storedCombat = JSON.parse(raw);
        } catch {}
      }

      const reportPayload: IReportData = {
        pilot_name: this.activePilot?.name || '',
        pilot_callsign: this.activePilot?.callsign || 'Piloto da Guilda',
        mech_name: this.activePilot?.active_mech_name || this.activePilot?.active_mech_frame || 'Chassi Não Identificado',
        current_hp: storedCombat?.currentHp !== undefined ? storedCombat.currentHp : 10,
        max_hp: 10 + (this.activePilot?.hull || 0) * 2 + (this.activePilot?.grit || 0),
        current_structure: storedCombat?.currentStructure !== undefined ? storedCombat.currentStructure : 4,
        current_heat: storedCombat?.currentHeat !== undefined ? storedCombat.currentHeat : 0,
        total_heat: 6 + (this.activePilot?.engineering || 0),
        current_stress: storedCombat?.currentStress !== undefined ? storedCombat.currentStress : 4,
        current_repairs: storedCombat?.currentRepairs !== undefined ? storedCombat.currentRepairs : 4,
        max_repairs: 4 + Math.floor((this.activePilot?.hull || 0) / 2),
        core_power_used: Boolean(storedCombat?.corePowerUsed),
        downtime_action: actionInput.value.trim(),
        downtime_result: resultInput.value.trim(),
        damaged_notes: notesInput.value.trim()
      };

      try {
        await chatService.submitReport({
          mission_id: missionSelect.value || undefined,
          report_data: reportPayload,
          content: `Relatório de Missão emitido por ${reportPayload.pilot_callsign}`
        });

        ToastService.success('Relatório de Missão publicado com sucesso no Omninet!');
        if (modalEl) modalEl.classList.add('is-hidden');
        form.reset();
        await this.fetchReports();
        this.renderContent();
        this.bindEvents();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao submeter relatório.');
      }
    }, { signal });

    // Homologar Recesso pelo GM
    this.container.querySelectorAll<HTMLButtonElement>('.btn-validate-downtime').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const repId = btn.dataset.reportId;
        if (!repId) return;

        const gmNotes = prompt('Informe a nota de homologação ou recurso oficial concedido para a Ação de Recesso:');
        if (gmNotes !== null) {
          try {
            await chatService.validateReport(repId, gmNotes.trim());
            ToastService.success('Recesso homologado e recurso concedido com sucesso!');
            await this.fetchReports();
            this.renderContent();
            this.bindEvents();
          } catch (err: any) {
            ToastService.error(err.message || 'Falha ao homologar recesso.');
          }
        }
      }, { signal });
    });

    // Expandir / Ocultar Comentários
    this.container.querySelectorAll<HTMLButtonElement>('.btn-toggle-comments').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const repId = btn.dataset.reportId;
        if (!repId) return;

        if (this.expandedCommentsMap.has(repId)) {
          this.expandedCommentsMap.delete(repId);
        } else {
          const comments = await chatService.getReportComments(repId);
          this.expandedCommentsMap.set(repId, comments);
        }
        this.renderContent();
        this.bindEvents();
      }, { signal });
    });

    // Enviar Comentário
    this.container.querySelectorAll<HTMLButtonElement>('.btn-send-report-comment').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const repId = btn.dataset.reportId;
        if (!repId) return;

        const input = this.container.querySelector(`.input-report-comment[data-report-id="${repId}"]`) as HTMLInputElement;
        const content = input?.value?.trim();
        if (!content) return;

        try {
          const newComment = await chatService.addReportComment(repId, content);
          const list = this.expandedCommentsMap.get(repId) || [];
          list.push(newComment);
          this.expandedCommentsMap.set(repId, list);
          this.renderContent();
          this.bindEvents();
        } catch (err: any) {
          ToastService.error(err.message || 'Falha ao enviar comentário.');
        }
      }, { signal });
    });
  }

  private renderError(msg: string) {
    this.container.innerHTML = `
      <div class="sheet-error-container">
        <div class="sheet-error-icon">
          <i class="mdi mdi-alert-octagon-outline"></i>
        </div>
        <h2 class="sheet-error-title">FALHA AO ACESSAR FEED DE RELATÓRIOS</h2>
        <p class="sheet-error-msg">${msg}</p>
        <a href="#/missions" class="btn btn-secondary">
          <i class="mdi mdi-arrow-left"></i>
          <span>VOLTAR ÀS MISSÕES</span>
        </a>
      </div>
    `;
  }
}
