# Checklist de playtest — Fase 25

Sem browser automatizado nesta fase. Cada rota começa numa sessão nova: escolher o cenário e dificuldade no painel **Scenario setup**, clicar **Start selected scenario**, confirmar o painel **Scenario**, o contexto do Advisor e **Session metrics**, e usar **Reset** no fim. O seed, o dinheiro, as metas e o limite da tabela são determinísticos.

## Procedimento comum

1. Selecionar a rota da tabela e iniciar. O tick é `0`, o estado é **Active**, os contadores `Built`, `Demolished`, `Advisor` e `Requests` são zero; edifícios seedados não contam como construções.
2. Confirmar o dinheiro, número de roads/casas e metas. Construir uma road num tile vazio: `Built` passa a 1 e o dinheiro diminui 4. Clicar de novo no mesmo tile: a ação é rejeitada e `Built` permanece 1.
3. Clicar **Reset**. O mesmo cenário+dificuldade volta a tick `0`, seed e dinheiro da tabela; todas as métricas de interação voltam a zero. O cenário ativo, o painel e o contexto do Advisor continuam a indicar o perfil selecionado.
4. Para validar a passagem terminal, deixar a simulação correr além do limite indicado sem completar todas as metas, ou reduzir a tesouraria abaixo do limiar da tabela. O estado passa a **Defeat**; ticks, construção, demolição e aprovação do Advisor ficam bloqueados até **Reset**.
5. Uma seleção diferente inicia uma nova cidade e limpa o plano/report do Advisor. Save/Load continua a guardar somente `CityState` v1: não deve substituir o cenário, dificuldade nem métricas de sessão selecionados.

## Rotas de seleção e seed

| Rota | Cenário / dificuldade | Seed esperado no tick 0 | Dinheiro | Metas (população, água, comida, falta workers, dinheiro) | Limite / derrota |
|---|---|---|---:|---|---|
| 1 | Founding Settlement / Easy | 20 roads, 8 casas cheias, 1 well, farm, granary, market | 700 | 60, 53%, 38%, ≤40%, 75 | 1125 / `< 0` |
| 2 | Founding Settlement / Normal | 20 roads, 8 casas cheias, 1 well, farm, granary, market | 500 | 80, 70%, 50%, ≤20%, 100 | 900 / `< 50` |
| 3 | Merchant Quarter / Easy | 33 roads, 6 casas cheias, 1 well, farm, granary, market | 550 | 68, 60%, 53%, ≤45%, 94 | 900 / `< 0` |
| 4 | Merchant Quarter / Normal | 33 roads, 6 casas cheias, 1 well, farm, granary, market | 350 | 90, 80%, 70%, ≤25%, 125 | 720 / `< 25` |
| 5 | Mercado na encruzilhada / Easy | 21 roads, 8 casas cheias, 2 wells, farm, granary, sem market | 400 | 24, 75%, 75%, ≤45%, 75 | 750 / `< 0` |
| 6 | Mercado na encruzilhada / Normal | 21 roads, 8 casas cheias, 2 wells, farm, granary, sem market | 200 | 32, 100%, 100%, ≤25%, 100 | 600 / `< 50` |
| 7 | Resilient Province / Easy | 40 roads, 10 casas cheias, 2 wells, farm, granary, market | 625 | 60, 53%, 38%, ≤50%, 113 | 225 / `< 0` |
| 8 | Resilient Province / Normal | 40 roads, 10 casas cheias, 2 wells, farm, granary, market | 425 | 80, 70%, 50%, ≤30%, 150 | 180 / `< 25` |

## Rota específica: Founding Settlement

Nas rotas 1 e 2, confirmar que a cidade começa com 32 residentes e que a cadeia road → farm → granary → market é a mesma baseline da Fase 24. Pausar antes de alterar o mapa; expandir casas e serviços ligados à rede principal para avançar população, água e comida. Em Normal, os targets e limite permanecem 80, 70%, 50%, ≤20%, 100 e 900. Em Easy, só os valores da tabela tornam a rota mais permissiva; nenhuma regra de simulação muda.

## Rota específica: Merchant Quarter

Nas rotas 3 e 4, começar da tesouraria menor e das seis casas. Confirmar que as duas linhas de roads seedadas estão presentes e que os objetivos mais altos de água, comida, população e dinheiro aparecem no painel. Usar novas roads apenas para ligar expansão à rede principal; uma road isolada não dá cobertura. Ao reiniciar a rota, o seed de 33 roads e a tesouraria da tabela voltam exatamente, sem reter construções, demolições ou plano do Advisor.

## Rota específica: Mercado na encruzilhada

Nas rotas 5 e 6, confirmar o seed de 21 roads, oito casas, dois wells, uma farm e uma granary, sem market. Em Normal, colocar um **Market** em `(12, 14)` e avançar um tick: a comida chega a 100%, o tesouro fica em 150 e o cenário vence. Reiniciar; colocar o mesmo market em `(17, 14)` e avançar um tick: só 50% das casas recebe comida. Construir depois o market em `(12, 14)` custa mais 50; após dois ticks, a comida chega a 100%, o tesouro fica em 100 e a falta de workers continua dentro da meta de 25%. As duas rotas usam os mesmos edifícios de market, mas a segunda exige custo, tempo e recuperação adicionais.

## Rota específica: Resilient Province

Nas rotas 7 e 8, confirmar as três linhas de roads, dez casas e dois wells. Deixar a simulação avançar para observar o calendário já existente: warning de drought no tick 24, drought nos ticks 30–44, warning de epidemic no tick 54, epidemic nos ticks 60–71, pedido imperial no tick 78 e fire nos ticks 90–97. Cumprir o pedido só quando houver 10 food disponível; **Requests fulfilled** sobe uma vez após sucesso. Se o pedido expirar, **Requests failed** sobe uma vez. Reset antes ou depois desses eventos restaura o calendário determinístico e zera ambos os contadores.
