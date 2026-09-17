# AICaesar — Plano de Desenvolvimento da Fase 25

## Objetivo

Transformar o protótipo de um único cenário numa experiência jogável com conteúdo, progressão e balanceamento explícito: três cenários curtos e determinísticos, dificuldade Easy/Normal, métricas de sessão e um checklist de playtest reproduzível.

A fase não deve criar uma economia nova nem esconder balanceamento em valores espalhados. Deve tornar os valores existentes configuráveis por cenário/dificuldade, preservar o loop actual e provar que cada cenário tem uma intenção distinta.

```text
 jogador escolhe cenário + dificuldade
             ↓
 cidade seedada com perfil determinístico
             ↓
 objetivos, limites e pressão adequados ao desafio
             ↓
 jogador joga / advisor reage ao cenário activo
             ↓
 vitória ou derrota produz métricas de sessão
             ↓
 reset repete exactamente o mesmo cenário e dificuldade
```

## Estado actual

- existe apenas `FOUNDING_SETTLEMENT_SCENARIO`, com seed única criada por `createCityState()`;
- `ScenarioDefinition` contém objetivos, limite de ticks e derrota por dinheiro;
- `Game.ts` fixa o cenário Founding Settlement no painel, advisor, refresh e bloqueio terminal;
- dinheiro inicial, custos de construção, ritmo de população, finanças, comida e eventos usam constantes globais;
- save/load serializa apenas `CityState` em schema version 1 e não conhece seleção de cenário;
- o advisor estratégico recebe `ScenarioProgress`, mas não metadados de dificuldade;
- não há métricas de sessão nem checklist de playtest no repositório;
- o projeto usa TypeScript estrito, Vitest e testes headless — browser/manual UI testing fica fora de escopo.

## Escopo

### Inclui

- catálogo imutável com exactamente três cenários jogáveis:
  1. `founding-settlement` — ensina serviços e crescimento;
  2. `merchant-quarter` — exige planeamento de estrada, comida, workers e dinheiro;
  3. `resilient-province` — testa resiliência perante tempo/pressão de eventos sem introduzir eventos novos;
- seletor simples de cenário e dificuldade `Easy`/`Normal` antes de iniciar/reiniciar a cidade;
- perfis de seed determinísticos por cenário, sem assets ou edifícios novos;
- perfil de dificuldade determinístico que ajusta apenas valores declarados e existentes (por exemplo dinheiro inicial, objetivos, limite de ticks e limiar de derrota), sem aleatoriedade;
- configuração de balanceamento centralizada e tipada, em vez de magic numbers adicionais nos módulos de jogo;
- objetivos graduais e briefing específico por cenário;
- `SessionMetrics` derivadas de estado de sessão: cenário, dificuldade, tick final/actual, estado, população máxima, dinheiro mínimo, dinheiro final, edifícios construídos/demolidos, planos aprovados/rejeitados e pedidos imperiais cumpridos/falhados quando aplicável;
- painel pequeno de métricas, actualizado durante a sessão e preservado até reset/troca de cenário;
- checklist de playtest em `documentation/phase-25-playtest-checklist.md` com rotas determinísticas e resultado esperado por cenário/dificuldade;
- testes unitários para catálogo, perfis, avaliação de objetivos, dificuldade, seeds e métricas;
- testes headless da seleção/reset/lifecycle onde os seams existentes o permitirem;
- atualização de README e documentação.

### Exclui

- novos edifícios, tipos de goods, comércio externo, walkers, combate, crime, safety, tax collectors ou classes sociais;
- novos eventos, RNG, eventos aleatórios ou alteração da sequência determinística actual de eventos;
- AI/LLM real, chamadas de rede, backend, contas, analytics remotas ou telemetria;
- alteração do schema version 1 de save/load;
- slots, autosave, cloud save, import/export de ficheiros;
- dificuldade dinâmica/adaptativa;
- balanceamento por browser/manual playtest nesta fase;
- browser/manual UI testing.

