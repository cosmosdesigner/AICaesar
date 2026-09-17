# AICaesar — Roadmap de próximas releases

## Princípio

AICaesar já tem uma base técnica extensa: construção, simulação, economia, eventos, cenários, advisor, save/load e navegação touch.

As próximas releases não devem ser avaliadas pelo número de sistemas adicionados. Devem ser avaliadas por uma pergunta:

> O jogador consegue tomar decisões melhores, percebe o resultado e tem vontade de continuar a jogar?

Cada release deve produzir uma melhoria observável numa sessão real e deve poder ser validada sem depender de um LLM real ou de novos assets.

## Estado de partida

A versão actual permite:

- iniciar três cenários com duas dificuldades;
- construir uma cidade com roads, habitação, água, comida, emprego, amenities e economia;
- observar overlays e issues determinísticas;
- reagir a seca, epidemia, incêndio e pedidos imperiais;
- pedir planos ao advisor mock e aprovar acções validadas;
- guardar/carregar a cidade localmente;
- jogar em desktop e touch.

O principal risco já não é falta de infraestrutura. É a experiência continuar a parecer um sandbox técnico: o jogador pode fazer coisas, mas nem sempre sabe qual é a melhor decisão, porque deve fazê-la agora ou se a cidade está realmente a progredir.

## Release 1 — Primeira cidade compreensível

Fases sugeridas: 29–30

### Resultado para o jogador

Uma pessoa nova consegue iniciar um cenário, perceber o que fazer nos primeiros minutos, executar um plano simples e entender imediatamente por que a cidade melhorou ou piorou.

### Problema que resolve

A informação existe em vários painéis, mas está dispersa. O jogo ainda exige consultar documentação ou interpretar muitos números antes de tomar uma decisão.

### Inclui

- onboarding curto dentro do jogo, específico do cenário seleccionado;
- objectivo actual destacado, com indicação clara de próxima acção recomendada;
- resumo visual de “o que mudou desde o último tick/período”;
- explicação orientada à decisão para casas e workplaces afectados;
- feedback consistente para construção, demolição, pausa, eventos e resultado de cenário;
- checklist de primeiros 5–10 minutos para o cenário inicial;
- playtest determinístico com uma rota de sucesso e uma rota de erro compreensível.

### Não inclui

- novos edifícios;
- novo modelo económico;
- LLM real;
- reescrita dos painéis existentes;
- tutoriais longos ou popups bloqueantes.

### Critérios de aceitação

- um jogador novo identifica o objectivo principal sem abrir o README;
- depois de uma acção, consegue responder “o que mudou?” e “qual é o próximo problema?”;
- o cenário inicial tem uma rota de sucesso reproduzível em 10–15 minutos;
- os avisos explicam causa e consequência, não apenas estado numérico;
- a rota principal não exige procurar informação em mais de dois painéis.

### Métricas de valor

- tempo até à primeira construção válida;
- percentagem de sessões que chegam ao primeiro objectivo intermédio;
- número de acções inválidas por sessão;
- percentagem de playtests em que o jogador identifica correctamente o próximo problema.

## Release 2 — Decisões de planeamento com consequências

Fases sugeridas: 31–32

### Resultado para o jogador

O jogador sente que o desenho da cidade importa: escolher onde colocar habitação, produção e amenities cria trade-offs visíveis e muda a estratégia, em vez de bastar construir tudo perto da rede.

### Problema que resolve

A simulação já calcula desirability, alcance viário, trabalhadores e comida, mas estes sistemas ainda não formam um conjunto suficientemente legível de decisões de planeamento.

### Inclui

- zonas/bairros lógicos simples ou agrupamento de casas por área, sem editor complexo;
- metas de layout ou prosperidade que recompensem planeamento, não apenas contagem de edifícios;
- procura habitacional derivada de população, capacidade e qualidade dos serviços;
- custos de oportunidade explícitos: expansão, amenities, capacidade produtiva e reserva financeira;
- preview de impacto para uma construção relevante, usando apenas regras determinísticas;
- advisor a comparar duas alternativas de layout com custo, risco e benefício esperado;
- pelo menos um cenário desenhado para exigir separação entre indústria/comida e habitação.

### Não inclui

- walkers reais;
- trânsito, congestionamento ou pathfinding de unidades;
- dezenas de tipos de goods;
- mapa procedural;
- multiplayer.

### Critérios de aceitação

- dois layouts com os mesmos edifícios produzem resultados diferentes e explicáveis;
- o jogador consegue ver antes de construir pelo menos um benefício e um risco relevantes;
- existe pelo menos uma decisão em que a opção mais barata não é a melhor a médio prazo;
- o cenário de planeamento não pode ser resolvido por spam de um único edifício;
- todas as novas regras são determinísticas e testadas sem browser.

### Métricas de valor

- número de decisões de localização que alteram um resultado do cenário;
- frequência com que o jogador usa o preview antes de construir;
- diferença de resultados entre layouts equivalentes;
- percentagem de jogadores que conseguem explicar o trade-off principal do cenário.

## Release 3 — Pressão, recuperação e progressão

Fases sugeridas: 33–34

### Resultado para o jogador

Eventos deixam de ser apenas interrupções previsíveis. O jogador prepara-se, escolhe como responder e sente progressão durante a sessão.

### Problema que resolve

A versão actual tem eventos, mas a pressão é moderada e o resultado depende sobretudo do relógio. Falta preparação, recuperação e uma sensação clara de desbloquear capacidade.

### Inclui

