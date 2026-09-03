---
trigger: always_on
description: Proibição estrita de atributos style inline no frontend
---

# Regra: Proibição de CSS Inline

1. **Zero CSS Inline**: Não insira nenhum atributo `style="..."` em templates HTML, componentes TypeScript (`.ts`) ou elementos DOM.
2. **Centralização de Estilos**: Todos os estilos devem residir em arquivos de folha de estilo externos:
   - `client/src/styles/global.css` (para regras e classes da aplicação)
   - `client/src/styles/variables.css` (para variáveis de cor, fontes e tamanhos)
3. **Novos Elementos**: Ao criar novos componentes ou seções, declare classes CSS semânticas e defina suas propriedades correspondentes no `global.css`.
