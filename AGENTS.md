# Diretrizes do Projeto // Guilda LANCER

## 1. Proibição de CSS Inline (Regra Estrita)
- **NUNCA use atributos `style="..."` no código HTML/TypeScript**.
- Todas as definições de estilo, dimensões, cores, posicionamento e espaçamento **devem** ser declaradas exclusivamente através de classes CSS em `client/src/styles/global.css` ou variáveis em `client/src/styles/variables.css`.
- Reutilize ou crie classes semânticas e utilitárias para qualquer novo componente ou elemento de interface.

## 2. Padrão Estético e Design System
- **Estética LANCER / COMP/CON**:
  - Utilitária, militar, industrial, ficção científica analógica/tática.
  - Bordas de 1px bem definidas (`#30363d`, `#21262d`).
  - Paleta base carbon/grafite escuro (`#0d1117`, `#161b22`) com acentos em ciano/menta (`var(--accent-mint)`), carmim (`var(--accent-crimson)`) e ouro tático (`#d29922`).
  - Fontes: `Orbitron` para títulos técnicos e identificadores; `JetBrains Mono` para dados numéricos/telemetria; `Inter` para leitura.
  - Evitar clichês genéricos de IA (como luzes borradas gigantes e botões no formato pílula ultra-arredondados).

## 3. Ícones Oficiais COMP/CON
- Use os ícones SVG oficiais do COMP/CON centralizados em `client/src/components/compcon-icons.ts` através da função `getCompconIcon(name, className)` ou do pacote `@mdi/font`.
- Nunca use texto puro ou emojis como substitutos para ícones de interface.
