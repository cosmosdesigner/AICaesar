# AICaesar — Plano de Desenvolvimento da Fase 22

## Objetivo

Permitir que o jogador guarde e retome a cidade no mesmo browser, sem backend e sem introduzir uma camada de persistência maior do que o necessário.

```text
CityState actual
      ↓ Save
JSON envelope + schemaVersion → localStorage
      ↓ Load
parse → validate → hydrate → recalculate derived state → refresh UI
```

Resultado esperado:

- o jogador consegue clicar em `Save` e guardar a cidade actual;
- `Load` restaura buildings, recursos, tick, finanças, população, stocks, eventos e pedidos;
- saves inválidos, antigos ou corrompidos falham de forma segura e explicável;
- a versão do schema fica explícita;
- `Reset` continua a criar uma cidade nova e não é substituído por Load;
- carregar um save não avança ticks nem executa acções adicionais.

## Estado actual

- `CityState` contém mapa, tiles, buildings, money e `simulation`;
- `Building` pode conter nível/serviços/progressos, população, actividade e stock de comida;
- `simulation` contém tick, finance, population e o `EventState` opcional da Fase 21;
- rede viária, desirability, food coverage, housing stats, workers e cenário são derivados do estado actual;
- `Game.ts` mantém `city` num closure, faz `refreshCity()` após alterações e recria a cidade no Reset;
- não existe serialização, armazenamento local nem UI de Save/Load;
- o projecto usa TypeScript estrito, Vitest e não tem dependências de DOM testing dedicadas;
- browser/manual UI testing continua fora do workflow.

## Escopo

### Inclui

- módulo puro de serialização/validação, por exemplo `src/persistence/CitySave.ts`;
- envelope JSON com `schemaVersion` explícito;
- serialização de todo o estado necessário para retomar uma sessão:
  - dimensões e tiles;
  - buildings e todos os campos persistentes actuais;
  - money;
  - tick, finanças, população e eventos da Fase 21;
- `saveCityState(city, storage?)` com chave local namespaced;
- `loadCityState(storage?)` com parse, validação e resultado discriminado;
- validação estrutural e de invariantes antes de devolver um estado;
- clone/hydration que não partilha referências com o payload JSON;
- recalculação de estado derivado após Load, sem avançar o tick;
- painel HTML ou `SaveLoadControls` com botões `Save` e `Load`;
- mensagens de sucesso, ausência de save, schema incompatível, JSON inválido e storage indisponível;
- integração de Load com mapa, painéis, eventos, scenario, advisor, overlays e câmara;
- testes unitários de round-trip, validação, compatibilidade e erros de storage;
- testes headless do lifecycle/callbacks do novo painel através de mocks existentes;
- actualização do README.

### Exclui

- backend, API, contas, sincronização ou cloud saves;
- múltiplos slots, thumbnails, autosave ou histórico de saves;
- compressão, encriptação ou migrações de vários schemas;
- import/export de ficheiros, File System Access API ou download/upload;
- serialização de objectos PixiJS, texturas, camera ou DOM;
- replay, undo/rollback ou snapshots históricos;
- alterações ao balanceamento, eventos, advisor, economia ou cenário;
- browser/manual UI testing;
- dependências novas.

## Formato do save

Usar um envelope estável e mínimo:

```ts
interface CitySaveEnvelope {
  readonly schemaVersion: 1;
  readonly city: SerializedCityState;
}
```

A chave deve ser explícita e namespaced, por exemplo:

```text
aicaesar.save.v1
```

Não adicionar timestamps dependentes do relógio nem metadados dispensáveis. A data de gravação não é necessária para o loop actual.

`SerializedCityState` pode reutilizar a forma JSON de `CityState`, desde que o módulo não serialize referências PixiJS nem dependa de classes. A solução preferida é serializar uma cópia de dados simples e reconstruir arrays/objects no Load.

Persistir também:

- `simulation.events.seed`;
- eventos activos e respectivos warnings/targets/duração;
- `events.history` e `events.processed` para evitar re-disparos depois de Load;
- pedido imperial pendente, fulfilled ou failed quando existir;
- stocks de granaries/markets;
- progressos de evolução/degradação e população actual das houses.

Não persistir valores que sejam apenas cache do renderer ou calculados exclusivamente a partir da cidade. Se campos derivados como `active`, `hasWater` e `hasFood` forem incluídos para preservar o snapshot visual, devem ser recalculados ou normalizados no Load antes de a cidade ser usada.

## Serialização e API

Criar uma API pequena e testável, com nomes equivalentes a:

