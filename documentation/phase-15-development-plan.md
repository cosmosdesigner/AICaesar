# AICaesar — Plano de Desenvolvimento da Fase 15

## Objetivo

Fazer dinheiro importar como parte do loop de jogo.

Até agora, dinheiro só desce quando o jogador constrói. Esta fase introduz rendimento residencial, upkeep de serviços e um balanço periódico, para que expandir, manter infraestrutura e evoluir casas passem a ser decisões económicas reais.

## Estado atual

- cenário `Found a functioning settlement` exige dinheiro >= 100;
- cenário termina se dinheiro < 50;
- casas têm níveis 1–3;
- população é derivada de níveis de casa;
- farms, granaries e markets podem estar ativos/inativos;
- não existem impostos, upkeep nem alteração automática de dinheiro;
- ticks de simulação já existem e podem correr a 1x/2x/4x.

## Escopo

### Inclui

- período financeiro determinístico;
- impostos por nível de casa;
- upkeep de well/farm/granary/market;
- receita, upkeep e net balance visíveis;
- dinheiro atualizado a cada período;
- painel financeiro simples;
- integração com analyzer e cenário existentes;
- testes unitários;
- README atualizado.

### Exclui

- comércio externo;
- tax collectors/walkers;
- salários;
- empréstimos;
- preços dinâmicos;
- custos de alimentos;
- impostos por população dinâmica;
- múltiplas moedas;
- backend/persistência;
- browser testing.

## Decisões de design

### Período financeiro

Aplicar balanço a cada 10 ticks:

```ts
FINANCE_INTERVAL_TICKS = 10
```

Isto dá feedback suficientemente rápido a 1x e continua consistente com speed controls.

### Receita por casa

Usar valor fixo por casa e por período, baseado no nível atual:

```ts
HOUSE_TAX_BY_LEVEL = {
  1: 2,
  2: 4,
  3: 7,
}
```

Motivo:

- nível já representa serviços e população nesta versão;
- evita inventar população individual antes da Fase 18;
- casas evoluídas tornam-se economicamente valiosas;
- valores são fáceis de balancear mais tarde.

### Upkeep

Usar custo por edifício por período:

```ts
BUILDING_UPKEEP = {
  well: 1,
  farm: 3,
  granary: 3,
  market: 3,
}
```

Regras:

- roads e houses não têm upkeep nesta fase;
- upkeep é pago mesmo quando farm/granary/market estão inativos;
- edifícios inativos continuam a consumir recursos da cidade;
- isto evita que construir infraestrutura a mais seja gratuito.

### Balanço

```ts
revenue = sum(taxes from houses)
upkeep = sum(upkeep from relevant buildings)
net = revenue - upkeep
money += net
```

Permitir `money` ficar abaixo de zero através do balanço. Construção continua a bloquear se não houver dinheiro suficiente.

### Falência

Não criar uma segunda regra de derrota nesta fase.

O cenário já termina quando `money < 50`. Com economia periódica, essa condição passa a ser uma falência funcional e observável.

A futura camada de múltiplos cenários poderá configurar limiar e tolerância de falência por cenário.

## Modelo de dados

Adicionar estado financeiro mínimo a `SimulationState`:

```ts
interface FinanceState {
  period: number
  lastRevenue: number
  lastUpkeep: number
  lastNet: number
}

interface SimulationState {
  tick: number
  finance: FinanceState
}
```

Não guardar totais históricos nesta fase. O after-action report já cobre snapshots antes/depois de advisor actions.

## API sugerida

Criar `src/simulation/Finance.ts` ou manter em `Simulation.ts` se ficar pequeno.

Funções sugeridas:

```ts
getHouseTax(city: CityState): number
getBuildingUpkeep(city: CityState): number
getFinanceStats(city: CityState): FinanceStats
applyFinancePeriod(city: CityState): FinanceStats
```

```ts
interface FinanceStats {
  readonly period: number
  readonly revenue: number
  readonly upkeep: number
  readonly net: number
  readonly money: number
  readonly ticksUntilNextPeriod: number
}
```

Preferência:

- funções puras para cálculo;
- apenas `applyFinancePeriod` altera estado;
- `simulateTick` decide quando aplicar o período.

## Ordem no tick

Em `simulateTick(city)`:

1. incrementar tick;
2. atualizar workers;
3. produzir/distribuir comida;
4. atualizar casas;
5. reatribuir workers;
6. se tick for múltiplo de `FINANCE_INTERVAL_TICKS`, aplicar balanço financeiro.

A avaliação de cenário ocorre no fluxo de jogo após o tick, como já acontece.

## UI

Adicionar secção financeira ao painel atual ou novo painel pequeno.

Mostrar:

```text
Finance
Period: 3
Taxes: +16
Upkeep: -10
Net: +6
Treasury: 518
Next balance: 7 ticks
```

Requisitos:

- valores positivos/negativos legíveis;
- tooltip curto a explicar impostos/upkeep;
- não criar gráfico nem histórico.

## Analyzer e advisor

Manter analyzer atual de low money.

Atualizar contexto do advisor apenas se for simples:

```text
Finance: +6 per period, treasury 518.
```

Não criar novas advisor actions nesta fase. O advisor existente já pode sugerir `wait` quando dinheiro baixo.

## Inspiração Caesaria

Usar só como referência conceptual:

```text
/root/caesaria-game-inspect/source/objects/house.cpp
/root/caesaria-game-inspect/source/objects/house_spec.hpp
/root/caesaria-game-inspect/bin/resources/missions/caesarea.mission
```

Conceitos a adaptar:

- casas de nível superior têm maior valor;
- dinheiro/critérios económicos fazem parte da missão;
- não copiar tabelas nem implementação C++.

## Testes obrigatórios

Seguir TDD: criar e executar testes falhados antes de código de produção.

Testes mínimos:

1. casas de nível 1/2/3 calculam impostos corretos;
2. well/farm/granary/market calculam upkeep correto;
3. workplace inativo continua a pagar upkeep;
4. roads/houses não pagam upkeep;
5. balanço financeiro altera dinheiro pelo net correto;
6. `simulateTick` só aplica finance no intervalo configurado;
7. dinheiro pode ficar negativo devido a upkeep;
8. reset restaura period/last revenue/upkeep/net.

## Critérios de aceitação

A Fase 15 está concluída quando:

- `npm run build` passa;
- `npm test` passa;
- cada 10 ticks aplica receita/upkeep;
- casas nível maior geram mais impostos;
- serviços têm upkeep;
- infraestrutura inativa continua a custar dinheiro;
- UI mostra período, receita, upkeep, net e treasury;
- cenário pode perder por dinheiro baixo devido à economia;
- reset limpa estado financeiro;
- analyzer de dinheiro baixo continua correto;
- README documenta regras/valores;
- não é feito browser testing.

## Decisões para evitar overengineering

- sem tax collectors;
- sem salários;
- sem comércio externo;
- sem preços dinâmicos;
- sem gráficos;
- sem histórico financeiro persistido;
- sem sistema de eventos;
- sem browser testing.

## Entrega esperada do OMP

O OMP deve:

1. implementar a Fase 15 com TDD;
2. preservar cenário, advisor, câmara, construção e simulação existentes;
3. manter economia determinística e pequena;
4. correr `npm run build` e `npm test`;
5. não usar browser testing;
6. devolver resumo, ficheiros alterados e evidência de verificação.
