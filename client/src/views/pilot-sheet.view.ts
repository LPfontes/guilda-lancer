import { pilotService } from '../services/pilot.service.js';
import { authService } from '../services/auth.service.js';
import { IPilot } from '../types/pilot.types.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { localization } from '../services/localization.service.js';
import { buildMissionReportText } from '../services/mission-report.helper.js';

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
  private syncRawData: string = '';
  private syncPreviewData: any = null;
  private isSyncing: boolean = false;
  private isDeleting: boolean = false;

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

    // Core Bonuses (lidos diretamente do COMP/CON persistido no banco)
    const rawCoreBonuses: any[] = raw?.core_bonuses || raw?.pilot?.core_bonuses || raw?.data?.core_bonuses || (p as any).core_bonuses || [];
    const coreBonuses = rawCoreBonuses.map((cb) => (typeof cb === 'string' ? { id: cb, name: cb, effect: '', description: '' } : cb));

    // Talentos do Piloto (mesclando p.talents com raw.talents para garantir dados de ranks e ações completas)
    const rawTalents: any[] = raw?.talents || [];
    this.resolvedTalents = (p.talents || []).map((pt: any) => {
      const rawMatch = rawTalents.find((rt: any) => rt.id === pt.id) || {};
      return {
        ...pt,
        data: rawMatch.data || pt.data || rawMatch
      };
    });

    const currentUser = authService.currentUser;
    const pilotUserId = typeof p.user_id === 'object' && p.user_id ? (p.user_id as any)._id : p.user_id;
    const isOwner = Boolean(currentUser?._id && pilotUserId && currentUser._id.toString() === pilotUserId.toString());
    const isAdmin = currentUser?.role === 'ADMIN';
    const canManage = isOwner || isAdmin;

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
            <button id="btn-pilot-aar" class="btn btn-secondary sheet-action-btn" title="Copiar Modelo Oficial de Relatório de Missão">
              <i class="mdi mdi-clipboard-text-outline"></i>
              <span>RELATÓRIO DE MISSÃO</span>
            </button>
            ${
              canManage
                ? `
              <button id="btn-sync-pilot" class="btn btn-secondary sheet-action-btn sheet-action-btn-sync" title="Sincronizar Dossiê com o COMP/CON">
                <i class="mdi mdi-cloud-sync-outline"></i>
                <span>SINCRONIZAR COMP/CON</span>
              </button>
              <button id="btn-delete-pilot" class="btn btn-secondary sheet-action-btn sheet-action-btn-danger" title="Excluir Ficha do Hangar">
                <i class="mdi mdi-delete-alert-outline"></i>
                <span>EXCLUIR FICHA</span>
              </button>
            `
                : ''
            }
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
                  <span class="core-bonus-type-tag">BÔNUS DE NÚCLEO</span>
                </div>
                <div class="sheet-trait-name">${name}</div>
                ${
                  effect
                    ? `
                  <div class="core-bonus-effect-box">
                    <div class="core-bonus-effect-label">EFEITO:</div>
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

        <!-- Modal de Sincronização COMP/CON -->
        <div id="sync-pilot-modal" class="import-modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="import-modal-box">
            <div class="import-modal-header">
              <div class="import-modal-title">
                ${getCompconIcon('hangar', 'compcon-icon')}
                <span>LNC://SYNC_MODULE.02 // SINCRONIZAÇÃO COMP/CON</span>
              </div>
              <button id="btn-close-sync-modal" class="import-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <div class="import-modal-body">
              ${
                p.share_code
                  ? `
                <div class="pilot-sync-current-badge">
                  <span class="pilot-sync-current-label">SHARE CODE VINCULADO:</span>
                  <span class="pilot-sync-current-code">${p.share_code}</span>
                  <button id="btn-sync-use-current" class="pilot-sync-btn-use-current" type="button">
                    <i class="mdi mdi-refresh"></i>
                    <span>PREENCHER CÓDIGO ATUAL</span>
                  </button>
                </div>
              `
                  : ''
              }

              <div class="import-instructions">
                Atualize o dossiê do piloto enviando o arquivo <code>.json</code> exportado do COMP/CON v3 ou informando o Share Code de 12 dígitos:
              </div>

              <!-- Dropzone para arquivo JSON -->
              <div id="sync-dropzone" class="import-dropzone">
                <i class="mdi mdi-file-upload-outline import-dropzone-icon"></i>
                <div class="import-dropzone-text">ARRASTE O ARQUIVO .JSON DO COMP/CON AQUI</div>
                <div class="import-dropzone-sub">ou clique para selecionar do dispositivo</div>
                <input id="sync-file-input" type="file" accept=".json,application/json" class="hidden-file-input" />
              </div>

              <!-- Entrada de Share Code com Caixas para Cada Dígito -->
              <div class="import-manual-section">
                <div class="sharecode-header-row">
                  <label class="import-label">INFORME O SHARE CODE DO COMP/CON (12 DÍGITOS):</label>
                  <button id="btn-sync-toggle-raw" class="btn-link-toggle" type="button">Alternar para JSON bruto</button>
                </div>

                <div class="sharecode-boxes-container" id="sync-sharecode-boxes">
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="0" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="1" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="2" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="3" autocomplete="off" spellcheck="false" />
                  </div>
                  <span class="sharecode-separator">-</span>
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="4" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="5" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="6" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="7" autocomplete="off" spellcheck="false" />
                  </div>
                  <span class="sharecode-separator">-</span>
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="8" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="9" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="10" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box sync-sharecode-box" data-index="11" autocomplete="off" spellcheck="false" />
                  </div>
                </div>

                <div id="sync-json-paste-wrapper" class="json-paste-wrapper hidden">
                  <textarea
                    id="sync-text-input"
                    class="import-textarea"
                    placeholder='Cole o JSON bruto aqui: {"callsign": "${callsign}", ...}'
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="import-action-row">
                <button id="btn-sync-validate-preview" class="btn btn-secondary" type="button">
                  <i class="mdi mdi-magnify-scan"></i>
                  <span>ANALISAR ATUALIZAÇÃO</span>
                </button>
              </div>

              <!-- Painel de Pré-Visualização / Preview da Ficha -->
              <div id="sync-preview-box" class="import-preview-box hidden">
                <div class="preview-header">
                  <span class="preview-tag">[ TELEMETRIA DETECTADA ]</span>
                  <span id="sync-preview-status-badge" class="preview-status-valid">FICHA VÁLIDA</span>
                </div>

                <div class="preview-grid">
                  <div class="preview-item">
                    <span class="preview-label">INDICATIVO (CALLSIGN):</span>
                    <span id="sync-preview-callsign" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">CHASSI / FRAME:</span>
                    <span id="sync-preview-frame" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">NÍVEL DE LICENÇA:</span>
                    <span id="sync-preview-ll" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">H.A.S.E.:</span>
                    <span id="sync-preview-hase" class="preview-value">-</span>
                  </div>
                </div>

                <div id="sync-preview-warnings-container" class="preview-warnings-box hidden"></div>

                <div class="preview-confirm-bar">
                  <button id="btn-confirm-sync" class="btn btn-primary" type="button">
                    <i class="mdi mdi-cloud-sync"></i>
                    <span>CONFIRMAR SINCRONIZAÇÃO</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal de Confirmação de Exclusão da Ficha -->
        <div id="delete-pilot-modal" class="pilot-delete-modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="pilot-delete-modal-box">
            <div class="pilot-delete-header">
              <div class="pilot-delete-title">
                <i class="mdi mdi-alert-octagon"></i>
                <span>[ALERTA TÁTICO] // DESMOBILIZAÇÃO DE PILOTO</span>
              </div>
              <button id="btn-close-delete-modal" class="import-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <div class="pilot-delete-body">
              ${
                p.active_mission_id
                  ? `
                <div class="pilot-delete-blocked-box">
                  <div class="pilot-delete-blocked-title">
                    <i class="mdi mdi-shield-alert"></i>
                    <span>MOBILIZAÇÃO ATIVA DETECTADA</span>
                  </div>
                  <div>
                    O piloto <strong>${callsign}</strong> está designado para uma missão ativa em andamento.
                    De acordo com os protocolos da guilda, a ficha não pode ser excluída ou desmobilizada enquanto a missão estiver em curso.
                  </div>
                </div>
                <div class="pilot-delete-footer">
                  <button id="btn-cancel-delete-modal" class="btn btn-secondary" type="button">
                    <span>FECHAR</span>
                  </button>
                </div>
              `
                  : `
                <div class="pilot-delete-warning-box">
                  <div class="pilot-delete-warning-title">
                    <i class="mdi mdi-alert-circle"></i>
                    <span>PROCEDIMENTO DE PURGA DEFINITIVA</span>
                  </div>
                  <div>
                    Você está prestes a desmobilizar permanentemente o operador <strong>${callsign}</strong> e todos os dados de chassi e licenças associados.
                    Esta operação removerá a ficha do hangar e não poderá ser desfeita.
                  </div>
                </div>

                <div class="pilot-delete-input-group">
                  <label class="pilot-delete-input-label" for="input-delete-callsign-confirm">
                    DIGITE O CALLSIGN <strong>${callsign}</strong> PARA AUTORIZAR A EXCLUSÃO:
                  </label>
                  <input
                    type="text"
                    id="input-delete-callsign-confirm"
                    class="pilot-delete-confirm-input"
                    placeholder="${callsign}"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </div>

                <div class="pilot-delete-footer">
                  <button id="btn-cancel-delete-modal" class="btn btn-secondary" type="button">
                    <span>CANCELAR</span>
                  </button>
                  <button id="btn-confirm-delete" class="btn-danger-confirm" type="button" disabled>
                    <i class="mdi mdi-delete-forever"></i>
                    <span>CONFIRMAR EXCLUSÃO</span>
                  </button>
                </div>
              `
              }
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

    const aarBtn = this.container.querySelector('#btn-pilot-aar');
    aarBtn?.addEventListener('click', async () => {
      if (this.pilotData) {
        const text = buildMissionReportText(this.pilotData);
        await navigator.clipboard.writeText(text);
        ToastService.success('Relatório de Missão do Piloto copiado para a área de transferência!');
      }
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

    // Botões de Abertura dos Modais de Sincronização e Exclusão
    const btnSyncPilot = this.container.querySelector('#btn-sync-pilot');
    btnSyncPilot?.addEventListener('click', () => this.openSyncModal());

    const btnCloseSyncModal = this.container.querySelector('#btn-close-sync-modal');
    btnCloseSyncModal?.addEventListener('click', () => this.closeSyncModal());

    const btnDeletePilot = this.container.querySelector('#btn-delete-pilot');
    btnDeletePilot?.addEventListener('click', () => this.openDeleteModal());

    const btnCloseDeleteModal = this.container.querySelector('#btn-close-delete-modal');
    btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());

    const btnCancelDeleteModal = this.container.querySelector('#btn-cancel-delete-modal');
    btnCancelDeleteModal?.addEventListener('click', () => this.closeDeleteModal());

    // Modal de Exclusão - Validação de Entrada
    const deleteConfirmInput = this.container.querySelector('#input-delete-callsign-confirm') as HTMLInputElement | null;
    const btnConfirmDelete = this.container.querySelector('#btn-confirm-delete') as HTMLButtonElement | null;
    deleteConfirmInput?.addEventListener('input', () => {
      const targetCallsign = (this.pilotData?.callsign || '').trim().toUpperCase();
      const entered = deleteConfirmInput.value.trim().toUpperCase();
      if (btnConfirmDelete) {
        btnConfirmDelete.disabled = entered !== targetCallsign;
      }
    });

    btnConfirmDelete?.addEventListener('click', () => this.handleConfirmDelete());

    // Modal de Sincronização - Dropzone de Arquivo JSON
    const syncDropzone = this.container.querySelector('#sync-dropzone');
    const syncFileInput = this.container.querySelector('#sync-file-input') as HTMLInputElement | null;
    syncDropzone?.addEventListener('click', () => syncFileInput?.click());
    syncDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      syncDropzone.classList.add('import-dropzone-active');
    });
    syncDropzone?.addEventListener('dragleave', () => {
      syncDropzone.classList.remove('import-dropzone-active');
    });
    syncDropzone?.addEventListener('drop', (e: any) => {
      e.preventDefault();
      syncDropzone.classList.remove('import-dropzone-active');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleSyncFileUpload(files[0]);
      }
    });

    syncFileInput?.addEventListener('change', () => {
      if (syncFileInput.files && syncFileInput.files.length > 0) {
        this.handleSyncFileUpload(syncFileInput.files[0]);
      }
    });

    // Modal de Sincronização - Preencher Share Code Atual
    const btnSyncUseCurrent = this.container.querySelector('#btn-sync-use-current');
    btnSyncUseCurrent?.addEventListener('click', () => {
      if (this.pilotData?.share_code) {
        this.fillSyncShareCode(this.pilotData.share_code);
      }
    });

    // Modal de Sincronização - Alternar para JSON Bruto
    const btnSyncToggleRaw = this.container.querySelector('#btn-sync-toggle-raw');
    const syncBoxesContainer = this.container.querySelector('#sync-sharecode-boxes');
    const syncJsonWrapper = this.container.querySelector('#sync-json-paste-wrapper');
    btnSyncToggleRaw?.addEventListener('click', () => {
      const isJsonVisible = !syncJsonWrapper?.classList.contains('hidden');
      if (isJsonVisible) {
        syncJsonWrapper?.classList.add('hidden');
        syncBoxesContainer?.classList.remove('hidden');
        btnSyncToggleRaw.textContent = 'Alternar para JSON bruto';
      } else {
        syncJsonWrapper?.classList.remove('hidden');
        syncBoxesContainer?.classList.add('hidden');
        btnSyncToggleRaw.textContent = 'Alternar para Share Code';
      }
    });

    // Modal de Sincronização - Botão de Análise e Confirmação
    const btnSyncValidate = this.container.querySelector('#btn-sync-validate-preview');
    btnSyncValidate?.addEventListener('click', () => this.handleSyncValidate());

    const btnConfirmSync = this.container.querySelector('#btn-confirm-sync');
    btnConfirmSync?.addEventListener('click', () => this.handleConfirmSync());

    // Modal de Sincronização - Caixas de Share Code
    this.bindSyncShareCodeBoxes();

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

    // Fechamento ao clicar fora nos overlays dos modais
    const talentModalOverlay = this.container.querySelector('#talent-modal');
    talentModalOverlay?.addEventListener('click', (e) => {
      if (e.target === talentModalOverlay) this.closeTalentModal();
    });

    const syncModalOverlay = this.container.querySelector('#sync-pilot-modal');
    syncModalOverlay?.addEventListener('click', (e) => {
      if (e.target === syncModalOverlay) this.closeSyncModal();
    });

    const deleteModalOverlay = this.container.querySelector('#delete-pilot-modal');
    deleteModalOverlay?.addEventListener('click', (e) => {
      if (e.target === deleteModalOverlay) this.closeDeleteModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeTalentModal();
        this.closeSyncModal();
        this.closeDeleteModal();
      }
    });
  }

  private openSyncModal() {
    const modal = this.container.querySelector('#sync-pilot-modal');
    modal?.classList.remove('hidden');
  }

  private closeSyncModal() {
    const modal = this.container.querySelector('#sync-pilot-modal');
    modal?.classList.add('hidden');
    this.syncPreviewData = null;
    this.syncRawData = '';
    const textArea = this.container.querySelector('#sync-text-input') as HTMLTextAreaElement | null;
    if (textArea) textArea.value = '';
    const boxes = Array.from(this.container.querySelectorAll<HTMLInputElement>('.sync-sharecode-box'));
    boxes.forEach((b) => {
      b.value = '';
      b.classList.remove('sharecode-box-filled');
    });
    const previewBox = this.container.querySelector('#sync-preview-box');
    previewBox?.classList.add('hidden');
  }

  private openDeleteModal() {
    const modal = this.container.querySelector('#delete-pilot-modal');
    modal?.classList.remove('hidden');
    const deleteConfirmInput = this.container.querySelector('#input-delete-callsign-confirm') as HTMLInputElement | null;
    const btnConfirmDelete = this.container.querySelector('#btn-confirm-delete') as HTMLButtonElement | null;
    if (deleteConfirmInput) {
      deleteConfirmInput.value = '';
      deleteConfirmInput.focus();
    }
    if (btnConfirmDelete) {
      btnConfirmDelete.disabled = true;
    }
  }

  private closeDeleteModal() {
    const modal = this.container.querySelector('#delete-pilot-modal');
    modal?.classList.add('hidden');
    const deleteConfirmInput = this.container.querySelector('#input-delete-callsign-confirm') as HTMLInputElement | null;
    if (deleteConfirmInput) {
      deleteConfirmInput.value = '';
    }
  }

  private getSyncShareCode(): string {
    const boxes = Array.from(this.container.querySelectorAll<HTMLInputElement>('.sync-sharecode-box'));
    return boxes.map((b) => b.value.trim().toUpperCase()).join('');
  }

  private fillSyncShareCode(code: string) {
    const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const boxes = Array.from(this.container.querySelectorAll<HTMLInputElement>('.sync-sharecode-box'));
    boxes.forEach((box, i) => {
      if (i < clean.length) {
        box.value = clean[i];
        box.classList.add('sharecode-box-filled');
      } else {
        box.value = '';
        box.classList.remove('sharecode-box-filled');
      }
    });

    if (clean.length === 12) {
      this.handleSyncValidate();
    }
  }

  private bindSyncShareCodeBoxes() {
    const boxes = Array.from(this.container.querySelectorAll<HTMLInputElement>('.sync-sharecode-box'));

    boxes.forEach((box, idx) => {
      box.addEventListener('input', () => {
        const clean = (box.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        box.value = clean.slice(0, 1);
        if (box.value.length === 1) {
          box.classList.add('sharecode-box-filled');
          if (idx < boxes.length - 1) {
            boxes[idx + 1].focus();
            boxes[idx + 1].select();
          }
        } else {
          box.classList.remove('sharecode-box-filled');
        }

        if (this.getSyncShareCode().length === 12) {
          this.handleSyncValidate();
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!box.value && idx > 0) {
            boxes[idx - 1].focus();
            boxes[idx - 1].select();
          } else {
            box.value = '';
            box.classList.remove('sharecode-box-filled');
          }
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          boxes[idx - 1].focus();
          boxes[idx - 1].select();
        } else if (e.key === 'ArrowRight' && idx < boxes.length - 1) {
          boxes[idx + 1].focus();
          boxes[idx + 1].select();
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboardText = (e.clipboardData?.getData('text') || '').trim();
        const cleaned = clipboardText.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleaned.length > 0) {
          const chars = cleaned.slice(0, boxes.length - idx).split('');
          chars.forEach((char, offset) => {
            if (idx + offset < boxes.length) {
              boxes[idx + offset].value = char;
              boxes[idx + offset].classList.add('sharecode-box-filled');
            }
          });
          const nextIndex = Math.min(idx + chars.length, boxes.length - 1);
          boxes[nextIndex].focus();
          if (this.getSyncShareCode().length === 12) {
            this.handleSyncValidate();
          }
        }
      });
    });
  }

  private handleSyncFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        this.syncRawData = content;
        const textArea = this.container.querySelector('#sync-text-input') as HTMLTextAreaElement | null;
        if (textArea) textArea.value = content;
        ToastService.info(`Arquivo "${file.name}" carregado. Analisando telemetria...`);
        this.handleSyncValidate();
      }
    };
    reader.onerror = () => {
      ToastService.error('Falha ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  }

  private async handleSyncValidate() {
    const shareCode = this.getSyncShareCode();
    const textArea = this.container.querySelector('#sync-text-input') as HTMLTextAreaElement | null;
    const jsonVal = textArea?.value.trim() || '';
    const inputVal = (shareCode.length > 0 ? shareCode : '') || jsonVal || this.syncRawData.trim();

    if (!inputVal) {
      ToastService.warning('Informe o Share Code de 12 dígitos ou envie o arquivo .json do COMP/CON.');
      return;
    }

    this.syncRawData = inputVal;
    const previewBox = this.container.querySelector('#sync-preview-box');

    try {
      ToastService.info('Processando telemetria da ficha...');
      const isJson = inputVal.startsWith('{') || inputVal.startsWith('[');
      const payload = isJson ? { compcon_json: inputVal } : { share_code: inputVal };

      const res = await pilotService.previewPilot(payload);
      this.syncPreviewData = res;

      const callsignEl = this.container.querySelector('#sync-preview-callsign');
      const frameEl = this.container.querySelector('#sync-preview-frame');
      const llEl = this.container.querySelector('#sync-preview-ll');
      const haseEl = this.container.querySelector('#sync-preview-hase');
      const statusBadge = this.container.querySelector('#sync-preview-status-badge');
      const warningsBox = this.container.querySelector('#sync-preview-warnings-container');

      if (callsignEl) callsignEl.textContent = res.parsed?.callsign || 'N/A';
      if (frameEl) frameEl.textContent = res.parsed?.active_mech_frame || 'GMS Everest Padrão';
      if (llEl) llEl.textContent = `LL ${res.parsed?.license_level ?? 0}`;
      if (haseEl) {
        const { hull = 0, agility = 0, systems = 0, engineering = 0 } = res.parsed || {};
        haseEl.textContent = `H:${hull} | A:${agility} | S:${systems} | E:${engineering}`;
      }

      if (statusBadge) {
        statusBadge.textContent = res.is_valid ? 'FICHA VÁLIDA' : 'ATENÇÃO';
        statusBadge.className = res.is_valid ? 'preview-status-valid' : 'preview-status-warning';
      }

      if (warningsBox) {
        if (res.warnings && res.warnings.length > 0) {
          warningsBox.classList.remove('hidden');
          warningsBox.innerHTML = `
            <div class="warnings-title"><i class="mdi mdi-alert-outline"></i> NOTIFICAÇÕES DE VALIDAÇÃO:</div>
            <ul class="warnings-list">
              ${res.warnings.map((w: string) => `<li>${w}</li>`).join('')}
            </ul>
          `;
        } else {
          warningsBox.classList.add('hidden');
          warningsBox.innerHTML = '';
        }
      }

      previewBox?.classList.remove('hidden');
      ToastService.success(`Ficha de "${res.parsed?.callsign}" validada com sucesso!`);
    } catch (err: any) {
      previewBox?.classList.add('hidden');
      ToastService.error(`Erro na validação: ${err.message || 'Formato inválido.'}`);
    }
  }

  private async handleConfirmSync() {
    if (!this.syncPreviewData || !this.pilotData) {
      ToastService.warning('Analise a ficha antes de sincronizar.');
      return;
    }

    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const isJson = this.syncRawData.startsWith('{') || this.syncRawData.startsWith('[');
      const payload: any = isJson
        ? { compcon_json: this.syncRawData, pilot_id: this.pilotData._id }
        : { share_code: this.syncRawData, pilot_id: this.pilotData._id };

      const res = await pilotService.submitPilot(payload);
      ToastService.success(res.message || 'Dossiê do piloto sincronizado com sucesso!');
      this.closeSyncModal();
      await this.render();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao sincronizar ficha.');
    } finally {
      this.isSyncing = false;
    }
  }

  private async handleConfirmDelete() {
    if (!this.pilotData || this.isDeleting) return;
    this.isDeleting = true;

    try {
      await pilotService.deletePilot(this.pilotData._id);
      ToastService.success(`Ficha de "${this.pilotData.callsign}" foi desmobilizada e excluída com sucesso.`);
      this.closeDeleteModal();
      window.location.hash = '#/hangar';
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao excluir ficha do piloto.');
    } finally {
      this.isDeleting = false;
    }
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
                    <span class="action-tag talent-action-type ${localization.getActionClass(act.activation)}">${act.activation}</span>
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

