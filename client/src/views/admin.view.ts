import { adminService, IAdminUser, IAdminUsersResponse } from '../services/admin.service.js';
import { authService } from '../services/auth.service.js';
import { localization } from '../services/localization.service.js';
import { ToastService } from '../components/toast.js';
import { UserRole } from '../types/user.types.js';
import { escapeHtml } from '../utils/security.js';

export class AdminView {
  private container: HTMLElement;
  private users: IAdminUser[] = [];
  private stats: IAdminUsersResponse['stats'] | null = null;
  private currentFilter: string = 'ALL';
  private searchKeyword: string = '';
  private editingUser: IAdminUser | null = null;
  private deletingUser: IAdminUser | null = null;
  private deleteConfirmInput: string = '';
  private deleteCheckConfirmed: boolean = false;
  private isProcessing: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render() {
    if (!authService.isAdmin) {
      this.renderAccessDenied();
      return;
    }

    this.container.innerHTML = `
      <div class="sheet-loading-container">
        <div class="sheet-loading-spinner"></div>
        <div class="sheet-loading-text">${localization.t('common.loading', 'CARREGANDO DIRETÓRIO DE OPERADORES...')}</div>
      </div>
    `;

    try {
      await this.loadData();
      this.renderContent();
      this.bindEvents();
    } catch (err: any) {
      this.renderError(err.message || 'Falha ao carregar registros administrativos.');
    }
  }

  private async loadData() {
    const res = await adminService.getUsers({
      search: this.searchKeyword,
      role: this.currentFilter !== 'ALL' ? this.currentFilter : undefined
    });
    this.users = res.users || [];
    this.stats = res.stats;
  }

  private renderAccessDenied() {
    this.container.innerHTML = `
      <div class="admin-container">
        <div class="admin-empty-state">
          <i class="mdi mdi-shield-lock-outline admin-empty-icon"></i>
          <h2>${localization.t('nav.restricted', 'ACESSO RESTRITO')}</h2>
          <p>${localization.t('admin.access_denied', 'Este terminal de auditoria e controle de cargos requer credenciais de nível ADMINISTRADOR.')}</p>
          <a href="#/hangar" class="admin-btn-action">
            <i class="mdi mdi-arrow-left"></i>
            <span>${localization.t('common.back', 'RETORNAR AO HANGAR')}</span>
          </a>
        </div>
      </div>
    `;
  }

  private renderError(message: string) {
    this.container.innerHTML = `
      <div class="admin-container">
        <div class="admin-empty-state">
          <i class="mdi mdi-alert-circle-outline admin-empty-icon"></i>
          <h2>${localization.t('common.error', 'ERRO OPERACIONAL')}</h2>
          <p>${message}</p>
          <button id="btn-admin-retry" type="button" class="admin-btn-action">
            <i class="mdi mdi-refresh"></i>
            <span>TENTAR NOVAMENTE</span>
          </button>
        </div>
      </div>
    `;
    this.container.querySelector('#btn-admin-retry')?.addEventListener('click', () => this.render());
  }

