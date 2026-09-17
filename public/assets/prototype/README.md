# Assets locais — consumo próprio

Estes nove PNGs foram copiados sem alterações dos recursos locais da **Caesaria** em `/root/caesaria-game-inspect/resources` e são os assets finais desta instalação pessoal do AICaesar. Não são assets próprios do AICaesar.

## Licenciamento

A licença e os direitos de redistribuição destes sprites **não foram verificados**. A licença do código da Caesaria não deve ser interpretada como licença dos gráficos; alguns recursos podem derivar de Caesar III. Este aviso não concede direitos de utilização ou redistribuição.

O projecto destina-se a consumo próprio. Estes assets não devem ser redistribuídos nem usados numa release pública ou comercial sem confirmar os direitos aplicáveis. O build do Vite copia esta pasta para `dist/assets/prototype`.

## Subset usado

Caminhos de origem relativos a `/root/caesaria-game-inspect/resources`:

| Ficheiro local | Origem | Utilização |
|---|---|---|
| `ground/land1a_00001.png` | `land1a/land1a_00001.png` | Relva, 120×60 |
| `way/ground_00002.png` | `ground/ground_00002.png` | Pavimento de pedra, 240×120, reduzido a um tile de 120×60 |
| `houses/housng1a_00007.png` | `houses/housng1a_00007.png` | Casa, 120×85 |
| `well/well_00001.png` | `well/well_00001.png` | Poço, 120×85 |
| `farm/vegfarm_00001.png` | `farm/vegfarm_00001.png` | Farm de vegetais, protótipo de produção de comida |
| `granary/warehouse_00001.png` | `warehouse/warehouse_00001.png` | Warehouse temporário para representar granary |
| `market/commerce_00001.png` | `commerce/commerce_00001.png` | Edifício de comércio usado temporariamente como market, 240×130 |
| `visual-activity/citizen1.png` | `public/assets/caesaria/gfx/pics.zip:citizen1.png` | Atlas local; runtime usa apenas os frames `citizen01_00001` e `citizen01_00002` (39×39) |
| `visual-activity/carts.png` | `public/assets/caesaria/gfx/pics_carts.zip:carts.png` | Atlas local; runtime usa apenas os frames `carts_00001` e `carts_00002` (39×39) |

O diretório original `way/` contém indicadores de percurso, não pavimento de estrada. Por isso, a estrada de demonstração usa o pavimento de `ground/`, guardado localmente em `way/`. A relva está originalmente em `land1a/`, não em `ground/`. Não foram copiados atlas nem pastas completas, exceto os dois spritesheets mínimos para os frames de actividade.

Total: 9 PNGs. Todos são carregados e renderizados. Os ficheiros permanecem inalterados; a escala é aplicada no renderer. Os dois atlases de actividade são a fonte dos frames usados e foram extraídos sem alteração dos arquivos locais Caesaria.