- preparação simples para eventos: reserva mínima, capacidade de resposta ou prioridades;
- escolhas de resposta com custos e trade-offs, em vez de apenas aceitar/esperar;
- recuperação mensurável após seca, epidemia, incêndio ou pedido imperial;
- objectivos intermédios e recompensas de cenário que mudam a próxima decisão;
- progressão curta dentro da sessão, com desbloqueios limitados e explicáveis;
- cenários que testem estratégias diferentes: crescimento, prosperidade e resiliência;
- after-action de cenário com decisões-chave, não apenas métricas brutas.

### Não inclui

- combate;
- crime/safety completo;
- árvores tecnológicas extensas;
- economia global ou comércio externo;
- aleatoriedade não reproduzível.

### Critérios de aceitação

- o jogador recebe warning suficiente para tomar uma decisão informada;
- pelo menos duas respostas a um evento são viáveis, com custos diferentes;
- recuperar de uma crise é possível e observável;
- uma decisão tomada antes do evento altera o impacto do evento;
- o final do cenário explica as escolhas que contribuíram para vitória ou derrota.

### Métricas de valor

- percentagem de jogadores que se preparam antes de um evento;
- taxa de recuperação após cada evento;
- número de estratégias vencedoras por cenário;
- diferença de satisfação/clareza entre uma sessão sem e com preparação.

## Release 4 — Advisor em que o jogador pode confiar

Fases sugeridas: 35–36

### Resultado para o jogador

O advisor deixa de ser apenas um gerador de planos: ajuda o jogador a decidir, mostra as consequências, aceita rejeição e aprende com o resultado da própria sessão.

### Problema que resolve

A infraestrutura de advisor já é segura, mas o valor depende da qualidade da recomendação e da confiança do jogador. Integrar um LLM real antes de resolver confiança, avaliação e controlo aumentaria custo sem garantir utilidade.

### Inclui

- advisor orientado ao objectivo actual e ao horizonte temporal do cenário;
- alternativas “segura”, “equilibrada” e “ambiciosa”, quando existirem;
- explicação do que o plano não resolve;
- previsão determinística de pré-condições e riscos antes da aprovação;
- acompanhamento do resultado após alguns ticks, distinguindo impacto imediato de impacto esperado;
- histórico curto de recomendações aceites/rejeitadas e resultado observado;
- avaliação offline/replay com estados fixos antes de activar provider LLM;
- provider LLM opcional apenas depois de o contrato determinístico estar validado.

### Não inclui

- autonomia para construir sem aprovação;
- execução parcial silenciosa;
- acesso do LLM ao estado bruto completo;
- memória cloud ou dados de utilizador;
- substituir o analyzer determinístico por texto probabilístico.

### Critérios de aceitação

- o jogador consegue perceber por que a recomendação foi feita;
- consegue comparar pelo menos duas estratégias quando há trade-off real;
- o advisor não recomenda acções impossíveis ou incompatíveis com o orçamento;
- o resultado posterior é comparado com a promessa original;
- o mock continua a ser suficiente para jogar localmente sem credenciais;
- qualquer provider LLM falhado faz fallback seguro e observável.

### Métricas de valor

- percentagem de planos aprovados pelo jogador;
- percentagem de planos que melhoram o objectivo sem criar um problema maior;
- taxa de rejeição por recomendação incompreensível;
- diferença entre impacto prometido e impacto observado;
- cobertura de estados fixos no replay/evaluation.

## Release 5 — Conteúdo e apresentação para retenção

Fases sugeridas: 37–38, apenas depois das releases anteriores

### Resultado para o jogador

O jogo tem conteúdo suficiente para repetir sessões, uma identidade visual própria e motivos claros para escolher cenários diferentes.

### Inclui

- mais cenários apenas se introduzirem decisões novas;
- dificuldade calibrada com dados de playtest, não apenas mais custos;
- arte própria ou assets com licença clara;
- resumo de sessão partilhável/exportável localmente, se demonstrar valor;
- melhorias de performance e legibilidade para cidades maiores;
- checklist de regressão e playtest repetível por release.

### Não inclui por defeito

- backend;
- contas;
- cloud saves;
- monetização;
- multiplayer;
- grande pipeline de assets antes de validar retenção.

### Critérios de aceitação

- cada cenário acrescentado tem uma estratégia dominante diferente;
- uma sessão de 20–30 minutos tem progressão clara;
- o jogador consegue explicar por que quer jogar novamente;
- os assets temporários não são usados numa release pública.

## Ordem recomendada

1. Release 1: tornar o jogo compreensível.
2. Release 2: tornar o planeamento significativo.
3. Release 3: tornar a pressão divertida e recuperável.
4. Release 4: tornar o advisor confiável.
5. Release 5: investir em conteúdo e apresentação após validação do loop.

Não recomendo como próximas releases:

- LLM real como próximo passo;
- walkers/pathfinding;
- mais dez tipos de edifícios;
- backend/cloud saves;
- rotação de câmara;
- reescrita arquitectural.

Esses itens podem ser tecnicamente interessantes, mas não resolvem o principal risco actual: o jogador ainda pode não ter uma razão suficientemente clara para continuar a jogar.

## Próximo passo de execução

A próxima fase concreta deve ser a Fase 29, dedicada ao primeiro minuto e ao objectivo actual do cenário:

- definir uma rota inicial observável;
- reduzir a dispersão de informação;
- acrescentar feedback de “mudança e próximo problema”;
- validar com testes headless e uma checklist de playtest curta.

Só depois de essa rota ser compreensível devemos escolher o conteúdo exacto da Fase 30.