  private renderContent() {
    const stats = this.stats || {
      total: this.users.length,
      admins: 0,
      gms: 0,
      avaliadores: 0,
      pilots: 0
    };

    this.container.innerHTML = `
      <div class="admin-container">
        <!-- Header do Terminal de Administração -->
        <div class="admin-header-bar">
          <div class="admin-title-group">
            <div class="admin-header-icon">
              <i class="mdi mdi-shield-account"></i>
            </div>
            <div>
              <div class="admin-tagline">${localization.t('admin.tagline', '// TERMINAL DE AUDITORIA & GESTÃO DA GUILDA // COMP/CON V3')}</div>
              <h1 class="admin-main-title">${localization.t('admin.title', 'ADMINISTRAÇÃO // DIRETÓRIO DE OPERADORES')}</h1>
              <div class="admin-subtitle">
                ${localization.t('admin.subtitle', 'Gestão centralizada de cargos táticos, permissões da Omninet e perfis dos membros da Guilda LANCER.')}
              </div>
            </div>
          </div>
        </div>

        <!-- Grade de Estatísticas / Telemetria -->
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <span class="admin-stat-label">${localization.t('admin.stat_total', 'TOTAL DE OPERADORES')}</span>
            <span class="admin-stat-value">${stats.total}</span>
          </div>
          <div class="admin-stat-card stat-admin">
            <span class="admin-stat-label">${localization.t('admin.stat_admins', 'ADMINISTRADORES')}</span>
            <span class="admin-stat-value">${stats.admins}</span>
          </div>
          <div class="admin-stat-card stat-gm">
            <span class="admin-stat-label">${localization.t('admin.stat_gms', 'MESTRES (GM)')}</span>
            <span class="admin-stat-value">${stats.gms}</span>
          </div>
          <div class="admin-stat-card stat-avaliador">
            <span class="admin-stat-label">${localization.t('admin.stat_avaliadores', 'AVALIADORES')}</span>
            <span class="admin-stat-value">${stats.avaliadores}</span>
          </div>
          <div class="admin-stat-card stat-pilot">
            <span class="admin-stat-label">${localization.t('admin.stat_pilots', 'PILOTOS')}</span>
            <span class="admin-stat-value">${stats.pilots}</span>
          </div>
        </div>

        <!-- Barra de Controle: Busca e Filtros -->
        <div class="admin-controls-bar">
          <div class="admin-search-wrapper">
            <i class="mdi mdi-magnify admin-search-icon"></i>
            <input type="text"
                   id="admin-search-input"
                   class="admin-search-input"
                   placeholder="${localization.t('admin.search_placeholder', 'Buscar por nome, @username, Discord ID ou callsign...')}"
                   value="${this.escapeHtml(this.searchKeyword)}" />
          </div>

          <div class="admin-filter-tabs">
            <button type="button" class="admin-filter-btn ${this.currentFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
              ${localization.t('admin.filter_all', 'TODOS')} (${stats.total})
            </button>
            <button type="button" class="admin-filter-btn ${this.currentFilter === 'ADMIN' ? 'active' : ''}" data-filter="ADMIN">
              ${localization.t('admin.filter_admin', 'ADMIN')} (${stats.admins})
            </button>
            <button type="button" class="admin-filter-btn ${this.currentFilter === 'GM' ? 'active' : ''}" data-filter="GM">
              ${localization.t('admin.filter_gm', 'MESTRES')} (${stats.gms})
            </button>
            <button type="button" class="admin-filter-btn ${this.currentFilter === 'AVALIADOR' ? 'active' : ''}" data-filter="AVALIADOR">
              ${localization.t('admin.filter_avaliador', 'AVALIADORES')} (${stats.avaliadores})
            </button>
            <button type="button" class="admin-filter-btn ${this.currentFilter === 'PILOT' ? 'active' : ''}" data-filter="PILOT">
              ${localization.t('admin.filter_pilot', 'PILOTOS')} (${stats.pilots})
            </button>
          </div>
        </div>

        <!-- Tabela de Usuários -->
        <div class="admin-table-container">
          ${
            this.users.length === 0
              ? `
            <div class="admin-empty-state">
              <i class="mdi mdi-account-search-outline admin-empty-icon"></i>
              <p>${localization.t('admin.empty', 'Nenhum operador localizado com os filtros selecionados.')}</p>
            </div>
          `
              : `
            <table class="admin-users-table">
              <thead>
                <tr>
                  <th>${localization.t('admin.th_operator', 'OPERADOR')}</th>
                  <th>${localization.t('admin.th_discord_id', 'DISCORD ID')}</th>
                  <th>${localization.t('admin.th_roles', 'CARGOS ATIVOS')}</th>
                  <th>${localization.t('admin.th_hangar', 'HANGAR / PILOTOS')}</th>
                  <th>${localization.t('admin.th_actions', 'AÇÕES TÁTICAS')}</th>
                </tr>
              </thead>
              <tbody>
                ${this.users.map((u) => this.renderUserRow(u)).join('')}
              </tbody>
            </table>
          `
          }
        </div>

        <!-- Modal de Edição de Perfil (renderizado se editingUser !== null) -->
        ${this.editingUser ? this.renderEditProfileModal(this.editingUser) : ''}

        <!-- Modal de Exclusão com Dupla Confirmação -->
        ${this.deletingUser ? this.renderDeleteUserModal(this.deletingUser) : ''}
      </div>
    `;
  }

