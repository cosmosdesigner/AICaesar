# AICaesar — Notas de referência CaesarIA / Caesar III

## Objetivo

Este documento regista aprendizagens úteis a partir da página CaesarIA no ModDB, para orientar a mecânica do AICaesar.

A referência deve ser usada como inspiração técnica e de design, não como obrigação de recriar Caesar III inteiro.

## Fonte analisada

A página CaesarIA descreve o projeto como um remake de Caesar III focado em construção de cidade romana, com aldeias/cidades, jardins, oficinas, tarefas do imperador, ataques e campanha original.[1]

A página também lista várias mecânicas implementadas ou previstas, incluindo construção/destruição de edifícios, desirability, migração, armazéns/celeiros, danos/incêndios, entretenimento, rede de comércio imperial, agricultura, extração, camadas de informação, prefects, engineers, advisers, emprego, evolução de casas, saúde, abastecimento de água e guerra.[1]

## Mecânicas relevantes para AICaesar

### 1. Cidade baseada em serviços

Casas evoluem dependendo das condições à volta, incluindo acesso a água, saúde, emprego e outros serviços.[1]

Para o MVP de AICaesar, isto confirma a direção definida:

- casas começam simples;
- casas precisam de estrada;
- casas evoluem com água;
- casas evoluem mais com comida;
- serviços ausentes bloqueiam evolução.

Não precisamos de todos os serviços no MVP. Água e comida chegam para validar o loop.

### 2. Produção e armazenamento

CaesarIA inclui agricultura, extração, produção de bens, warehouses e granaries para armazenamento.[1]

Para AICaesar, isto reforça uma cadeia mínima:

```text
Farm → Food → Granary → Market → Houses
```

Esta cadeia é suficiente para o primeiro advisor detetar problemas reais:

- há produção mas não há armazenamento;
- há armazenamento mas não há distribuição;
- há casas sem comida;
- há falta de workers em edifícios produtivos.

### 3. Informação por camadas

A página refere information layers para estados da cidade.[1]

Isto é muito importante para o nosso produto porque o agente de IA deve trabalhar sobre os mesmos conceitos que o jogador vê.

Overlays mínimos:

- água;
- comida;
- acesso por estrada;
- emprego;
- problemas destacados pelo advisor.

### 4. Walkers e serviços urbanos

CaesarIA inclui prefects, engineers, trainee, soldiers e outros agentes urbanos.[1]

Para o MVP, vamos evitar walkers complexos. Mas devemos modelar o sistema de forma a permitir walkers depois.

Decisão MVP:

- distribuição por raio ou distância simples;
- sem walkers animados na primeira versão;
- criar interfaces que permitam substituir distribuição abstrata por walkers reais mais tarde.

### 5. Desirability

A página indica que construções influenciam desirability à volta.[1]

Para o MVP, desirability deve ficar fora ou ser apenas placeholder.

Possível versão futura:

- jardins aumentam desirability;
- indústria reduz desirability;
- desirability influencia evolução de casas.

Mas isto não deve entrar antes do loop água/comida/advisor estar validado.

### 6. Danos, incêndios e manutenção

CaesarIA menciona danos e incêndios em edifícios.[1]

Isto é bom para fases futuras, especialmente para dar trabalho ao advisor:

- detectar risco de incêndio;
- recomendar prefecture/engineering post;
- priorizar manutenção.

Não entra no MVP inicial.

### 7. Emprego

A página refere simulation de empregos.[1]

Isto deve entrar no MVP depois de água e comida, porque cria bons trade-offs:

- mais edifícios produtivos exigem trabalhadores;
- casas geram população;
- excesso de edifícios sem população suficiente cria gargalo.

Este é um problema ideal para o advisor explicar.

## Implicações para o plano de implementação

O plano atual continua correto, mas há três reforços:

1. Os overlays não são polish; são parte central da experiência.
2. O analyzer deve ser implementado antes do LLM.
3. Walkers devem ser adiados, mas a arquitetura deve permitir adicioná-los.

## Ajuste recomendado ao MVP

Manter MVP focado em:

- roads;
- houses;
- wells;
- farms;
- granaries;
- markets;
- workers;
- overlays;
- advisor com planos aprovados.

Não adicionar ainda:

- religião;
- entretenimento;
- desirability completa;
- fires;
- military;
- trade routes;
- walkers reais.

## Fonte

[1] CaesarIA Windows, Mac, Linux, Android game - ModDB — https://www.moddb.com/games/caesaria
