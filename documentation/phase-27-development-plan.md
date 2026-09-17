# AICaesar — Plano de Desenvolvimento da Fase 27

## Objetivo

Completar a navegação mobile da Fase 26: permitir arrastar o cenário/mapa com dois dedos, mantendo pinch-to-zoom e sem permitir construção, demolição ou traços enquanto dois pointers touch estão ativos.

## Estado actual

- `TouchGestureRecognizer` devolve `midpoint` e `scale` para dois pointers;
- `Game.ts` aplica apenas `zoomAt(midpoint, scale)`;
- por isso, deslocar ambos os dedos sem alterar intencionalmente a distância não desloca a câmara;
- pinch, tap, traço Road/Bulldoze e pan de um dedo já estão implementados e cobertos por testes headless.

## Escopo

### Inclui

- acrescentar o delta incremental do midpoint ao update de gesto de dois dedos;
- aplicar a transformação de dois dedos como:
  1. pan da câmara pelo delta do midpoint;
  2. zoom pelo fator incremental em torno do novo midpoint;
- manter o fator de escala `1` como pan puro, sem alteração do zoom;
- manter pinch quando a distância entre dedos muda;
- manter dois dedos como barreira de construção: um segundo pointer cancela tap, traço Road e traço Bulldoze, e nenhum movimento posterior pode editar tiles;
- testes unitários do delta do midpoint e testes de integração que provem pan puro a dois dedos, pinch com pan, ausência de mutação de cidade e regressão dos controlos atuais;
- atualizar o `aria-label` do canvas para mencionar pan a dois dedos.

### Exclui

- inércia, limites de câmara, rotação, gestos com três ou mais dedos;
- alteração de construção por um dedo, simulação, cenários, save/load ou dependências;
- browser/manual UI testing.

## Critérios de aceitação

- arrastar ambos os dedos mantendo aproximadamente a sua distância desloca o cenário pelo deslocamento do midpoint;
- abrir/fechar os dedos mantém zoom incremental ancorado no midpoint e também acompanha deslocamento desse midpoint;
- um gesto com dois dedos não constrói, não demole e não continua traços já iniciados;
- tap, drag Road/Bulldoze, pan de um dedo, wheel e pan desktop continuam funcionais;
- `npm test`, `npm run build` e `git diff --check` passam;
- não é realizado browser/manual UI testing.

## Entrega esperada do OMP

1. Implementar exclusivamente esta fase.
2. Não adicionar dependências, não fazer commit nem push.
3. Correr `npm test`, `npm run build` e `git diff --check`.
4. Devolver resumo conciso e evidência de verificação.