  private renderUserRow(user: IAdminUser): string {
    const roles = user.roles && user.roles.length > 0 ? user.roles : [user.role || 'PILOT'];
    const avatar = user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const isSelf = authService.currentUser?._id === user._id;

    const hasPilot = roles.includes('PILOT');
    const hasAvaliador = roles.includes('AVALIADOR');
    const hasGM = roles.includes('GM');
    const hasAdmin = roles.includes('ADMIN');

    const pilotsListHtml =
      user.pilots && user.pilots.length > 0
        ? user.pilots
            .map(
              (p) => `
            <span class="admin-pilot-tag ${p.is_active ? 'pilot-active' : ''}" title="${p.active_mech_name ? `Chassi: ${p.active_mech_name}` : 'Sem chassi ativo'}">
              <i class="mdi ${p.is_active ? 'mdi-check-circle-outline' : 'mdi-robot-outline'}"></i>
              ${this.escapeHtml(p.callsign)} (LL${p.license_level})
            </span>
          `
            )
            .join('')
        : `<span class="admin-pilot-empty">${localization.t('admin.no_pilots', 'Nenhum piloto registrado')}</span>`;

    return `
      <tr data-user-id="${user._id}">
        <!-- Operador -->
        <td>
          <div class="admin-user-cell">
            <img src="${avatar}" alt="${this.escapeHtml(user.username)}" class="admin-user-avatar" loading="lazy" />
            <div class="admin-user-info-text">
              <div class="admin-user-name-line">
                <span class="admin-user-name">${this.escapeHtml(user.name || user.username)}</span>
                ${user.nickname ? `<span class="admin-user-nickname">${this.escapeHtml(user.nickname)}</span>` : ''}
              </div>
              <span class="admin-user-username">@${this.escapeHtml(user.username)}</span>
            </div>
          </div>
        </td>

        <!-- Discord ID -->
        <td>
          <span class="admin-discord-id-badge">${user.discord_id}</span>
        </td>

        <!-- Gerenciador Multi-Roles -->
        <td>
          <div class="admin-roles-manager" data-user-id="${user._id}">
            <label class="admin-role-chip ${hasPilot ? 'active-pilot' : ''}">
              <input type="checkbox"
                     class="admin-role-checkbox"
                     data-role="PILOT"
                     data-user-id="${user._id}"
                     ${hasPilot ? 'checked' : ''} />
              <span>PILOTO</span>
            </label>

            <label class="admin-role-chip ${hasAvaliador ? 'active-avaliador' : ''}">
              <input type="checkbox"
                     class="admin-role-checkbox"
                     data-role="AVALIADOR"
                     data-user-id="${user._id}"
                     ${hasAvaliador ? 'checked' : ''} />
              <span>AVALIADOR</span>
            </label>

            <label class="admin-role-chip ${hasGM ? 'active-gm' : ''}">
              <input type="checkbox"
                     class="admin-role-checkbox"
                     data-role="GM"
                     data-user-id="${user._id}"
                     ${hasGM ? 'checked' : ''} />
              <span>MESTRE</span>
            </label>

            <label class="admin-role-chip ${hasAdmin ? 'active-admin' : ''}">
              <input type="checkbox"
                     class="admin-role-checkbox"
                     data-role="ADMIN"
                     data-user-id="${user._id}"
                     ${hasAdmin ? 'checked' : ''} />
              <span>ADMIN</span>
            </label>
          </div>
        </td>

        <!-- Hangar / Pilotos -->
        <td>
          <div class="admin-pilots-list">
            ${pilotsListHtml}
          </div>
        </td>

        <!-- Ações -->
        <td>
          <div class="admin-actions-cell">
            <button type="button"
                    class="admin-btn-action btn-edit-profile"
                    data-user-id="${user._id}"
                    title="${localization.t('admin.edit_profile', 'Editar perfil')}">
              <i class="mdi mdi-account-edit-outline"></i>
              <span>${localization.t('common.edit', 'EDITAR')}</span>
            </button>
            ${
              !isSelf
                ? `
              <button type="button"
                      class="admin-btn-delete btn-delete-user"
                      data-user-id="${user._id}"
                      title="${localization.t('admin.delete_user', 'Excluir operador com dupla confirmação')}">
                <i class="mdi mdi-trash-can-outline"></i>
                <span>${localization.t('common.delete', 'EXCLUIR')}</span>
              </button>
            `
                : ''
            }
          </div>
        </td>
      </tr>
    `;
  }

