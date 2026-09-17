# AICaesar — Plano de Desenvolvimento da Fase 29
# Release: Governor Command Center

## Objectivo

Transformar a interface de um painel técnico denso num centro de decisão jogável: o mapa passa a ser o foco, o jogador vê o objectivo actual e recebe uma orientação clara sobre o próximo problema sem perder acesso aos detalhes.

## Valor para o jogador

Depois desta fase, um jogador novo deve conseguir iniciar a cidade, perceber o que está a tentar alcançar, identificar o bloqueio principal e escolher uma acção razoável sem consultar o README nem interpretar dezenas de métricas.

## Estado actual

- o jogo tem muitos painéis horizontais com informação operacional sempre visível;
- objectivos, issues, métricas, advisor e controlos competem pela atenção;
- existe feedback de construção e preview de tile, mas não existe um resumo unificado de “agora”;
- o mapa está limitado pela altura reservada aos painéis;
- a UI mistura labels em português e inglês;
- a lógica de simulação, cenários, advisor e construção já existe e não deve ser alterada nesta fase.

## Escopo

### Inclui

1. Criar um painel persistente **Agora / Now** com informação derivada do estado actual:
   - objectivo principal e progresso;
   - problema mais importante, ou indicação de que não há problemas críticos;
   - próxima acção sugerida baseada no analyzer/advisor existente;
   - dinheiro/população em resumo;
   - risco temporal relevante, como próximo balanço, evento activo ou prazo imperial;
   - estado terminal de vitória/derrota.

2. Reorganizar a composição da página:
   - mapa com mais espaço vertical e prioridade visual;
   - painel “Agora” junto ao mapa;
   - grupos secundários (`Build`, `Simulation`, `Map navigation`, `Events`, `Advisor`, `Metrics`, `Save/Load`) recolhíveis com `<details>` ou mecanismo equivalente acessível;
   - não esconder por defeito a ferramenta de construção nem o objectivo;
   - manter a UI utilizável em viewport estreito/mobile.

3. Melhorar a hierarquia visual:
   - estilos distintos para objectivo, problema, risco, sucesso e falha;
   - acção recomendada visualmente identificável sem ser executada automaticamente;
   - cards/painéis consistentes, espaçamento e tipografia legíveis;
   - mapa não deve parecer mais um painel secundário.

4. Normalizar a primeira camada de texto para português europeu:
   - títulos e mensagens principais de cenário, construção, simulação, navegação, advisor, eventos e métricas;
   - manter nomes técnicos apenas quando ajudam a identificar uma ferramenta ou tipo de edifício;
   - não reescrever nesta fase todas as descrições detalhadas internas.

5. Feedback pós-acção orientado ao jogador:
   - reutilizar o status actual para mostrar custo/resultado e próximo efeito esperado quando já existirem dados suficientes;
   - não inventar benefícios nem simular efeitos futuros como se fossem imediatos;
   - preservar feedback de erro e preview de tile.

6. Testes headless:
   - derivação pura do resumo “Agora” para estado activo, sem issues, evento activo, prazo financeiro, vitória e derrota;
   - actualização do painel sem criar nós repetidos;
   - regressão de callbacks dos painéis recolhíveis e controlos existentes;
   - verificar que reorganização da UI não altera `CityState` nem regras de jogo.

## Exclusões

- novas mecânicas, edifícios, recursos, eventos ou regras de balanceamento;
- LLM real ou alterações ao contrato do advisor;
- redesign artístico completo, novos assets, som ou animações;
- selecção persistente de edifícios, mini-map ou rotação;
- browser/manual UI testing nesta fase.

## Decisões

- “Agora” é uma view derivada, não novo estado persistido.
- O analyzer e `evaluateScenario` continuam a ser as fontes de verdade; o painel não cria regras paralelas.
- O advisor pode ser apresentado como acção disponível, mas a recomendação base deve funcionar sem provider externo.
- Colapsar informação é aceitável; remover informação não é. Os detalhes continuam acessíveis.
- A acção sugerida é informativa e nunca executa construção automaticamente.

## Critérios de aceitação

- O mapa ocupa visualmente a maior área da página.
- Ao iniciar um cenário, o jogador vê imediatamente objectivo, progresso e próximo problema.
- O painel “Agora” actualiza após tick, construção, evento, aprovação do advisor, save/load, reset e fim do cenário.
- Os painéis secundários podem ser recolhidos e reabertos sem perder controlos.
- A primeira camada da UI é consistente em português europeu.
- A interface continua utilizável em desktop e viewport estreito.
- Construção, pan, pinch, overlays, simulação, advisor, eventos e save/load mantêm o comportamento actual.
- `npm test`, `npm run build` e `git diff --check` passam.
- Não é realizado browser/manual UI testing.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 29.
2. Separar a derivação do resumo “Agora” em lógica pura e testável.
3. Não adicionar dependências, não fazer commit nem push.
4. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
5. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
