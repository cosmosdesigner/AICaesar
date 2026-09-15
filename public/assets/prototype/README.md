# Assets temporários — apenas prototipagem local

Estes sete PNGs foram copiados sem alterações dos recursos locais da **Caesaria** em `/root/caesaria-game-inspect/resources`. São usados apenas para validar a renderização das fases de protótipo; não são assets próprios do AICaesar.

## Licenciamento

A licença e os direitos de redistribuição destes sprites **não foram verificados**. A licença do código da Caesaria não deve ser interpretada como licença dos gráficos; alguns recursos podem derivar de Caesar III. Este aviso não concede direitos de utilização ou redistribuição.

**Não publicar nem distribuir estes assets (incluindo a pasta `dist/`). Substituir todos por arte própria ou com licença explícita compatível antes de qualquer release pública ou comercial.** O build do Vite copia esta pasta para `dist/assets/prototype`.

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
| `market/marketkid_00001.png` | `marketkid/marketkid_00001.png` | Sprite temporário para market; não havia pasta `market/` adequada |

O diretório original `way/` contém indicadores de percurso, não pavimento de estrada. Por isso, a estrada de demonstração usa o pavimento de `ground/`, guardado localmente em `way/`. A relva está originalmente em `land1a/`, não em `ground/`. Não foram copiados atlas nem pastas completas.

Total: 7 PNGs, 150 075 bytes. Todos são carregados e renderizados. Os ficheiros permanecem inalterados; a escala é aplicada no renderer.
