# AICaesar

Base visual da **Fase 1**: mapa isométrico 30×30, em TypeScript + Vite + PixiJS, sem React.

## Executar localmente

Requer Node.js 20.19+ na linha 20, ou Node.js 22.12+ (recomendado: uma versão LTS compatível), e npm.

```sh
npm install
npm run dev
```

Abrir o endereço local apresentado pelo Vite (normalmente `http://localhost:5173`). O browser precisa de WebGL. Todos os sprites são locais; não há chamadas a serviços externos na aplicação. A instalação de dependências requer acesso ao registry npm.

```sh
npm run build
npm run preview
```

`build` verifica TypeScript em modo estrito e gera `dist/`; `preview` serve esse build localmente. `node_modules/` e `dist/` estão ignorados pelo Git. **O build é apenas para validação local: inclui os assets temporários e não deve ser publicado.**

## O que aparece

- 900 tiles de relva numa grelha lógica 30×30.
- Uma estrada de 16 tiles, seis casas e um poço, seedados de forma determinística.
- Sprites reais da Caesaria, alinhados pela base do tile e ordenados de trás para a frente.
- Enquadramento automático de todo o mapa ao abrir ou redimensionar a janela.

A cena é estática: sem colocação de edifícios, pan/zoom, dinheiro, simulação de água/comida/workers, pathfinding ou advisor/IA. Só há renderização na inicialização e no redimensionamento, sem loop de simulação.

## Estrutura

```text
src/
  assets/AssetManifest.ts    URLs locais e carregamento das quatro texturas
  game/Game.ts              Inicialização, resize e libertação do renderer
  rendering/PixiApp.ts       Canvas PixiJS
  rendering/MapRenderer.ts   Camadas, alinhamento, profundidade e enquadramento
  rendering/GridMath.ts      Conversão isométrica nos dois sentidos
  simulation/CityState.ts    Estado e seed 30×30, sem dependência de PixiJS
  simulation/Tile.ts         Coordenadas, terreno e tipo de edifício
  input/                    Reservado para a Fase 2; sem implementação
  ui/                       Reservado para fases seguintes; sem implementação
  main.ts                   Arranque e mensagem de erro de carregamento
  style.css                 Layout da página
public/assets/prototype/    Apenas quatro PNGs e aviso de licenciamento
```

`gridToScreen` devolve o centro do losango em coordenadas locais do mapa, usando tiles de 120×60. `screenToGrid` recebe essas mesmas coordenadas locais, devolve o tile mais próximo e retorna `null` para valores não finitos. Não aplica limites do mapa: um futuro consumidor deve primeiro desfazer a transformação do container e depois verificar os limites do `CityState`. Não existe input de construção nesta fase.

## Assets e documentação

**Sprites temporários, apenas para prototipagem local. Direitos de redistribuição não verificados. Substituir antes de qualquer release pública.** Proveniência e seleção exata: [aviso dos assets](public/assets/prototype/README.md).

A relva vem de `land1a/`; a estrada usa pavimento de `ground/`, pois `way/` na fonte contém indicadores de percurso. Só os quatro PNGs usados foram copiados, sem modificar os originais.

- [Plano da Fase 1](documentation/phase-1-development-plan.md)
- [MVP](documentation/mvp.md)
- [Fases de implementação](documentation/implementation-phases.md)
- [Notas de referência Caesaria](documentation/caesaria-reference.md)

Próximo escopo planeado: Fase 2, construção manual. Não está implementado aqui.
