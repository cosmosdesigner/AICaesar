# AICaesar — Plano de Desenvolvimento da Fase 2

## Objetivo

Implementar construção manual básica sobre a base visual da Fase 1.

No final desta fase, o jogador deve conseguir selecionar uma ferramenta de construção e clicar no mapa para colocar estrada, casa ou poço.

Esta fase ainda não implementa água, comida, trabalhadores, advisor ou IA.

## Estado atual

A Fase 1 já entregou:

- Vite + TypeScript;
- PixiJS;
- mapa 30x30 renderizado;
- `CityState` seedado;
- `MapRenderer`;
- conversão `gridToScreen` / `screenToGrid`;
- sprites temporários para terreno, estrada, casa e poço.

## Resultado esperado

Ao correr `npm run dev`, deve ser possível:

1. ver o mapa;
2. selecionar uma ferramenta: road, house ou well;
3. clicar num tile vazio;
4. colocar o edifício escolhido;
5. ver o dinheiro diminuir;
6. receber feedback quando a ação é inválida.

## Escopo da Fase 2

### Inclui

- painel simples de construção;
- seleção de ferramenta;
- dinheiro inicial;
- custo por edifício;
- validação de tile livre;
- clique no mapa para construir;
- atualização visual do mapa;
- feedback de erro simples;
- botão reset opcional.

### Exclui

- simulação de água;
- evolução de casas;
- farms/granaries/markets;
- workers;
- advisor;
- LLM;
- pathfinding;
- walkers;
- demolição.

## Modelo de dados

A Fase 1 tem `Tile.building?: BuildingType`.

Na Fase 2, podemos manter esse modelo simples. Não é necessário introduzir `Building` com ID ainda, a menos que a implementação fique mais simples com isso.

Extensão mínima:

```ts
type BuildingType = 'road' | 'house' | 'well'

type BuildTool = BuildingType

type BuildCosts = Record<BuildingType, number>
```

Custos sugeridos:

```ts
road: 4
house: 20
well: 35
```

Dinheiro inicial:

```ts
initialMoney: 500
```

## Regras de construção

1. Só é possível construir dentro do mapa.
2. Só é possível construir em tile sem edifício.
3. É preciso ter dinheiro suficiente.
4. Se a construção for válida:
   - atualiza `CityState`;
   - subtrai custo;
   - re-renderiza mapa;
   - mostra feedback positivo curto.
5. Se for inválida:
   - não altera estado;
   - não altera dinheiro;
   - mostra mensagem de erro.

## Input

Usar PixiJS pointer events no canvas/mapa.

Fluxo:

```text
pointer down
→ converter coordenadas globais para coordenadas locais do MapRenderer
→ screenToGrid(localX, localY)
→ validar tile
→ construir se válido
→ renderizar novamente
```

Importante:

- `screenToGrid` recebe coordenadas locais do mapa, não coordenadas da janela.
- O renderer deve expor método para converter/passar input, ou o Game deve usar `map.toLocal(...)`.

## Renderização

A Fase 1 renderiza estado uma vez no construtor do `MapRenderer`.

Na Fase 2, o renderer deve conseguir atualizar quando o estado muda.

Opção simples:

- adicionar método `render(city, textures)` ou `refresh(city)`;
- limpar containers;
- desenhar tudo novamente.

Isto é aceitável para 30x30.

Não otimizar prematuramente.

## UI mínima

Adicionar painel HTML simples por cima/ao lado do canvas.

Elementos:

- dinheiro atual;
- ferramenta selecionada;
- botões:
  - Road;
  - House;
  - Well;
- mensagem de estado;
- botão Reset opcional.

Não usar framework.

Pode ser HTML criado em `index.html` e manipulado por TypeScript.

## Ficheiros esperados

Possíveis alterações/criações:

```text
src/input/BuildTool.ts
src/ui/BuildPanel.ts
src/game/Game.ts
src/simulation/CityState.ts
src/simulation/Tile.ts
src/rendering/MapRenderer.ts
src/rendering/GridMath.ts
src/style.css
index.html
README.md
```

A estrutura exata pode variar se a implementação ficar mais simples.

## Critérios de aceitação

A Fase 2 está concluída quando:

- `npm run build` passa;
- o mapa continua a renderizar;
- existe painel de construção visível;
- o jogador consegue selecionar road, house e well;
- clique em tile vazio constrói o edifício selecionado;
- dinheiro diminui conforme custo;
- construção em tile ocupado é rejeitada;
- construção sem dinheiro é rejeitada;
- clique fora do mapa é ignorado ou mostra erro não destrutivo;
- reset restaura cidade e dinheiro inicial;
- README é atualizado com a Fase 2.

## Testes manuais mínimos

1. Abrir app.
2. Selecionar Road.
3. Clicar num tile vazio.
4. Confirmar estrada aparece e dinheiro diminui.
5. Selecionar House.
6. Clicar no mesmo tile.
7. Confirmar erro: tile ocupado.
8. Selecionar Well.
9. Clicar noutro tile vazio.
10. Confirmar poço aparece.
11. Clicar reset.
12. Confirmar estado inicial restaurado.

## Decisões para evitar overengineering

- Re-renderizar o mapa completo após construção é aceitável.
- Não introduzir ECS.
- Não introduzir Zustand/Redux.
- Não criar backend.
- Não implementar seleção visual de tile ainda, salvo se for muito simples.
- Não adicionar IA nesta fase.

## Próxima fase

Fase 3: consolidar `CityState`, `Building`, `ResourceState` e garantir que renderização deriva totalmente do estado.

Se a Fase 2 já introduzir mutações limpas no `CityState`, a Fase 3 poderá ser menor.
