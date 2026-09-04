import { pilotService, IPilotPreviewResult } from '../services/pilot.service.js';
import { IPilot } from '../types/pilot.types.js';
import { authService } from '../services/auth.service.js';
import { ToastService } from '../components/toast.js';
import { getCompconIcon } from '../components/compcon-icons.js';
import { localizationService } from '../services/localization.service.js';

export class HangarView {
  private container: HTMLElement;
  private pilots: IPilot[] = [];
  private activePilot: IPilot | null = null;
  private currentPreview: IPilotPreviewResult | null = null;
  private rawImportData: string = '';
  private isProcessing: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render() {
    this.container.innerHTML = `
      <div class="hangar-wrapper">
        <div class="hangar-header">
          <div>
            <a href="#/" class="placeholder-back-link">
              <i class="mdi mdi-arrow-left"></i> ${localizationService.t('hangar.return_hub', 'RETORNAR AO HUB')}
            </a>
            <h1 class="hangar-title">
              ${getCompconIcon('hangar', 'compcon-icon hangar-title-icon')}
              <span>${localizationService.t('hangar.title', 'HANGAR DE CHASSIS')}</span>
            </h1>
            <p class="hangar-subtitle">
              ${localizationService.t('hangar.subtitle', 'Sincronização tática com o COMP/CON. Mobilize e gerencie seus chassis autorizados na guilda.')}
            </p>
          </div>
          <div class="hangar-actions">
            <button id="btn-open-import" class="btn btn-primary hangar-import-btn" type="button">
              <i class="mdi mdi-plus-box-outline"></i>
              <span>${localizationService.t('hangar.import_btn', 'IMPORTAR FICHA COMP/CON')}</span>
            </button>
          </div>
        </div>

        <div id="hangar-content-area" class="hangar-content-area">
          <div class="hangar-loading-state">
            <div class="terminal-spinner"></div>
            <span>${localizationService.t('hangar.loading', 'CONECTANDO À TELEMETRIA DO HANGAR...')}</span>
          </div>
        </div>

        <!-- Modal de Importação COMP/CON -->
        <div id="import-modal" class="import-modal-overlay hidden" role="dialog" aria-modal="true">
          <div class="import-modal-box">
            <div class="import-modal-header">
              <div class="import-modal-title">
                ${getCompconIcon('hangar', 'compcon-icon')}
                <span>LNC://IMPORT_MODULE.01 // SINCRONIZAÇÃO COMP/CON</span>
              </div>
              <button id="btn-close-import" class="import-modal-close" type="button" aria-label="Fechar">
                <i class="mdi mdi-close"></i>
              </button>
            </div>

            <div class="import-modal-body">
              <div class="import-instructions">
                Selecione o arquivo <code>.json</code> exportado pelo seu COMP/CON v3 ou cole o código/JSON bruto no campo abaixo:
              </div>

              <!-- Dropzone para arquivo JSON -->
              <div id="import-dropzone" class="import-dropzone">
                <i class="mdi mdi-file-upload-outline import-dropzone-icon"></i>
                <div class="import-dropzone-text">ARRASTE O ARQUIVO .JSON DO COMP/CON AQUI</div>
                <div class="import-dropzone-sub">ou clique para selecionar do dispositivo</div>
                <input id="import-file-input" type="file" accept=".json,application/json" class="hidden-file-input" />
              </div>

              <!-- Entrada de Share Code com Caixas para Cada Dígito -->
              <div class="import-manual-section">
                <div class="sharecode-header-row">
                  <label class="import-label">INFORME O SHARE CODE DO COMP/CON (12 DÍGITOS):</label>
                </div>

                <div class="sharecode-boxes-container" id="sharecode-boxes">
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box" data-index="0" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="1" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="2" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="3" autocomplete="off" spellcheck="false" />
                  </div>
                  <span class="sharecode-separator">-</span>
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box" data-index="4" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="5" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="6" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="7" autocomplete="off" spellcheck="false" />
                  </div>
                  <span class="sharecode-separator">-</span>
                  <div class="sharecode-group">
                    <input type="text" maxlength="1" class="sharecode-box" data-index="8" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="9" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="10" autocomplete="off" spellcheck="false" />
                    <input type="text" maxlength="1" class="sharecode-box" data-index="11" autocomplete="off" spellcheck="false" />
                  </div>
                </div>

                <div id="json-paste-wrapper" class="json-paste-wrapper hidden">
                  <textarea
                    id="import-text-input"
                    class="import-textarea"
                    placeholder='Cole o JSON bruto aqui: {"callsign": "SPECTRE", ...}'
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="import-action-row">
                <button id="btn-validate-preview" class="btn btn-secondary" type="button">
                  <i class="mdi mdi-magnify-scan"></i>
                  <span>IMPORTAR FICHA</span>
                </button>
              </div>

              <!-- Painel de Pré-Visualização / Preview da Ficha -->
              <div id="import-preview-box" class="import-preview-box hidden">
                <div class="preview-header">
                  <span class="preview-tag">[ TELEMETRIA DETECTADA ]</span>
                  <span id="preview-status-badge" class="preview-status-valid">FICHA VÁLIDA</span>
                </div>

                <div class="preview-grid">
                  <div class="preview-item">
                    <span class="preview-label">INDICATIVO (CALLSIGN):</span>
                    <span id="preview-callsign" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">CHASSI / FRAME:</span>
                    <span id="preview-frame" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">NÍVEL DE LICENÇA:</span>
                    <span id="preview-ll" class="preview-value">-</span>
                  </div>
                  <div class="preview-item">
                    <span class="preview-label">H.A.S.E.:</span>
                    <span id="preview-hase" class="preview-value">-</span>
                  </div>
                </div>

                <div id="preview-warnings-container" class="preview-warnings-box hidden"></div>

                <div class="preview-confirm-bar">
                  <label class="preview-checkbox-label">
                    <input id="check-set-active" type="checkbox" checked />
                    <span>Definir como chassi ativo imediatamente</span>
                  </label>
                  <button id="btn-confirm-import" class="btn btn-primary" type="button">
                    ${getCompconIcon('hangar', 'compcon-icon')}
                    <span>SINCRONIZAR AO HANGAR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadPilots();
  }

  private bindEvents() {
    const btnOpenImport = document.getElementById('btn-open-import');
    const btnCloseImport = document.getElementById('btn-close-import');
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    const btnValidate = document.getElementById('btn-validate-preview');
    const btnConfirm = document.getElementById('btn-confirm-import');

    btnOpenImport?.addEventListener('click', () => this.openImportModal());
    btnCloseImport?.addEventListener('click', () => this.closeImportModal());

    // Dropzone de arquivo
    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('import-dropzone-active');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('import-dropzone-active');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('import-dropzone-active');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileUpload(files[0]);
      }
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.handleFileUpload(fileInput.files[0]);
      }
    });

    btnValidate?.addEventListener('click', () => this.handleValidate());
    btnConfirm?.addEventListener('click', () => this.handleConfirmImport());

    // Caixas de dígito para o Share Code
    this.bindShareCodeBoxes();
  }

  private getShareCode(): string {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('.sharecode-box'));
    return boxes.map((b) => b.value.trim().toUpperCase()).join('');
  }

  private bindShareCodeBoxes() {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('.sharecode-box'));

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

        // Se todos os 12 dígitos forem preenchidos, aciona a validação
        if (this.getShareCode().length === 12) {
          this.handleValidate();
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
          if (this.getShareCode().length === 12) {
            this.handleValidate();
          }
        }
      });
    });
  }

  private async loadPilots() {
    const contentArea = document.getElementById('hangar-content-area');
    if (!contentArea) return;

    try {
      const { pilots, active_pilot } = await pilotService.getMyPilots();
      this.pilots = pilots;
      this.activePilot = active_pilot;
      authService.updatePilots(pilots, active_pilot);
      this.renderChassisGrid();
    } catch (err: any) {
      contentArea.innerHTML = `
        <div class="hangar-error-card">
          <i class="mdi mdi-alert-octagon-outline hangar-error-icon"></i>
          <div class="hangar-error-title">FALHA DE COMUNICAÇÃO COM O HANGAR</div>
          <div class="hangar-error-desc">${err.message || 'Não foi possível carregar a lista de mechas.'}</div>
          <button id="btn-retry-hangar" class="btn btn-secondary" type="button">TENTAR NOVAMENTE</button>
        </div>
      `;
      document.getElementById('btn-retry-hangar')?.addEventListener('click', () => this.loadPilots());
    }
  }

  private renderChassisGrid() {
    const contentArea = document.getElementById('hangar-content-area');
    if (!contentArea) return;

    if (this.pilots.length === 0) {
      contentArea.innerHTML = `
        <div class="hangar-empty-card">
          <div class="hangar-empty-icon-box">
            ${getCompconIcon('hangar', 'compcon-icon-lg')}
          </div>
          <h2 class="hangar-empty-title">NENHUM CHASSI VINCULADO AO SEU OPERADOR</h2>
          <p class="hangar-empty-desc">
            Seu hangar está vazio. Utilize o botão de importação para carregar uma ficha criada no COMP/CON e registrar seu primeiro mecha na guilda.
          </p>
          <button id="btn-empty-import" class="btn btn-primary" type="button">
            <i class="mdi mdi-plus-box-outline"></i>
            <span>IMPORTAR PRIMEIRA FICHA COMP/CON</span>
          </button>
        </div>
      `;
      document.getElementById('btn-empty-import')?.addEventListener('click', () => this.openImportModal());
      return;
    }

    const cardsHtml = this.pilots
      .map((pilot) => {
        const isActive = this.activePilot && this.activePilot._id === pilot._id;
        const statusClass =
          pilot.status === 'APPROVED'
            ? 'status-approved'
            : pilot.status === 'REJECTED'
            ? 'status-rejected'
            : 'status-pending';

        const statusLabel =
          pilot.status === 'APPROVED'
            ? 'APROVADO // COMBATE'
            : pilot.status === 'REJECTED'
            ? 'REJEITADO // REVISAR'
            : 'PENDENTE // AVALIAÇÃO';

        const talentsList = pilot.talents && pilot.talents.length > 0
          ? pilot.talents
              .map((t) => {
                const translated = localizationService.translateTalent(t.id, (t as any).data || t, t.rank);
                return `${translated.name || t.name} (Rk ${t.rank})`;
              })
              .join(', ')
          : 'Nenhum talento configurado';

        return `
          <div class="card mech-card ${isActive ? 'mech-card-active' : ''} ${isActive && pilot.active_mech_image ? 'mech-card-with-image' : ''}">
            ${isActive && pilot.active_mech_image ? `
            <div class="mech-featured-visual">
              <img src="${pilot.active_mech_image}" alt="${pilot.active_mech_name || 'Visual do Chassi'}" class="mech-featured-img" />
              <div class="mech-visual-overlay"></div>
              <div class="mech-hover-hint">
                <i class="mdi mdi-chevron-down"></i>
                <span>TELEMETRIA & DADOS [HOVER]</span>
              </div>
            </div>
            ` : ''}

            <!-- Header do Card -->
            <div class="mech-card-top">
              <div class="mech-card-title-group">
                <div class="mech-frame-tag">
                  ${getCompconIcon('mech', 'compcon-icon')}
                  <span>${pilot.active_mech_frame || 'GMS Standard Pattern I Everest'}</span>
                </div>
                <h3 class="mech-name">${pilot.active_mech_name || 'Chassi Sem Nome'}</h3>
                <div class="mech-pilot-line">
                  OPERADOR: <span class="mech-pilot-callsign">${pilot.callsign}</span>
                  <span class="mech-ll-tag">[LL ${pilot.license_level}]</span>
                </div>
              </div>

              <div class="mech-status-badges">
                ${
                  isActive
                    ? `<span class="mech-badge-active">${getCompconIcon('hangar', 'compcon-icon')} ATIVO</span>`
                    : ''
                }
                <span class="mech-badge-status ${statusClass}">${statusLabel}</span>
              </div>
            </div>

            <!-- Informações em Dropdown / Gaveta Tática -->
            <div class="mech-card-dropdown">
              <!-- Justificativa de Rejeição se houver -->
              ${
                pilot.status === 'REJECTED' && pilot.rejection_reason
                  ? `
                <div class="mech-rejection-box">
                  <i class="mdi mdi-alert-circle-outline"></i>
                  <div>
                    <strong>MOTIVO DA REJEIÇÃO:</strong> ${pilot.rejection_reason}
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Telemetria H.A.S.E. -->
              <div class="mech-stats-row">
                <div class="mech-stat-col">
                  <span class="mech-stat-label">${localizationService.t('sheet.hull', 'Casco')}</span>
                  <span class="mech-stat-val">${pilot.hull || 0}</span>
                </div>
                <div class="mech-stat-col">
                  <span class="mech-stat-label">${localizationService.t('sheet.agility', 'Agilidade')}</span>
                  <span class="mech-stat-val">${pilot.agility || 0}</span>
                </div>
                <div class="mech-stat-col">
                  <span class="mech-stat-label">${localizationService.t('sheet.systems_stat', 'Sistemas')}</span>
                  <span class="mech-stat-val">${pilot.systems || 0}</span>
                </div>
                <div class="mech-stat-col">
                  <span class="mech-stat-label">${localizationService.t('sheet.engineering', 'Engenharia')}</span>
                  <span class="mech-stat-val">${pilot.engineering || 0}</span>
                </div>
                <div class="mech-stat-col">
                  <span class="mech-stat-label">${localizationService.t('sheet.grit', 'Brio')}</span>
                  <span class="mech-stat-val">+${pilot.grit || 0}</span>
                </div>
              </div>

              <!-- Talentos / Configuração Resumida -->
              <div class="mech-meta-section">
                <div class="mech-meta-label">${localizationService.t('sheet.talents', 'TALENTOS')}:</div>
                <div class="mech-meta-content">${talentsList}</div>
              </div>

              <!-- Rodapé de Ações do Chassi -->
              <div class="mech-card-footer">
                <div class="mech-card-actions-left">
                  <a href="#/mech?id=${pilot._id}" class="btn btn-secondary btn-view-full-sheet" title="Inspecionar Ficha do Mecha">
                    ${getCompconIcon('mech', 'compcon-icon')}
                    <span>${localizationService.t('hangar.mech_sheet_btn', 'FICHA DO MECHA')}</span>
                  </a>
                  <a href="#/pilot?id=${pilot._id}" class="btn btn-secondary btn-view-full-sheet" title="Dossiê do Piloto">
                    ${getCompconIcon('pilot', 'compcon-icon')}
                    <span>${localizationService.t('hangar.pilot_sheet_btn', 'FICHA DO PILOTO')}</span>
                  </a>

                  ${
                    !isActive
                      ? `
                    <button class="btn btn-secondary btn-activate-chassis" data-id="${pilot._id}" type="button">
                      <i class="mdi mdi-check"></i>
                      <span>${localizationService.t('hangar.set_active_btn', 'DEFINIR COMO ATIVO')}</span>
                    </button>
                  `
                      : `
                    <span class="mech-active-notice">
                      <i class="mdi mdi-radio-tower"></i> ${localizationService.t('hangar.active_badge', 'CHASSI ATIVO')}
                    </span>
                  `
                  }
                </div>

                <div>
                  <button class="btn-mech-delete btn-delete-chassis" data-id="${pilot._id}" data-callsign="${pilot.callsign}" type="button" title="Excluir ficha">
                    <i class="mdi mdi-trash-can-outline"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    contentArea.innerHTML = `
      <div class="mech-grid">
        ${cardsHtml}
      </div>
    `;

    // Vincula eventos aos botões dos cards
    contentArea.querySelectorAll('.btn-activate-chassis').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) await this.handleActivatePilot(id);
      });
    });

    contentArea.querySelectorAll('.btn-delete-chassis').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.id;
        const callsign = target.dataset.callsign;
        if (id && callsign) await this.handleDeletePilot(id, callsign);
      });
    });
  }

  private handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        this.rawImportData = content;
        const textArea = document.getElementById('import-text-input') as HTMLTextAreaElement;
        if (textArea) textArea.value = content;
        ToastService.info(`Arquivo "${file.name}" carregado. Clique em "IMPORTAR FICHA".`);
        this.handleValidate();
      }
    };
    reader.onerror = () => {
      ToastService.error('Falha ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  }

  private async handleValidate() {
    const shareCode = this.getShareCode();
    const textArea = document.getElementById('import-text-input') as HTMLTextAreaElement;
    const jsonVal = textArea?.value.trim() || '';
    const inputVal = (shareCode.length > 0 ? shareCode : '') || jsonVal || this.rawImportData.trim();

    if (!inputVal) {
      ToastService.warning('Informe o Share Code de 12 caracteres ou selecione um arquivo .json.');
      return;
    }

    this.rawImportData = inputVal;
    const previewBox = document.getElementById('import-preview-box');

    try {
      ToastService.info('Processando telemetria da ficha...');
      const isJson = inputVal.startsWith('{') || inputVal.startsWith('[');
      const payload = isJson ? { compcon_json: inputVal } : { share_code: inputVal };

      const res = await pilotService.previewPilot(payload);
      this.currentPreview = res;

      // Atualiza os elementos da prévia
      const callsignEl = document.getElementById('preview-callsign');
      const frameEl = document.getElementById('preview-frame');
      const llEl = document.getElementById('preview-ll');
      const haseEl = document.getElementById('preview-hase');
      const statusBadge = document.getElementById('preview-status-badge');
      const warningsBox = document.getElementById('preview-warnings-container');

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
              ${res.warnings.map((w) => `<li>${w}</li>`).join('')}
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

  private async handleConfirmImport() {
    if (!this.currentPreview) {
      ToastService.warning('Analise a ficha antes de sincronizar.');
      return;
    }

    if (this.isProcessing) return;
    this.isProcessing = true;

    const checkSetActive = document.getElementById('check-set-active') as HTMLInputElement;
    const setActive = checkSetActive?.checked ?? true;

    try {
      const isJson = this.rawImportData.startsWith('{') || this.rawImportData.startsWith('[');
      const payload = isJson
        ? { compcon_json: this.rawImportData, set_active: setActive }
        : { share_code: this.rawImportData, set_active: setActive };

      const res = await pilotService.submitPilot(payload);
      ToastService.success(res.message || 'Chassi cadastrado e sincronizado com sucesso!');
      this.closeImportModal();
      await this.loadPilots();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao sincronizar chassi.');
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleActivatePilot(id: string) {
    try {
      const updated = await pilotService.activatePilot(id);
      ToastService.success(`Chassi "${updated.active_mech_frame || updated.callsign}" mobilizado como ativo.`);
      await this.loadPilots();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao mobilizar chassi.');
    }
  }

  private async handleDeletePilot(id: string, callsign: string) {
    const confirmed = window.confirm(`ATENÇÃO OPERADOR:\nConfirma a desmobilização permanente do piloto/chassi "${callsign}" do hangar?`);
    if (!confirmed) return;

    try {
      await pilotService.deletePilot(id);
      ToastService.info(`Ficha "${callsign}" desmobilizada do hangar.`);
      await this.loadPilots();
    } catch (err: any) {
      ToastService.error(err.message || 'Falha ao excluir chassi.');
    }
  }

  private openImportModal() {
    const modal = document.getElementById('import-modal');
    modal?.classList.remove('hidden');
  }

  private closeImportModal() {
    const modal = document.getElementById('import-modal');
    modal?.classList.add('hidden');
    this.currentPreview = null;
    this.rawImportData = '';
    const textArea = document.getElementById('import-text-input') as HTMLTextAreaElement;
    if (textArea) textArea.value = '';
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('.sharecode-box'));
    boxes.forEach((b) => {
      b.value = '';
      b.classList.remove('sharecode-box-filled');
    });
    const previewBox = document.getElementById('import-preview-box');
    previewBox?.classList.add('hidden');
  }
}
