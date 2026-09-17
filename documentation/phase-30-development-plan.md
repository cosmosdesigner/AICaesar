# AICaesar — Plano de Desenvolvimento da Fase 30
# Release: Vida visual — cidadãos e carroças

## Objectivo

Fazer a cidade parecer viva usando as novas sprites locais da Caesaria: cidadãos e carroças percorrem visualmente a rede principal de estradas enquanto a simulação continua determinística e baseada em BFS.

## Valor para o jogador

Depois desta fase, o jogador deve perceber imediatamente que as estradas ligam bairros e que a cidade está activa. O movimento serve como feedback visual de actividade; não é necessário observar painéis para sentir que a construção teve efeito.

## Estado actual

- o mapa renderiza sprites estáticos de terreno e edifícios;
- a simulação já deriva rede principal, conectividade e distância por estrada;
- não existem entidades visuais móveis;
- os assets Caesaria estão em `public/assets/caesaria/gfx/*.zip`, com spritesheets/atlases locais;
- browser/manual UI testing continua fora do escopo por preferência do projecto.

## Escopo

### Inclui

1. Extrair/canonizar apenas os ficheiros visuais necessários para runtime local:
   - um conjunto pequeno de frames de cidadão;
   - um conjunto pequeno de frames de carroça;
   - metadados ou loader determinístico para esses frames.
2. Criar um sistema visual isolado, sem alterar `CityState`:
   - entidades efémeras com posição contínua;
   - ciclo de vida e movimento determinísticos;
   - animação de frames com `AnimatedSprite` ou equivalente PixiJS;
   - criação/remoção sem acumular objectos a cada refresh.
3. Gerar percursos simples sobre a rede principal existente:
   - cidadãos/carretas usam segmentos de estrada existentes;
   - sem pathfinding de unidades, colisões, tráfego ou commute real;
   - se não existir uma rede utilizável, não criar entidades móveis.
4. Integrar o renderer/game loop:
   - actualizar movimento com delta time;
   - preservar pan, zoom, overlays, construção, save/load, reset e pausa;
   - pausa congela movimento e animação;
   - refresh da cidade reconcilia as entidades sem mutar a simulação.
5. Tornar a actividade legível:
   - densidade limitada para não poluir o mapa;
   - variação determinística de posição, tipo e velocidade;
   - cidadãos/carroças ficam abaixo dos edifícios na ordem visual apropriada;
   - movimento deve desaparecer/reaparecer coerentemente quando a rede muda.
6. Testes headless:
   - parsing/manifest de assets;
   - geração determinística de entidades para a mesma cidade;
   - ausência de entidades sem rede principal;
   - progresso de movimento e animação com delta;
   - pausa/reset/refresh sem duplicação;
   - garantia de que `CityState`, dinheiro, workers e ticks não mudam por causa do sistema visual.

## Exclusões

- walkers reais ou agentes com destino económico;
- pathfinding completo, tráfego, congestionamento, colisões ou workers individuais;
- novas regras de produção/distribuição;
- LLM, novos edifícios, novos cenários ou alterações de balanceamento;
- novos assets externos, dependências ou browser/manual UI testing;
- substituir a rede BFS existente como fonte de verdade.

## Decisões

- A simulação continua a ser a fonte de verdade; movimento é apenas apresentação.
- O sistema deve aceitar um relógio/delta injectável para testes determinísticos.
- A densidade inicial deve ser pequena e configurável, privilegiando legibilidade sobre realismo.
- Assets temporários continuam limitados ao protótipo local e devem manter a documentação de proveniência.
- A integração deve ser reversível: se os assets falharem, a cidade continua jogável sem entidades móveis.

## Critérios de aceitação

- Com a cidade seedada e uma rede principal, vêem-se cidadãos e pelo menos uma carroça a mover-se em estrada.
- A mesma cidade produz as mesmas entidades, percursos e velocidades iniciais.
- Construção/destruição de roads actualiza a actividade visual sem alterar regras de simulação.
- Pausa congela entidades; reset limpa e recria a actividade sem duplicação.
- A câmara e overlays continuam alinhados; os sprites não ficam presos à posição antiga após pan/zoom.
- A cidade sem rede não cria entidades móveis e não gera erros de runtime.
- `npm test`, `npm run build` e `git diff --check` passam.
- Não é realizado browser/manual UI testing.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 30.
2. Não adicionar dependências, não fazer commit nem push.
3. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
4. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
