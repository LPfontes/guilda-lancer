/**
 * Terminal Background Stream (Terminal Console Normal).
 * Simula um terminal Linux/Omninet real com saída de logs horizontais,
 * efeito de digitação caractere por caractere, rolagem vertical contínua
 * e cursor piscante clássico.
 */
export class TerminalBackground {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  // =========================================================================
  // PARÂMETROS E VELOCIDADES DE ANIMAÇÃO DO TERMINAL (CONFIGURÁVEIS)
  // =========================================================================
  /** Tamanho da fonte e espaçamento vertical */
  public fontSize = 22;
  public lineHeight = 32;
  public paddingLeft = 32;
  public paddingTop = 40;

  /** Quantidade de caracteres digitados por pulso (1 = suave, 2-3 = mais rápido) */
  public charsPerPulse = 1;

  /** Intervalo em frames entre cada pulso de digitação (1 = rápido, 2-3 = cadenciado) */
  public typingDelayFrames = 3;

  /** Pausa mínima (em frames) após completar uma linha antes de iniciar a próxima (ex: 25 frames ≈ 0.4s) */
  public minLinePauseFrames = 30;

  /** Variação aleatória máxima adicionada à pausa da linha (ex: 50 frames ≈ 0.8s) */
  public maxRandomPauseFrames = 30;

  /** Velocidade do ciclo de piscar do cursor em milissegundos (ex: 450ms) */
  public cursorBlinkIntervalMs = 450;

  /** Frequência/chance de corte de tela e bugs visuais por frame (0.05 = 5%) */
  public screenTearChance = 0.05;

  /** Frequência/chance de ruído estático de erro por frame (0.03 = 3%) */
  public staticNoiseChance = 0.03;

  /** Intervalo em milissegundos entre as fases do bug de cores da HORUS (ex: 280ms = mais lento) */
  public colorGlitchIntervalMs = 100;

  /** Distância máxima do deslocamento de cor para frente (em pixels) */
  public forwardColorOffset = 15;

  /** Duração da pausa/delay no final do efeito antes de recomeçar (em milissegundos) */
  public colorGlitchPauseMs = 3000;

  /** Velocidade da animação do texto subindo para fora da janela (0.04 = suave, 0.1 = rápida) */
  public scrollEasing = 0.07;

  // Estado de rolagem suave vertical
  private scrollY = 0;
  private targetScrollY = 0;

  // Linhas já renderizadas no histórico do terminal
  private lines: string[] = [];

  // Linha atual sendo digitada
  private currentFullLine = '';
  private currentCharIndex = 0;
  private typeDelay = 0;
  private linePauseTimer = 0;

  // Índice do template de logs atual
  private templateIndex = 0;

