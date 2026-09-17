# AICaesar — Plano de Desenvolvimento da Fase 28

## Objetivo

Reduzir erros de construção e tornar o mapa mais legível com feedback determinístico do tile sob o cursor/toque, sem alterar a simulação nem introduzir selecção complexa.

## Estado actual

- construção e demolição funcionam por clique/tap e os traços touch de Road/Bulldoze já estão implementados;
- o mapa não mostra preview nem informação do tile apontado antes da operação;
- erros de construção aparecem apenas no painel de feedback depois da tentativa;
- `MapRenderer` já possui camadas derivadas do `CityState`, e `Game.ts` centraliza a conversão screen-to-grid;
- a navegação desktop e touch está coberta por testes headless; browser/manual UI testing permanece fora de escopo.

## Escopo

### Inclui

1. Criar uma camada visual de preview/hover do tile apontado no mapa:
   - converter a posição pointer para tile usando a transformação actual da câmara;
   - destacar apenas tiles dentro do mapa;
   - mostrar estado visual distinto para tile livre, tile ocupado e posição inválida;
   - não mutar `CityState`, não alterar overlays nem reenquadrar a câmara;
   - limpar o destaque quando o pointer sai do mapa ou durante pan/pinch.

2. Integrar o feedback em `Game.ts`:
   - actualizar o tile apontado em `pointermove` para pointers desktop e touch sem interferir com gestos activos;
   - preservar click/tap, drag de Road/Bulldoze, pan, pinch e wheel;
   - não fazer preview durante um gesto de dois dedos;
   - limpar preview em `pointerup`, `pointerupoutside`, `pointercancel` e `destroy()`;
   - usar a ferramenta seleccionada para indicar a operação esperada (construção ou demolição), mas sem validar nem cobrar antecipadamente.

3. Expor informação mínima acessível:
   - adicionar uma descrição textual no painel/status com coordenada do tile e estado (`livre`, `ocupado por ...` ou `fora do mapa`);
   - garantir que a actualização não cria spam de nós DOM nem remove o feedback de erros existentes;
   - manter labels e controlos actuais.

4. Testes headless:
   - helpers puros para determinar tile/estado de preview;
   - preview livre, ocupado e fora do mapa;
   - limpeza durante pan/pinch/cancel/destroy;
   - regressão de construção unitária, traços touch, pan, zoom e overlays;
   - verificar que preview nunca altera cidade, dinheiro ou métricas.

### Exclui

- selecção persistente de edifícios ou painel de propriedades;
- preview de custo total, preenchimento de área, undo/redo ou confirmação extra;
- alterações à simulação, cenários, eventos, save/load ou advisor;
- novos sprites ou dependências externas;
- browser/manual UI testing.

## Decisões de implementação

- O preview é feedback derivado e efémero; não deve ser guardado em `CityState` nem em saves.
- A fonte de verdade para ocupação e limites continua a ser `CityState`/helpers existentes.
- O renderer deve expor apenas a API mínima necessária para actualizar/remover o preview, evitando duplicar lógica de grid ou câmara.
- Durante pan e pinch, a prioridade é navegação: o preview é removido ou congelado de forma previsível e nunca executa uma operação.

## Critérios de aceitação

- Ao mover o cursor sobre o mapa, o tile alvo fica visivelmente identificado.
- Tiles livres e ocupados têm estados visuais distintos; posições fora do mapa não deixam destaque.
- O painel/status informa a coordenada e o estado do tile sem criar elementos repetidos.
- Pan, zoom, pinch, construção e demolição continuam correctos e o preview não altera estado do jogo.
- `npm test`, `npm run build` e `git diff --check` passam.
- Não é realizado browser/manual UI testing.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 28 segundo este plano.
2. Usar TDD para helpers e lógica de estado do preview.
3. Não adicionar dependências externas.
4. Não fazer commit nem push.
5. Correr `npm test`, `npm run build` e `git diff --check`.
6. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