```ts
const SAVE_STORAGE_KEY = 'aicaesar.save.v1';
const SAVE_SCHEMA_VERSION = 1;

type SaveResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly code: SaveErrorCode; readonly message: string };

type LoadResult =
  | { readonly ok: true; readonly city: CityState; readonly message: string }
  | { readonly ok: false; readonly code: LoadErrorCode; readonly message: string };

function serializeCityState(city: CityState): string;
function deserializeCityState(payload: string): LoadResult;
function saveCityState(city: CityState, storage?: Storage): SaveResult;
function loadCityState(storage?: Storage): LoadResult;
```

Os nomes exactos ficam ao critério do OMP, mas as funções puras de serialize/deserialize devem poder ser testadas sem `window`.

Regras:

- `serializeCityState` não muta a cidade;
- `deserializeCityState` nunca devolve o objecto de `JSON.parse` directamente;
- erros de `JSON.parse`, `storage.getItem`, `storage.setItem` e `storage.removeItem` devem ser capturados;
- storage ausente, bloqueado ou cheio devolve erro estruturado, não uma excepção não tratada;
- uma tentativa de Load inválida não altera a cidade que está actualmente em jogo;
- não usar `eval`, construtores dinâmicos ou execução de texto vindo do save.

## Validação obrigatória

Validar antes da hydration e rejeitar o payload inteiro em caso de erro. No mínimo:

### Envelope

- valor raiz é objecto não nulo e não array;
- `schemaVersion` é exactamente o número suportado `1`;
- `city` é objecto;
- schema ausente, versão futura ou versão incompatível devolve código distinto de JSON inválido quando possível.

### Cidade e tiles

- `width` e `height` são inteiros positivos dentro de limites razoáveis;
- número de tiles é exactamente `width * height`;
- cada tile tem coordenadas inteiras dentro dos limites;
- coordenadas e ordem dos tiles são consistentes com o índice;
- `terrain` é um valor suportado (`grass`);
- `buildingId`, quando presente, é string.

### Buildings

- `buildings` é array;
- ids são strings não vazias e únicos;
- tipos pertencem ao `BuildingType` actual;
- coordenadas são inteiras dentro do mapa;
- não existem dois buildings na mesma tile;
- cada `tile.buildingId` aponta para o building correcto e não existem referências pendentes;
- níveis, população, progressos e stocks são números finitos e não negativos quando presentes;
- população é inteira e não excede a capacidade derivada de `HouseSpecification`;
- fields específicos de houses/workplaces respeitam os tipos actuais;
- `active` é boolean quando presente.

### Recursos e simulação

- `resources.money` é número finito;
- `simulation.tick` é inteiro não negativo;
- finance period é inteiro não negativo e os valores financeiros são finitos;
- `population.lastChange` é inteiro finito;
- EventState, quando presente, respeita a forma da Fase 21:
  - seed finita;
  - arrays active/history/processed;
  - ids processados são strings;
  - status, tipos, ticks e targets válidos;
  - request tem quantidade/prazo/recompensa/penalização finitos e status suportado.

A validação não deve tentar reparar silenciosamente payloads corrompidos. Defaults só podem ser aplicados a campos opcionais que já são opcionais no modelo e cuja ausência seja compatível com saves anteriores do mesmo schema.

## Hydration e estado derivado

Após um Load válido:

1. construir novos arrays/objects de tiles, buildings, resources e simulation;
2. preservar exactamente o estado persistido válido, incluindo stocks, progressos, população e eventos;
3. recalcular referências `tile.buildingId` apenas a partir dos dados validados;
4. reatribuir workers/actividade com as regras actuais sem produzir comida nem avançar tick;
5. deixar rede, desirability, coverage, housing stats, analyzer e cenário serem derivados normalmente;
6. não chamar `simulateTick()` durante Load;
7. não aplicar impostos, penalizações de pedido, warnings ou impactos de eventos durante Load;
8. se a API actual exigir um helper, criar uma função explícita de `recalculateDerivedState` em vez de simular um tick artificial.

Os eventos activos guardados devem continuar activos até ao mesmo `endTick`; o Load não deve duplicar mensagens nem reactivar efeitos one-shot porque `processed` foi persistido.

## Integração com Game e UI

Adicionar `SaveLoadControls` ou estender um painel actual com:

```text
[Save] [Load]
Save status: City saved locally.
```

Requisitos:

- `Save` grava a referência actual de `city` e mostra sucesso/erro;
- `Load` tenta ler o storage e, em sucesso, substitui a variável `city` pela nova cidade;
- depois de Load chamar o mesmo refresh central usado por ticks/Reset, sem recenter obrigatório;
- overlays, tool seleccionada, pausa/velocidade e camera permanecem como configuração da sessão, não como parte do save;
- scenario status é reavaliado a partir da cidade carregada;
- se o cenário carregado estiver won/lost, pausa e bloqueios actuais continuam a aplicar-se;
- EventPanel, BuildPanel, ScenarioPanel e AdvisorPanel recebem o estado carregado;
- plano advisor pendente/report de UI deve ser limpo ou invalidado ao carregar uma cidade diferente, para nunca aprovar um plano criado para outro estado;
- Load sem save não muda nada;
- Load inválido não muda nada;
- Reset continua disponível e limpa apenas a sessão actual, não precisa de apagar automaticamente o save local;
- botões têm `title`, feedback via `role=status` e cleanup no `destroy()`;
- não usar browser/manual UI testing.