  // Registro de logs e comandos temáticos do LANCER e Omninet
  private readonly logTemplates: string[] = [
    'OMNINET OS KERNEL v4.19.2 // UNION NAVAL COMMAND TERMINAL // SEC_CLEARANCE: L3',
    '-----------------------------------------------------------------------------------------',
    '[UNKNOWN] [PARABÉNS, PILOTO.',
    '[UNKNOWN]  VOCÊ FOI ESCOLHIDO.',
    '[UNKNOWN]  O ACESSO É SEU,',
    '[UNKNOWN]  ENQUANTO PUDER MANTÊ-LO.]',
    '-----------------------------------------------------------------------------------------',
    '[SYS_INIT] Booting sub-etheric quantum transceiver array... [OK]',
    '[CARRIER] Handshake established with orbital node GMS-NAV-01 (latency: 0.12ms)',
    '[BLINKSPACE] Mounting /dev/blink0 on /sys/carrier/blink (filesystem: omnifs-enc)',
    '[COMP/CON:CLOUD] Daemon v3.8.2 online. Socket connected to AWS API Gateway',
    '[AUTH] Operator session authenticated via Discord OAuth2 gateway',
    '[HANGAR] Querying local mech bay telemetry: 2 chassis registered in hangar',
    '[DIAGNOSTIC] Frame HA Saladin (The Means of Destruction) — Hardlight shield: STABLE',
    '[DIAGNOSTIC] Frame SSC Monarch (Crimson Desert) — Target lock telemetry: 100%',
    '[REACTOR] Coldcore magnetic containment nominal // Heat capacity: 12/12',
    '[MISSION_HUB] Fetching open operations from Union Department of Operations...',
    '[MATCHMAKING] Calculating pilot priority scores: matchmaking queue depth: 4',
    '[TELEMETRY] HASE telemetry: Hull +2, Agility +0, Systems +0, Engineering +4 [Grit: +2]',
    '[OMNINET] Sub-etheric packet throughput: 4.8 TB/s (packet loss: 0.0000%)',
    '[ENCRYPTION] Paracasual anomaly index: 0.0000 // Containment protocol: NOMINAL',
    '[COMP/CON] Resolving remote share code payload from CloudFront S3...',
    '[AAR_ARCHIVE] After Action Reports synchronized with central fleet archives',
    '[CONTRACT] Operational contract 0xf8d7667343514a2798c7ed9b740493ab validated by Harrison Armory',
    '[SECURITY] Cryptographic handshake re-verified. Node signature: 0x4F4D4E49',
    '[STATUS] All subsystems operational. Terminal running in persistent daemon mode.',
    '[HEARTBEAT] Keep-alive ping acknowledged by node HA-RAS-SHAMRA [200 OK]',
    '[UNKNOWN] [EU VEJO VOCÊ]'
  ];

