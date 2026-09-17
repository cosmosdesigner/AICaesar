# AICaesar — Plano de Desenvolvimento da Fase 31
# Release: Construir com previsão

## Objectivo

Permitir ao jogador prever, antes de confirmar uma construção relevante, o benefício imediato e o risco principal daquela escolha.

## Valor para o jogador

Construir deixa de ser tentativa-e-erro. O jogador consegue comparar rapidamente colocar um edifício aqui, ali ou adiar a construção, sem abrir overlays técnicos nem interpretar valores internos.

## Estado actual

- a cidade calcula rede de estradas, alcance de serviços, trabalhadores, comida, desirability e tesouraria;
- o preview de tile já explica validade, custo e ocupação;
- o painel **Agora** mostra o objectivo e o problema actual;
- falta ligar uma escolha de construção às suas consequências legíveis antes da confirmação.

## Escopo

1. Criar uma análise pura de impacto para a construção actualmente seleccionada numa posição válida:
   - custo e tesouraria depois da compra;
   - casas que ganham ou perdem cobertura relevante;
   - capacidade de comida, água, emprego ou amenity que fica disponível;
   - risco mais importante que permanece sem solução.
2. Mostrar um resumo curto junto do preview de construção:
   - uma consequência positiva concreta;
   - um risco/custo concreto;
   - indicação honesta de quando não há impacto significativo ou quando a previsão não é aplicável.
3. Permitir comparar duas localizações sem alterar `CityState`:
   - mover o cursor recalcula a previsão;
   - o resumo desaparece para tiles inválidos ou ferramentas sem construção;
   - confirmação continua a usar a validação e execução existentes.
4. Cobrir os tipos de construção que já alteram a decisão do jogador:
   - road, house, well, farm, granary, market e amenities existentes;
   - sem inventar benefícios para tipos sem regra simulada.
5. Adicionar testes headless para análise, validade, ausência de mutação e comparação de localizações.

## Exclusões

- previsão de muitos ticks, simulação especulativa completa ou IA a jogar;
- novas regras económicas, novos edifícios, novos overlays ou mudanças de balanceamento;
- execução automática de uma construção;
- pathfinding, walkers reais ou browser/manual UI testing.

## Decisões

- A previsão é uma view derivada do estado actual; `CityState` e RNG não podem mudar durante a análise.
- Só são apresentados efeitos calculados pelas regras já existentes. Incerteza ou ausência de impacto deve ser explícita.
- O resumo privilegia uma decisão accionável, não uma lista de métricas.
- A confirmação da construção recalcula e valida tudo; o preview nunca é autorização.

## Critérios de aceitação

- Antes de construir, o jogador vê custo, pelo menos um benefício relevante quando existir e um risco que persiste.
- Duas localizações para o mesmo edifício podem produzir previsões diferentes e explicáveis.
- Um tile inválido não apresenta benefícios nem permite contornar a validação existente.
- Abrir, mover ou fechar o preview não altera dinheiro, edifícios, workers, ticks, eventos ou objectivos.
- O resumo actualiza depois de construção, demolição, tick, load, reset e troca de cenário.
- `npm test`, `npm run build` e `git diff --check` passam.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 31.
2. Manter a análise de impacto num módulo puro e testável.
3. Não adicionar dependências, não fazer commit nem push.
4. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
5. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
