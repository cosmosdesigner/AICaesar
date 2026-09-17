# AICaesar — Plano de Desenvolvimento da Fase 33
# Release: Preparar uma crise

## Objectivo

Transformar eventos existentes numa decisão de preparação curta e compreensível, para que o jogador possa reduzir um impacto futuro em vez de apenas reagir ao relógio.

## Valor para o jogador

Uma seca, epidemia, incêndio ou pedido imperial deixa de parecer uma interrupção inevitável. O jogador recebe aviso útil, escolhe uma preparação com custo e percebe por que essa decisão alterou o resultado.

## Estado actual

- a cidade já gera eventos determinísticos e mostra riscos temporais;
- o painel **Agora** pode apresentar o próximo problema e risco relevante;
- existem dinheiro, capacidade, amenidades, alimentos e métricas de cenário que podem expressar preparação;
- os eventos ainda dependem sobretudo de o tempo passar, não de uma escolha antecipada do jogador.

## Escopo

1. Escolher um único evento existente para esta fase e adicionar uma preparação explícita:
   - requisito simples e observável, como reserva financeira, capacidade de comida ou cobertura relevante;
   - custo de oportunidade real antes do evento;
   - aplicação automática e explicável quando o evento acontece.
2. Mostrar a preparação no fluxo actual:
   - aviso com antecedência suficiente;
   - estado de preparado/não preparado no painel **Agora**;
   - mensagem de resolução que compara impacto normal e impacto mitigado.
3. Garantir duas respostas viáveis:
   - preparar-se antes do evento;
   - não preparar-se e recuperar depois com uma consequência clara.
4. Preservar a determinística do calendário, da simulação e dos saves.
5. Criar testes headless para aviso, elegibilidade, custo, efeito mitigado e persistência após save/load.

## Exclusões

- múltiplos novos eventos, árvore de tecnologia, sistema genérico de políticas ou missões aleatórias;
- combate, crime completo, unidades individuais ou pathfinding;
- novos assets, LLM real, backend ou browser/manual UI testing.

## Decisões

- A preparação não é um botão de anular o evento; apenas reduz um impacto mensurável.
- A condição usa estado que o jogador já pode observar e melhorar.
- A alternativa sem preparação deve permitir recuperação; a fase mede decisão, não punição inevitável.
- A mecânica aplica-se a um evento apenas até que dados de playtest justifiquem generalização.

## Critérios de aceitação

- O jogador recebe aviso antes do evento com tempo para preparar-se.
- A preparação tem custo explícito e reduz pelo menos um impacto observável do evento escolhido.
- Sem preparação, o jogador vê causa, consequência e uma rota de recuperação válida.
- Uma decisão anterior ao evento altera de forma determinística o resultado do mesmo evento.
- Save/load, reset e troca de cenário não duplicam nem perdem o estado de preparação.
- `npm test`, `npm run build` e `git diff --check` passam.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 33 para um evento existente.
2. Manter regras de preparação e resolução em módulos puros e testáveis.
3. Não adicionar dependências, não fazer commit nem push.
4. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
5. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