  constructor(canvasId = 'terminal-stream-bg') {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.initCanvas();
      window.addEventListener('resize', () => this.initCanvas());
      document.addEventListener('visibilitychange', () => this.handleVisibility());
    }
  }

  private initCanvas() {
    if (!this.canvas || !this.ctx) return;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;

    this.ctx.scale(dpr, dpr);

    // Preenche a tela inicialmente com as primeiras linhas de boot para não começar vazio
    const maxVisibleLines = Math.floor((window.innerHeight - this.paddingTop) / this.lineHeight);
    const initialCount = Math.min(12, maxVisibleLines - 2);

    this.lines = [];
    for (let i = 0; i < initialCount; i++) {
      this.lines.push(this.logTemplates[i % this.logTemplates.length]);
    }
    this.templateIndex = initialCount;
    this.scrollY = 0;
    this.targetScrollY = 0;

    this.prepareNextLine();
  }

  private prepareNextLine() {
    this.currentFullLine = this.logTemplates[this.templateIndex % this.logTemplates.length];
    this.templateIndex++;
    this.currentCharIndex = 0;
    this.typeDelay = 0;
    this.linePauseTimer = this.minLinePauseFrames + Math.floor(Math.random() * this.maxRandomPauseFrames);
  }

  private handleVisibility() {
    if (document.hidden) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    } else {
      this.start();
    }
  }

  private render = () => {
    if (!this.canvas || !this.ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Limpa a tela do terminal
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.font = `${this.fontSize}px 'JetBrains Mono', monospace`;
    this.ctx.textBaseline = 'top';

    // 1. Atualiza digitação da linha atual com as variáveis de velocidade
    if (this.linePauseTimer > 0) {
      this.linePauseTimer--;
    } else {
      this.typeDelay++;
      if (this.typeDelay >= this.typingDelayFrames) {
        this.typeDelay = 0;
        this.currentCharIndex = Math.min(this.currentCharIndex + this.charsPerPulse, this.currentFullLine.length);

        if (this.currentCharIndex >= this.currentFullLine.length) {
          // Linha terminou de digitar: adiciona ao histórico e prepara a próxima
          this.lines.push(this.currentFullLine);
          this.prepareNextLine();
        }
      }
    }

    // =========================================================================
    // EFEITO DO TEXTO SUBINDO PARA FORA DA JANELA (ROLAGEM SUAVE VERTICAL)
    // =========================================================================
    const totalLinesCount = this.lines.length + 1;
    const contentHeight = this.paddingTop + totalLinesCount * this.lineHeight;
    const bottomThreshold = height - 50;

    if (contentHeight > bottomThreshold) {
      this.targetScrollY = contentHeight - bottomThreshold;
    }

    // Interpola suavemente a rolagem (faz o texto subir de forma contínua e elegante)
    this.scrollY += (this.targetScrollY - this.scrollY) * this.scrollEasing;

    // Quando uma linha ultrapassa completamente a borda superior para fora da tela, removemos do buffer
    while (this.lines.length > 0) {
      const firstLineY = this.paddingTop - this.scrollY;
      if (firstLineY < -this.lineHeight * 2) {
        this.lines.shift();
        this.scrollY -= this.lineHeight;
        this.targetScrollY -= this.lineHeight;
      } else {
        break;
      }
    }

    // 2. Renderiza as linhas já impressas subindo e saindo pelo topo da janela
    for (let i = 0; i < this.lines.length; i++) {
      const lineY = this.paddingTop + i * this.lineHeight - this.scrollY;

      // Transparência gradual (fade-out) enquanto cruza o limite superior da janela
      if (lineY < 50) {
        const fade = Math.max(0, Math.min(1, (lineY + this.lineHeight) / (50 + this.lineHeight)));
        this.ctx.globalAlpha = fade;
      } else {
        this.ctx.globalAlpha = 1.0;
      }

      this.drawLineText(this.lines[i], this.paddingLeft, lineY);
    }

    // 3. Renderiza a linha que está sendo digitada no momento (também acompanhando a subida)
    const currentLineY = this.paddingTop + this.lines.length * this.lineHeight - this.scrollY;
    this.ctx.globalAlpha = 1.0;
    const partialText = this.currentFullLine.substring(0, this.currentCharIndex);
    this.drawLineText(partialText, this.paddingLeft, currentLineY);

    // 4. Cursor piscante clássico de terminal (blinking block cursor █)
    const isCursorVisible = Math.floor(Date.now() / this.cursorBlinkIntervalMs) % 2 === 0;
    if (isCursorVisible) {
      const cursorX = this.paddingLeft + this.ctx.measureText(partialText).width + 2;
      this.ctx.fillStyle = '#78C091';
      this.ctx.shadowColor = 'rgba(120, 192, 145, 0.8)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillRect(cursorX, currentLineY + 1, 8, this.fontSize);
      this.ctx.shadowBlur = 0;
    }

    this.ctx.globalAlpha = 1.0;

    // =========================================================
    // 5. BUGS DE ERRO VISUAIS: RUÍDO DE COR (SEM BALANÇO DE TEXTO)
    // =========================================================
    // Linha de ruído estático de cor esporádica (sem mover o texto)
    if (Math.random() < this.staticNoiseChance) {
      const noiseY = Math.floor(Math.random() * height);
      const isCritical = Math.random() < 0.4;
      this.ctx.fillStyle = isCritical ? 'rgba(128, 41, 50, 0.35)' : 'rgba(120, 192, 145, 0.2)';
      this.ctx.fillRect(0, noiseY, width, Math.floor(Math.random() * 3) + 1);
    }

    this.animationFrameId = requestAnimationFrame(this.render);
  };

  /**
   * Renderiza a linha de texto com cores semânticas de terminal
   * e glitch exclusivo de cor (aberração cromática estática, sem balanço/tremor de posição).
   */
  private drawLineText(line: string, x: number, y: number) {
    if (!this.ctx) return;

    // Destaque de cabeçalho ou separadores
    if (line.startsWith('---') || line.startsWith('OMNINET OS')) {
      this.ctx.fillStyle = '#78C091';
      this.ctx.shadowColor = 'rgba(120, 192, 145, 0.6)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(line, x, y);
      this.ctx.shadowBlur = 0;
      return;
    }

    // 1. Destaque paracausal UNKNOWN com o BUG DE COR oficial da HORUS (COMP/CON distort keyframes)
    const isUnknown =
      line.includes('[UNKNOWN]') ||
      line.includes('[HORUS]') ||
      line.includes('PARABÉNS') ||
      line.includes('ESCOLHIDO') ||
      line.includes('ACESSO') ||
      line.includes('MANTÊ-LO') ||
      line.includes('EU VEJO VOCÊ');

    if (isUnknown) {
      // Duração da fase ativa do efeito (5 passos) + pausa/delay de repouso no final
      const activeDuration = this.colorGlitchIntervalMs * 5;
      const totalCycle = activeDuration + this.colorGlitchPauseMs;
      const cycleTime = Date.now() % totalCycle;

      // DELAY NO FINAL DO EFEITO: repouso nítido sem deslocamento de cor
      if (cycleTime >= activeDuration) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = 'rgba(255, 0, 255, 0.4)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(line, x, y);
        this.ctx.shadowBlur = 0;
        return;
      }

      // FASE ATIVA: Deslocamento de cor projetado PARA FRENTE (+X)
      const phase = Math.floor(cycleTime / this.colorGlitchIntervalMs);
      const forwardSteps = [0.35, 0.7, 1.0, 0.45, 0.85];
      const forwardDist = this.forwardColorOffset * (forwardSteps[phase] ?? 0.5);
      const secondaryDist = forwardDist * 0.55;

      const magColor = phase === 2 ? '#ff0033' : '#ff00ff';
      const cyanColor = '#00ffff';

      // 1. Canal primário (Magenta/Vermelho) projetado mais à frente (+X)
      this.ctx.fillStyle = magColor;
      this.ctx.fillText(line, x + forwardDist, y);

      // 2. Canal secundário (Ciano) com avanço intermediário para frente (+X)
      this.ctx.fillStyle = cyanColor;
      this.ctx.fillText(line, x + secondaryDist, y);

      // 3. Texto Principal Branco Fixo na posição original (100% estático)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = magColor;
      this.ctx.shadowBlur = 8;
      this.ctx.fillText(line, x, y);
      this.ctx.shadowBlur = 0;
      return;
    }

    // 2. BUGS DE ERRO CRÍTICO / KERNEL PANIC (Glitch de cor Carmim #802932 sem balanço)
    const isCriticalError =
      line.includes('[CRITICAL_ERROR]') ||
      line.includes('[FATAL_EXCEPTION]') ||
      line.includes('[CORRUPTED]') ||
      line.includes('[STACK_OVERFLOW]') ||
      line.includes('[SYS_FAIL]') ||
      line.includes('[ALERT:RA]');

    if (isCriticalError) {
      // Glitch de cor vermelho/carmim estático
      this.ctx.fillStyle = '#ff0055';
      this.ctx.fillText(line, x - 2, y);

      this.ctx.fillStyle = '#802932';
      this.ctx.shadowColor = 'rgba(128, 41, 50, 0.85)';
      this.ctx.shadowBlur = 8;
      this.ctx.fillText(line, x, y);
      this.ctx.shadowBlur = 0;
      return;
    }

    if (line.includes('[OK]') || line.includes('APPROVED') || line.includes('READY') || line.includes('STABLE')) {
      this.ctx.fillStyle = '#78C091';
      this.ctx.shadowColor = 'rgba(120, 192, 145, 0.6)';
      this.ctx.shadowBlur = 5;
    } else if (line.includes('[WARN:') || line.includes('ANOMALY') || line.includes('COMPROMISED')) {
      this.ctx.fillStyle = '#a63a46';
      this.ctx.shadowColor = 'rgba(128, 41, 50, 0.7)';
      this.ctx.shadowBlur = 6;
    } else {
      this.ctx.fillStyle = '#78C091';
      this.ctx.shadowColor = 'rgba(120, 192, 145, 0.3)';
      this.ctx.shadowBlur = 3;
    }

    this.ctx.fillText(line, x, y);
    this.ctx.shadowBlur = 0;
  }

  public start() {
    if (!this.animationFrameId && this.ctx) {
      this.render();
    }
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