## Decisões de design

### Cenários

Usar as mesmas mecânicas, não novos sistemas.

| Cenário | Papel | Foco | Pressão principal |
|---|---|---|---|
| Founding settlement | tutorial | água, casas, primeira cadeia de comida | objetivos acessíveis e tempo generoso |
| Merchant quarter | planeamento | layout por estrada, cadeia farm→granary→market, workers e tesouraria | orçamento menor/objetivos mais altos |
| Resilient province | resiliência | manter população, comida e tesouraria durante o calendário actual | janela temporal e eventos existentes relevantes |

Os valores exactos devem ficar num módulo tipado de configuração. O OMP deve escolher valores pequenos e verificáveis por testes, justificando-os no README/checklist. Não inventar mecânicas para diferenciar cenários.

### Dificuldade

A dificuldade é um perfil explícito aplicado à definição base, sem mutar definições globais:

```ts
type DifficultyId = 'easy' | 'normal';

interface DifficultyProfile {
  readonly id: DifficultyId;
  readonly label: string;
  readonly initialMoney: number;
  readonly objectiveTargetMultiplier: number;
  readonly maxTickMultiplier: number;
  readonly loseBelowMoney: number;
}
```

Regras:

- `Normal` preserva os valores base do cenário;
- `Easy` só torna a sessão mais permissiva: mais dinheiro, metas inferiores ou iguais, mais tempo e limiar de derrota inferior ou igual;
- alvos percentuais devem ser arredondados de modo determinístico e mantidos no intervalo 0–100;
- objetivos `at-most` (worker shortage) devem ser tratados correctamente: Easy permite um valor maior, não menor;
- definições e perfis exportados permanecem imutáveis;
- o cenário/dificuldade seleccionados são estado de sessão, não parte do save local.

### Seed e reset

- criar uma pequena API de criação de cidade por perfil, mantendo `createCityState()` compatível para testes existentes e como seed founding normal;
- cada perfil deve construir apenas com APIs/estruturas já existentes e atribuir população inicial deliberadamente;
- Reset recria o mesmo cenário+dificuldade e limpa métricas da sessão;
- trocar cenário/dificuldade inicia explicitamente uma nova cidade e limpa plano/report do advisor;
- Load carrega apenas a cidade gravada: não deve inferir cenário da cidade nem corromper a seleção de sessão; a UI deve explicar que o save não guarda seleção de cenário/dificuldade, se necessário;
- a câmara continua a recentrar apenas em reset/troca de cenário, não em ticks/refresh.

### Métricas de sessão

`SessionMetrics` é derivada e mantida na camada de jogo, sem persistência:

```ts
interface SessionMetrics {
  readonly scenarioId: string;
  readonly difficulty: DifficultyId;
  readonly status: ScenarioStatus;
  readonly currentTick: number;
  readonly peakPopulation: number;
  readonly lowestMoney: number;
  readonly currentMoney: number;
  readonly buildingsConstructed: number;
  readonly buildingsDemolished: number;
  readonly advisorPlansApproved: number;
  readonly advisorPlansRejected: number;
  readonly imperialRequestsFulfilled: number;
  readonly imperialRequestsFailed: number;
}
```

- Não contar seed buildings como construções do jogador;
- incrementar contadores apenas após operações bem-sucedidas;
- não inferir aprovação/rejeição através de texto da UI; expor callbacks/resultado explícito quando necessário;
- requests podem ser derivados de histórico de eventos, se já houver informação suficiente, em vez de criar estado paralelo;
- o painel é informativo e não modifica a simulação.

## Integração

### Cenário e Game

