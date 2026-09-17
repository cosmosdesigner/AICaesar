# AICaesar — Plano de Desenvolvimento da Fase 34
# Release: Recuperação que fecha a sessão

## Objectivo

Dar ao jogador objectivos intermédios e um resumo final que expliquem se as decisões de planeamento e preparação levaram à vitória, derrota ou recuperação.

## Valor para o jogador

O fim de uma sessão deixa de ser apenas um conjunto de números. O jogador percebe o que correu bem, que problema bloqueou a cidade e qual decisão faria diferente numa próxima tentativa.

## Estado actual

- cenários já terminam em vitória ou derrota e recolhem métricas de sessão;
- eventos e objectivos têm consequências observáveis;
- a Fase 33 introduz uma decisão de preparação com impacto mensurável;
- falta transformar estes sinais numa progressão curta durante a sessão e numa explicação clara no fim.

## Escopo

1. Definir, para um cenário existente, dois objectivos intermédios derivados das condições actuais:
   - primeiro marco alcançável nos minutos iniciais;
   - segundo marco ligado a estabilidade, preparação ou recuperação;
   - progresso e conclusão apresentados no painel **Agora**.
2. Criar um after-action compacto no final do cenário:
   - condição final e objectivo atingido ou falhado;
   - duas ou três decisões/estados que contribuíram materialmente para o resultado;
   - impacto da preparação da Fase 33, quando aplicável;
   - uma próxima tentativa recomendada, baseada em factos e não em texto inventado.
3. Reutilizar as métricas de sessão existentes; adicionar apenas o histórico mínimo necessário para explicar transições relevantes.
4. Garantir que reset, load e troca de cenário reinicializam correctamente o progresso e o resumo.
5. Adicionar testes headless para os marcos, ordem dos factos no resumo, vitória, derrota e recuperação após crise.

## Exclusões

- sistema genérico de achievements, XP, árvore tecnológica, contas, partilha cloud ou ranking;
- narrativa longa, cinemáticas, novos assets ou novos cenários;
- telemetria remota, LLM real ou browser/manual UI testing.

## Decisões

- Os objectivos intermédios são específicos do cenário; não se cria um motor de quests genérico.
- O after-action explica estados observados e decisões registadas, nunca atribui causalidade que a simulação não mede.
- O resumo deve ser legível num único painel e não esconder os detalhes existentes das métricas.
- A fase privilegia repetição informada: perder deve mostrar uma alteração concreta que o jogador pode experimentar.

## Critérios de aceitação

- O jogador vê o próximo marco e o seu progresso durante a sessão sem abrir documentação.
- Vitória, derrota e recuperação apresentam uma explicação curta baseada no estado real da sessão.
- Quando a preparação afectou o evento escolhido, o resumo mostra esse efeito de forma observável.
- Reset, load e troca de cenário não transportam marcos nem factos de uma sessão anterior.
- O resumo não altera `CityState`, economia, eventos ou condições de cenário.
- `npm test`, `npm run build` e `git diff --check` passam.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 34 num cenário existente.
2. Guardar apenas factos mínimos, determinísticos e necessários para explicar a sessão.
3. Não adicionar dependências, não fazer commit nem push.
4. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
5. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
