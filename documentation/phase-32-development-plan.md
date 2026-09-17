# AICaesar — Plano de Desenvolvimento da Fase 32
# Release: Um cenário que exige planeamento

## Objectivo

Criar um único cenário de planeamento em que a disposição da cidade, e não apenas a quantidade de edifícios, determina uma vitória estável.

## Valor para o jogador

O jogador passa a sentir uma consequência clara do desenho da cidade: uma solução barata ou compacta pode resolver o problema imediato, mas uma solução bem localizada sustenta o objectivo do cenário.

## Estado actual

- a simulação já deriva cobertura, rede viária, comida, emprego, amenidades, desirability e economia;
- os cenários já têm objectivos, dificuldades e estados de vitória/derrota;
- a Fase 31 torna previsível o impacto de uma construção;
- ainda não existe uma missão curta que transforme estes sistemas num trade-off de layout legível.

## Escopo

1. Adicionar um cenário determinístico de 10–15 minutos centrado numa decisão de localização:
   - habitação tem de permanecer servida;
   - produção/comida tem de obter ligação útil;
   - expansão sem reserva financeira ou amenities suficientes cria uma consequência visível.
2. Definir duas estratégias viáveis com custos diferentes:
   - rota rápida/barata que resolve uma necessidade imediata e cria risco posterior;
   - rota preparada que custa mais no início e atinge o objectivo de forma estável.
3. Acrescentar apenas as regras/limiares mínimos para distinguir os layouts:
   - reutilizar alcance, ligação por estrada, capacidade e desirability existentes;
   - expor o objectivo intermédio e a causa de falha no painel **Agora** e no feedback de cenário.
4. Escrever uma rota determinística de sucesso e uma rota de erro compreensível no playtest checklist.
5. Adicionar testes headless que provem resultados distintos para layouts equivalentes em contagem de edifícios.

## Exclusões

- sistema genérico de distritos, zoning, trânsito, walkers económicos ou pathfinding;
- mapa procedural, novos tipos de goods, comércio externo ou dezenas de edifícios;
- rebalanceamento global de todos os cenários;
- LLM real, backend, contas ou browser/manual UI testing.

## Decisões

- O cenário é a unidade de valor; não se cria uma abstracção genérica de bairros sem uma segunda utilização comprovada.
- Os dois caminhos devem ser viáveis e explicáveis; a fase não introduz uma armadilha arbitrária.
- A solução mais barata não pode ser automaticamente a melhor a médio prazo.
- Todas as condições de vitória, derrota e feedback permanecem determinísticas.

## Critérios de aceitação

- Dois layouts com os mesmos edifícios produzem resultados diferentes e explicáveis no cenário novo.
- O jogador consegue identificar antes de construir pelo menos um benefício e um risco através do preview.
- Existe uma decisão em que a opção mais barata falha ou exige recuperação, enquanto a opção preparada permite progresso estável.
- O cenário não pode ser vencido repetindo um único edifício sem considerar localização.
- Uma rota de sucesso e uma rota de erro podem ser reproduzidas sem browser nem aleatoriedade.
- `npm test`, `npm run build` e `git diff --check` passam.

## Entrega esperada do OMP

1. Implementar exclusivamente a Fase 32.
2. Alterar só regras e configuração necessárias ao cenário de planeamento.
3. Não adicionar dependências, não fazer commit nem push.
4. Correr `TMPDIR=/root npm test`, `npm run build` e `git diff --check`.
5. Devolver resumo conciso, ficheiros alterados e evidência de verificação.