- substituir referências fixas a `FOUNDING_SETTLEMENT_SCENARIO` por `activeScenario` resolvido a partir do catálogo + dificuldade;
- `ScenarioPanel`, advisor context/progress, terminal gate e `refreshCity()` devem usar a definição activa;
- criar um painel/controlador HTML pequeno para seleção de cenário/dificuldade e início/reinício;
- bloquear/desactivar seleção apenas durante uma transição de inicialização; não introduzir modais;
- garantir `destroy()` completo para qualquer novo painel/listener;
- o advisor deve receber o progresso do cenário activo e manter a validação existente.

### Balanceamento

- extrair apenas os valores necessários para perfil de cenário/dificuldade; não reescrever toda a simulação;
- preservar o comportamento exacto de Founding Settlement Normal como baseline salvo quando a configuração fizer esse valor já explícito;
- custos de construção devem ser lidos de uma tabela de balanceamento configurável por sessão somente se essa alteração for necessária e puder ser totalmente validada; caso contrário, manter `BUILD_COSTS` global e diferenciar cenários por seed, objetivos, dinheiro e tempo;
- não alterar o save schema: a cidade carregada continua a validar com `BUILD_COSTS` e regras vigentes.

## Testes obrigatórios

Seguir TDD para a lógica determinística nova.

Testes mínimos:

1. catálogo exporta exactamente três cenários imutáveis com ids e briefings distintos;
2. cada cenário em Normal tem objetivos, seed e condições de derrota avaliáveis;
3. Easy é sempre mais permissivo que Normal, incluindo objetivo `at-most` e percentagens limitadas;
4. Founding Settlement Normal preserva targets, limite, dinheiro inicial e comportamento esperado da Fase 24;
5. cada seed é determinístico e só contém edifícios/tipos suportados;
6. reset recria a mesma cidade para cenário+dificuldade e limpa métricas;
7. trocar cenário/dificuldade cria cidade nova, reinvalida advisor e actualiza painel/contexto;
8. cenário terminal bloqueia construir, demolir e aprovar como antes;
9. métricas contam apenas construções/demolições/aprovações bem-sucedidas e guardam peak population/lowest money;
10. métricas não alteram `CityState` nem são serializadas no schema de save;
11. load corrupto, save v1 válido e eventos continuam com comportamento existente;
12. todos os novos painéis/controladores limpam listeners no `destroy()`;
13. `npm test` passa;
14. `npm run build` passa;
15. `git diff --check` passa;
16. não é feito browser/manual UI testing.

## Critérios de aceitação

A Fase 25 está concluída quando:

- o jogador pode iniciar/resetar qualquer um de três cenários e escolher Easy/Normal;
- cada cenário tem papel, objetivos e briefing diferentes usando os sistemas existentes;
- Easy é verificavelmente mais permissivo do que Normal;
- Founding Settlement Normal mantém o baseline funcional anterior;
- o cenário activo controla painel, advisor, terminal gate e reset;
- métricas de sessão fornecem feedback útil sem persistência ou telemetria;
- existe checklist de playtest reproduzível para validar o loop de 30 minutos sem depender de browser test automatizado;
- Save/Load schema v1 continua compatível;
- `npm test` passa;
- `npm run build` passa;
- não é feito browser/manual UI testing;
- working tree fica limpo depois de commit/push.

## Decisões para evitar overengineering

- três cenários, dois perfis e configuração local tipada — não uma plataforma de campanhas;
- perfis de seed determinísticos, não gerador procedural;
- métricas locais derivadas, não analytics;
- sem persistir escolha/métricas no save v1;
- sem rebalançar todos os sistemas simultaneamente;
- validar o jogo com checklist antes de adicionar conteúdo ou mecânicas novas.

## Entrega esperada do OMP

O OMP deve:

1. implementar exclusivamente a Fase 25;
2. seguir TDD para catálogo, dificuldade, seed, métricas e integração;
3. preservar todas as fases 1–24;
4. atualizar testes, README e checklist de playtest;
5. correr `npm test`, `npm run build` e `git diff --check`;
6. não usar browser testing;
7. não fazer commit ou push da implementação;
8. devolver resumo, ficheiros alterados e evidência de verificação.
