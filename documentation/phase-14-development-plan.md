# AICaesar — Plano de Desenvolvimento da Fase 14

## Objetivo

Adicionar navegação de mapa confortável: pan, zoom, controlo de câmara e recentrar.

A cidade vai crescer nas próximas fases. O jogador não pode depender de um mapa sempre encaixado no viewport. Esta fase deve separar o enquadramento inicial da câmara da navegação ativa do jogador.

## Decisão sobre rotação

Não implementar rotação nesta fase.

O jogo usa sprites isométricos 2D pré-renderizados. Rotação livre ou mesmo 90° pode exigir variantes visuais, alterar depth sorting e introduzir erros de seleção. Pan + zoom resolvem o problema atual com muito menos risco.

Rotação de 90° fica como spike futuro, depois de existir road network e câmara estável.

## Estado atual

- `MapRenderer.fit(width, height)` calcula escala e posição para enquadrar o mapa inteiro.
- input de construção usa `map.toLocal(event.global)` antes de `screenToGrid`.
- o mapa não tem câmara persistente: cada refresh/resize chama `fit`.
- PixiJS usa stage events para input.
- não existe pan/zoom.

## Escopo

### Inclui

- estado de câmara explícito;
- pan com drag do botão do meio ou Space + drag do botão esquerdo;
- zoom com roda do rato, centrado sob o cursor;
- botões `Zoom in`, `Zoom out` e `Center map`;
- limites de zoom;
- manter câmara ao refrescar mapa, construir, executar advisor ou mudar overlays;
- recentrar/enquadrar apenas quando o jogador pede ou no primeiro arranque/reset de cenário;
- pequena ajuda de navegação;
- cursor adequado durante pan;
- testes unitários para matemática de zoom e limites;
- README atualizado.

### Exclui

- rotação de mapa;
- mini-map;
- seleção detalhada de tiles;
- keyboard shortcuts além de Space para panning;
- persistir câmara entre reloads;
- browser testing.

## Modelo de câmara

Criar módulo puro, sugerido:

```text
src/rendering/Camera.ts
```

Tipos sugeridos:

```ts
export interface CameraState {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export const MIN_CAMERA_ZOOM = 0.35
export const MAX_CAMERA_ZOOM = 2.5
```

Funções puras sugeridas:

```ts
clampCameraZoom(zoom: number): number
zoomAtScreenPoint(camera, screenPoint, nextZoom): CameraState
panCamera(camera, delta): CameraState
createFittedCamera(mapBounds, viewport): CameraState
```

A matemática deve manter o ponto do mapa sob o cursor estável durante zoom:

1. converter screen point para map-local com estado atual;
2. alterar zoom com clamp;
3. recalcular `x/y` para que esse map-local volte ao mesmo screen point.

Não guardar estado de câmara dentro de `CityState`; é estado de apresentação, não simulação.

## Renderer

Refatorar `MapRenderer` de forma mínima:

- manter métodos para refrescar conteúdo;
- expor aplicação de `CameraState` à transform do container;
- substituir uso automático de `fit` por `fitCamera`/`createFittedCamera` ou equivalente;
- `refresh()` não pode resetar pan/zoom;
- overlays continuam filhos do map container e acompanham transform.

## Input

### Construção

- botão esquerdo sem Space continua a construir;
- construção usa `map.toLocal`, portanto deve continuar correta após pan/zoom;
- drag de pan não pode colocar edifícios ao soltar.

### Pan

Suportar:

- botão do meio + drag; ou
- Space + botão esquerdo + drag.

Durante pan:

- cancelar comportamento de construção;
- cursor `grabbing` enquanto arrasta;
- mover câmera pela diferença de posições globais;
- não alterar `CityState`.

### Zoom

- listener de wheel no canvas;
- `preventDefault()` para evitar scroll da página enquanto cursor está no mapa;
- zoom in/out por multiplicador suave (por exemplo 1.1);
- clamp entre min/max;
- zoom centrado no cursor.

## UI

Criar `src/ui/CameraControls.ts` ou integrar num painel existente.

Mostrar:

- `Zoom in`;
- `Zoom out`;
- `Center map`;
- texto curto:
  - `Pan: middle-drag or Space + left-drag`
  - `Zoom: mouse wheel or controls`

Adicionar tooltips (`title`) a cada controlo.

## Reset/resize

- reset de cidade deve voltar a enquadrar e centrar mapa para o cenário novo;
- resize não deve destruir pan/zoom do jogador;
- se viewport mudar, manter camera transform atual e apenas redesenhar;
- `Center map` calcula novamente o enquadramento ideal para o viewport atual.

## Critérios de aceitação

A Fase 14 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- jogador consegue pan do mapa;
- jogador consegue zoom com roda e botões;
- zoom mantém o ponto sob cursor estável;
- zoom respeita min/max;
- existe botão `Center map`;
- refresh de mapa não reseta camera;
- construção continua correta após pan/zoom;
- drag de pan não constrói edifícios;
- overlays permanecem alinhados;
- reset recentra mapa;
- rotação não é implementada;
- README documenta controlos;
- não é feito browser testing.

## Testes obrigatórios

Seguir TDD.

Testes mínimos:

1. zoom é limitado por min/max;
2. `zoomAtScreenPoint` mantém map-local sob o cursor;
3. pan soma delta corretamente;
4. fitted camera centra bounds no viewport;
5. refresh não altera camera aplicada, se for simples testar;
6. reset/center pede fitted camera, se for simples testar sem DOM pesado.

## Decisões para evitar overengineering

- não criar sistema de cenas;
- não guardar camera em CityState;
- não adicionar mini-map;
- não adicionar rotação;
- não implementar física/inércia;
- não adicionar dependência externa;
- não fazer browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 14 com TDD;
2. preservar construção, overlays, advisor e cenário;
3. manter câmara como estado de apresentação separado;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