  private renderEditProfileModal(user: IAdminUser): string {
    return `
      <div class="admin-modal-backdrop" id="admin-modal-backdrop">
        <div class="admin-modal-dialog">
          <div class="admin-modal-header">
            <h3 class="admin-modal-title">
              <i class="mdi mdi-account-cog-outline"></i>
              ${localization.t('admin.modal_edit_title', 'EDITAR PERFIL DO OPERADOR')}
            </h3>
            <button type="button" class="admin-modal-close-btn" id="btn-close-modal">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <form id="form-edit-profile" class="admin-modal-body">
            <div class="admin-form-group">
              <label class="admin-form-label">${localization.t('admin.modal_name_label', 'NOME DE EXIBIÇÃO')}</label>
              <input type="text"
                     id="modal-input-name"
                     class="admin-form-input"
                     value="${this.escapeHtml(user.name || '')}"
                     required />
            </div>

            <div class="admin-form-group">
              <label class="admin-form-label">${localization.t('admin.modal_nick_label', 'APELIDO TÁTICO (NICKNAME)')}</label>
              <input type="text"
                     id="modal-input-nickname"
                     class="admin-form-input"
                     value="${this.escapeHtml(user.nickname || '')}"
                     placeholder="Ex: Maverick, Corvo, Zero" />
            </div>

            <div class="admin-modal-footer">
              <button type="button" id="btn-cancel-modal" class="admin-btn-secondary">
                ${localization.t('common.cancel', 'CANCELAR')}
              </button>
              <button type="submit" id="btn-save-profile" class="admin-btn-primary">
                <i class="mdi mdi-content-save-outline"></i>
                ${localization.t('admin.modal_save', 'SALVAR PERFIL')}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderDeleteUserModal(user: IAdminUser): string {
    const expectedCode = `@${user.username}`;
    const isMatch = this.deleteConfirmInput === expectedCode;
    const canSubmit = isMatch && this.deleteCheckConfirmed;

    return `
      <div class="admin-modal-backdrop" id="admin-delete-backdrop">
        <div class="admin-modal-dialog admin-modal-danger">
          <div class="admin-modal-header">
            <h3 class="admin-modal-title">
              <i class="mdi mdi-alert-octagon"></i>
              PROTOCOLO DE PURGA // EXCLUSÃO PERMANENTE
            </h3>
            <button type="button" class="admin-modal-close-btn" id="btn-close-delete-modal">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <form id="form-delete-user" class="admin-modal-body">
            <div class="admin-danger-banner">
              <i class="mdi mdi-alert-circle-outline admin-danger-banner-icon"></i>
              <div class="admin-danger-banner-text">
                <strong>ATENÇÃO: AÇÃO IRREVERSÍVEL!</strong><br />
                A exclusão de <strong>@${this.escapeHtml(user.username)}</strong> (${this.escapeHtml(user.name || 'Sem nome')}) irá expurgar definitivamente o operador e todos os <strong>${user.pilots?.length || 0} pilotos e chassis</strong> associados ao seu Hangar.
              </div>
            </div>

            <!-- Etapa 1 da Confirmação Dupla: Digitar o @username -->
            <div class="admin-form-group">
              <label class="admin-form-label">
                1. Digite exatamente <span class="admin-danger-code">${this.escapeHtml(expectedCode)}</span> para confirmar:
              </label>
              <input type="text"
                     id="input-delete-confirm"
                     class="admin-form-input"
                     placeholder="${this.escapeHtml(expectedCode)}"
                     value="${this.escapeHtml(this.deleteConfirmInput)}"
                     autocomplete="off"
                     required />
            </div>

            <!-- Etapa 2 da Confirmação Dupla: Checkbox de ciência -->
            <label class="admin-confirm-check-label">
              <input type="checkbox"
                     id="check-delete-confirm"
                     ${this.deleteCheckConfirmed ? 'checked' : ''} />
              <span>2. Estou ciente de que esta purga é permanente e removerá todas as fichas associadas da Omninet.</span>
            </label>

            <div class="admin-modal-footer">
              <button type="button" id="btn-cancel-delete" class="admin-btn-secondary">
                ${localization.t('common.cancel', 'CANCELAR')}
              </button>
              <button type="submit"
                     id="btn-confirm-purge"
                     class="admin-btn-danger-confirm"
                     ${!canSubmit ? 'disabled' : ''}>
                <i class="mdi mdi-skull-crossbones"></i>
                <span>CONFIRMAR EXPURGO DEFINITIVO</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    // 1. Busca por texto (com debounce)
    const searchInput = this.container.querySelector('#admin-search-input') as HTMLInputElement;
    let debounceTimer: any;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        this.searchKeyword = searchInput.value.trim();
        await this.loadData();
        this.renderContent();
        this.bindEvents();
      }, 350);
    });

    // 2. Filtros de Role
    const filterBtns = this.container.querySelectorAll('.admin-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const filter = target.getAttribute('data-filter') || 'ALL';
        if (this.currentFilter === filter) return;
        this.currentFilter = filter;
        await this.loadData();
        this.renderContent();
        this.bindEvents();
      });
    });

    // 3. Checkboxes de Roles em Tempo Real
    const checkboxes = this.container.querySelectorAll('.admin-role-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', async (e) => {
        if (this.isProcessing) return;
        const target = e.target as HTMLInputElement;
        const userId = target.getAttribute('data-user-id');
        if (!userId) return;

        const rowManager = this.container.querySelector(`.admin-roles-manager[data-user-id="${userId}"]`);
        if (!rowManager) return;

        const checkedBoxes = rowManager.querySelectorAll('.admin-role-checkbox:checked') as NodeListOf<HTMLInputElement>;
        const newRoles = Array.from(checkedBoxes).map((c) => c.getAttribute('data-role') as UserRole);

        if (newRoles.length === 0) {
          ToastService.error('O operador deve possuir ao menos um cargo ativo.');
          target.checked = true;
          return;
        }

        try {
          this.isProcessing = true;
          const res = await adminService.updateUserRoles(userId, newRoles);
          ToastService.success(res.message || 'Cargos atualizados com sucesso!');

          // Atualiza dados locais
          const u = this.users.find((user) => user._id === userId);
          if (u) {
            u.roles = newRoles;
            u.role = res.user.role;
          }

          await this.loadData();
          this.renderContent();
          this.bindEvents();
        } catch (err: any) {
          ToastService.error(err.message || 'Falha ao atualizar cargos.');
          target.checked = !target.checked;
        } finally {
          this.isProcessing = false;
        }
      });
    });

    // 4. Abertura do Modal de Edição de Perfil
    const editBtns = this.container.querySelectorAll('.btn-edit-profile');
    editBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const userId = target.getAttribute('data-user-id');
        const user = this.users.find((u) => u._id === userId);
        if (user) {
          this.editingUser = user;
          this.renderContent();
          this.bindEvents();
        }
      });
    });

    // 5. Fechamento e Envio do Modal de Perfil
    const closeModal = () => {
      this.editingUser = null;
      this.renderContent();
      this.bindEvents();
    };

    this.container.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
    this.container.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    const form = this.container.querySelector('#form-edit-profile') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.editingUser || this.isProcessing) return;

      const nameInput = this.container.querySelector('#modal-input-name') as HTMLInputElement;
      const nickInput = this.container.querySelector('#modal-input-nickname') as HTMLInputElement;

      const newName = nameInput?.value.trim();
      const newNick = nickInput?.value.trim();

      if (!newName) {
        ToastService.error('O nome de exibição é obrigatório.');
        return;
      }

      try {
        this.isProcessing = true;
        const res = await adminService.updateUserProfile(this.editingUser._id, {
          name: newName,
          nickname: newNick || ''
        });

        ToastService.success(res.message || 'Perfil atualizado com sucesso!');
        this.editingUser = null;
        await this.loadData();
        this.renderContent();
        this.bindEvents();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao atualizar perfil.');
      } finally {
        this.isProcessing = false;
      }
    });

    // 6. Abertura do Modal de Exclusão (Dupla Confirmação)
    const deleteBtns = this.container.querySelectorAll('.btn-delete-user');
    deleteBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const userId = target.getAttribute('data-user-id');
        const user = this.users.find((u) => u._id === userId);
        if (user) {
          this.deletingUser = user;
          this.deleteConfirmInput = '';
          this.deleteCheckConfirmed = false;
          this.renderContent();
          this.bindEvents();
        }
      });
    });

    // 7. Eventos do Modal de Exclusão
    const closeDeleteModal = () => {
      this.deletingUser = null;
      this.deleteConfirmInput = '';
      this.deleteCheckConfirmed = false;
      this.renderContent();
      this.bindEvents();
    };

    this.container.querySelector('#btn-close-delete-modal')?.addEventListener('click', closeDeleteModal);
    this.container.querySelector('#btn-cancel-delete')?.addEventListener('click', closeDeleteModal);

    const deleteInput = this.container.querySelector('#input-delete-confirm') as HTMLInputElement;
    const deleteCheck = this.container.querySelector('#check-delete-confirm') as HTMLInputElement;
    const deleteSubmitBtn = this.container.querySelector('#btn-confirm-purge') as HTMLButtonElement;

    const updateDeleteBtnState = () => {
      if (!this.deletingUser || !deleteSubmitBtn) return;
      const expected = `@${this.deletingUser.username}`;
      const isMatch = this.deleteConfirmInput === expected;
      const canSubmit = isMatch && this.deleteCheckConfirmed;
      deleteSubmitBtn.disabled = !canSubmit;
    };

    deleteInput?.addEventListener('input', () => {
      this.deleteConfirmInput = deleteInput.value.trim();
      updateDeleteBtnState();
    });

    deleteCheck?.addEventListener('change', () => {
      this.deleteCheckConfirmed = deleteCheck.checked;
      updateDeleteBtnState();
    });

    const deleteForm = this.container.querySelector('#form-delete-user') as HTMLFormElement;
    deleteForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.deletingUser || this.isProcessing) return;

      const expected = `@${this.deletingUser.username}`;
      if (this.deleteConfirmInput !== expected || !this.deleteCheckConfirmed) {
        ToastService.error('É necessário digitar o nome de usuário correto e confirmar a ciência dos riscos.');
        return;
      }

      try {
        this.isProcessing = true;
        const res = await adminService.deleteUser(this.deletingUser._id);
        ToastService.success(res.message || 'Operador expurgado com sucesso!');
        this.deletingUser = null;
        this.deleteConfirmInput = '';
        this.deleteCheckConfirmed = false;
        await this.loadData();
        this.renderContent();
        this.bindEvents();
      } catch (err: any) {
        ToastService.error(err.message || 'Falha ao excluir operador.');
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private escapeHtml(text: string): string {
    return escapeHtml(text);
  }
}
