# AICaesar — Plano de Desenvolvimento da Fase 26

## Objetivo

Tornar a navegação e a construção utilizáveis em touch, sem degradar os controlos desktop existentes:

- um dedo arrasta o mapa;
- dois dedos fazem pinch-to-zoom, ancorado no centro do gesto;
- tap continua a construir/demolir um único tile;
- drag constrói traços de Roads e demole traços com Bulldoze.

## Estado actual

- `Game.ts` suporta construção por `pointerdown`, pan com botão do meio ou Space + botão esquerdo, e zoom por wheel;
- o canvas não declara `touch-action: none`, permitindo ao browser interceptar scroll e zoom;
- o mapa tem `CameraState`, `panCamera()` e `zoomAtScreenPoint()` testados;
- `placeBuilding()` e `demolishBuilding()` já validam cada tile e devolvem resultado explícito;
- não existe recognizer de gesto touch nem construção por traço;
- o projeto usa TypeScript estrito e Vitest headless; browser/manual UI testing permanece fora de escopo.

## Escopo

### Inclui

1. Um pequeno módulo puro e testado para estado de pointers/gestos, ou helpers equivalentes com responsabilidades explícitas:
   - acompanhar pointers touch activos por `pointerId` e posição;
   - distinguir tap de drag através de um limiar pequeno e constante;
   - expor o delta de pan de um dedo;
   - expor midpoint e factor de escala incremental para exactamente dois ou mais pointers;
   - cancelar a ação de construção pendente ao começar drag ou pinch;
   - terminar/limpar o gesto em `pointerup`, `pointerupoutside` e `pointercancel`.

2. Integração em `Game.ts`:
   - touch com um dedo inicia como candidato a tap;
   - ao ultrapassar o limiar, Road e Bulldoze passam a aplicar o respetivo traço; outras ferramentas passam a pan;
   - tap sem drag mantém a construção/demolição unitária actual;
   - Road constrói cada tile novo atravessado durante o gesto, no máximo uma vez por gesto;
   - Bulldoze demole cada tile novo atravessado durante o gesto, no máximo uma vez por gesto;
   - cada operação continua a usar `placeBuilding()`/`demolishBuilding()`, só actualiza workers, métricas, advisor e UI após sucesso;
   - tile inválido, ocupado, vazio (para demolição), fora do mapa ou sem fundos é ignorado, sem interromper o traço nem reverter sucessos anteriores;
   - dois dedos cancelam construção/traço, executam pinch incremental em torno do midpoint e não permitem pan concorrente;
   - o gesto não altera o comportamento desktop: click normal constrói, Space+drag e botão do meio fazem pan, wheel faz zoom;
   - cancelar e limpar estado de gesto no `destroy()` e evitar listeners duplicados.

3. Estilos e acessibilidade:
   - aplicar `touch-action: none` ao canvas, apenas para o mapa gerir os seus gestos;
   - actualizar `aria-label` para documentar tap, drag e pinch;
   - não bloquear gestos dos painéis HTML fora do canvas.

4. Testes headless:
   - transições de tap/drag/pinch e cálculos do recognizer;
   - tap Road e Bulldoze preserva operação unitária;
   - drag Road constrói tiles distintos e conta apenas construções bem-sucedidas;
   - drag Bulldoze remove tiles distintos e conta apenas demolições bem-sucedidas;
   - drag com uma ferramenta de edifício faz pan sem construir em massa;
   - pinch altera zoom preservando o ponto de foco e não constrói/demole;
   - `pointercancel`, `pointerupoutside` e cleanup não deixam gesto activo;
   - regressão dos controlos desktop atuais.

### Exclui

- drag para edifícios além de Road e Bulldoze;
- path preview, ghost tiles, confirmação de custo total, undo/redo, seleção múltipla ou preenchimento de área;
- inércia, limites de câmara, double-tap zoom, rotação ou gestos de três dedos;
- alterações à simulação, cenários, save/load ou schema;
- bibliotecas externas de gestos;
- browser/manual UI testing.

## Decisões de interação

| Gesto | Ferramenta | Resultado |
|---|---|---|
| Tap | qualquer | operação unitária existente |
| Drag de um dedo | Road | constrói um traço de Roads |
| Drag de um dedo | Bulldoze | demole um traço |
| Drag de um dedo | outro edifício | pan da câmara, sem construção repetida |
| Dois dedos | qualquer | pinch-to-zoom; cancela tap, traço e pan |
| Desktop middle drag / Space+left drag | qualquer | pan atual preservado |

Um tile só é processado uma vez por traço. O primeiro tile pode ser aplicado quando o movimento passa o limiar; tiles posteriores são resolvidos a partir da posição actual do pointer. Não é necessário interpolar toda a linha entre eventos nesta fase: a prioridade é previsibilidade e validação por tile com o renderer e APIs atuais.

## Critérios de aceitação

- O canvas não dispara zoom/scroll nativo quando o utilizador manipula o mapa por touch.
- Touch de um dedo permite pan em ferramentas que não são Road/Bulldoze.
- Pinch faz zoom para dentro/fora sobre o midpoint e nunca constrói nem demole.
- Tap continua a construir ou demolir exactamente um tile.
- Drag Road e Bulldoze aplicam operações distintas ao longo do gesto, respeitando fundos, ocupação e limites do mapa.
- Métricas, workers, advisor invalidation e render actualizam apenas para operações bem-sucedidas.
- Controlos desktop atuais continuam funcionais.
- `npm test`, `npm run build` e `git diff --check` passam.
- Não é realizado browser/manual UI testing.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 26 segundo este plano.
2. Usar TDD para o recognizer de gestos e comportamentos novos.
3. Não adicionar dependências externas.
4. Não fazer commit nem push.
5. Correr `npm test`, `npm run build` e `git diff --check`.
6. Devolver resumo, ficheiros alterados e evidência de verificação.