Decisão recomendada: Reset não deve apagar o save. Isto permite experimentar uma cidade guardada e voltar a ela depois; apagar save não faz parte desta fase.

## Compatibilidade e segurança

Preservar:

- todas as regras das fases 1–21;
- events e imperial requests;
- food logistics, road network e desirability;
- população, workers e finanças;
- cenário e bloqueio terminal;
- advisor approval/action validator;
- overlays e câmara;
- ausência de chamadas de rede e de dependências novas.

O save é input não confiável, mesmo sendo local. Não aceitar tipos arbitrários, prototypes especiais ou campos que alterem código. O carregamento deve ser fail-closed: em dúvida, rejeitar e manter a cidade actual.

Não guardar chaves, passwords, tokens ou dados externos. O payload só deve conter estado de jogo.

## Testes obrigatórios

Seguir TDD para serialização, validação e integração de Load. Testes novos devem poder correr sem browser real.

Testes mínimos:

1. serialize/deserialize de cidade seedada preserva mapa, buildings, money, tick, finanças e população;
2. round-trip preserva stocks de granary/market, progressos e campos da Fase 21;
3. round-trip preserva events active/history/processed e pedido imperial;
4. serialização não muta a cidade original;
5. Load devolve cópia sem referências partilhadas com o payload ou a cidade anterior;
6. JSON inválido é rejeitado com erro estruturado;
7. raiz não-objecto, city ausente ou schema ausente são rejeitados;
8. schema futuro/incorrecto é rejeitado sem mutação;
9. width/height/tiles inconsistentes são rejeitados;
10. coordenadas fora do mapa, ids duplicados ou buildings sobrepostos são rejeitados;
11. referências de `buildingId` pendentes são rejeitadas;
12. tipos, níveis, população, stocks, ticks e finanças inválidos são rejeitados;
13. saves com EventState inválido são rejeitados de forma segura;
14. storage sem save devolve `not_found` sem mutação;
15. storage que lança em get/set devolve erro sem quebrar a aplicação;
16. Load não chama `simulateTick`, não muda o tick e não aplica finanças/eventos;
17. workers/estado derivado são recalculados após Load;
18. Save escreve a chave e envelope `schemaVersion` correctos;
19. Game integra Save/Load e chama refresh no sucesso;
20. Load inválido preserva a mesma referência/estado da cidade actual;
21. Load limpa ou invalida advisor plan/report pendente;
22. Reset continua a restaurar cidade seedada sem apagar save automaticamente;
23. novo painel/controller é destruído no cleanup da Game;
24. regressão completa de events, desirability, road network, food logistics, population, finance, scenario, advisor, actions e renderer;
25. `npm test` e `npm run build` passam sem browser testing.

## Critérios de aceitação

A Fase 22 está concluída quando:

- `npm run test` passa;
- `npm run build` passa;
- Save grava a cidade actual em `localStorage` com schema versionado;
- Load restaura uma cidade equivalente sem avançar o tick;
- stocks, população, finanças e eventos são preservados;
- estado derivado é recalculado de forma segura;
- saves inválidos/antigos/corrompidos não alteram a cidade em memória;
- UI mostra Save, Load e feedback compreensível;
- Reset continua disponível e mantém o save por defeito;
- advisor não pode executar plano criado para uma cidade anterior ao Load;
- não existe backend nem dependência nova;
- não é feito browser/manual UI testing;
- working tree fica limpo depois do commit/push.

## Decisões para evitar overengineering

- uma chave local, um slot, um schema;
- JSON simples e versionado;
- sem timestamp, compressão ou encriptação nesta fase;
- validação fail-closed em vez de migrações especulativas;
- Storage injectável para testes;
- nenhum save de renderer/camera/DOM;
- Load não é um tick e não usa `simulateTick()` como atalho;
- Reset não apaga save automaticamente;
- sem backend, rede ou sincronização;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 22;
2. seguir TDD para serialize/deserialize/validate/storage e Load;
3. preservar as fases 1–21;
4. actualizar testes, README e UI necessários;
5. correr `npm test` e `npm run build`;
6. não usar browser testing;
7. não fazer commit ou push da implementação;
8. devolver resumo, ficheiros alterados e evidência de verificação.
