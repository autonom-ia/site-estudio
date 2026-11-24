// Consertos da conferência de fatos trazidos do View Estúdio 1.2: a vírgula decimal faz parte do
// número, número com % ou com mil/milhão/bilhão pede fonte mesmo pequeno, os números de uma linha
// não se juntam atravessando palavras, e a tabela vale com ou sem barra nas bordas (como no GFM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerTabelaDeFatos, montarLastro, conferirTexto, numerosMarcados, numerosDaLinha, celulasDaLinha, tabelaDeFatosIlegivel,
} from '../scripts/lib/fatos.mjs';

test('fatos: "Atendemos 1.250 clientes" com fonte não libera o preço "R$ 12,50" da página', () => {
  const lastro = montarLastro(lerTabelaDeFatos('| Fato | Fonte |\n|---|---|\n| Atendemos 1.250 clientes | a dona |'));
  assert.deepEqual(conferirTexto({ texto: 'Revisão por R$ 12,50. Já são 1.250 clientes.' }, lastro).faltam.map((f) => f.trecho), ['12,50']);
});

test('fatos: "Seg a sex, 8 às 18h" não sustenta "818 clientes"', () => {
  const lastro = montarLastro(lerTabelaDeFatos('| Fato | Fonte |\n|---|---|\n| Seg a sex, 8 às 18h | a dona |'));
  assert.deepEqual(conferirTexto({ texto: 'Abrimos 8 às 18h. Já são 818 clientes.' }, lastro).faltam.map((f) => f.trecho), ['818']);
});

test('fatos: tabela de cima quebrada com a de baixo certa é avisada', () => {
  const md = '| Fato | Fonte |\n| Abriu em 2019 | a dona |\n\n## Lido pelo estúdio\n\n| Fato | Fonte | Data |\n|---|---|---|\n| Nota 4,8 no Google | Google | 2026 |';
  assert.deepEqual(lerTabelaDeFatos(md).map((l) => l.fato), ['Nota 4,8 no Google']);
  assert.equal(tabelaDeFatosIlegivel(md), true);
  assert.equal(tabelaDeFatosIlegivel('| Fato | Fonte |\n|---|---|\n| Abriu em 2019 | a dona |'), false);
});
test('fatos: número com % ou com mil/milhão/bilhão pede fonte mesmo com menos de 3 dígitos', () => {
  assert.deepEqual(numerosMarcados('Cresceu 38% e 2,5 % ao mês; 40 mil clientes, 3 milhões de reais, 12,5% e 7 dias').map((m) => m.chave),
    ['38%', '2,5%', '40 mil', '3 milhoes']);
  const lastro = montarLastro(lerTabelaDeFatos('| Fato | Fonte |\n|---|---|\n| 38% das vendas antes das 8 | caixa da loja |\n| 3 milhões de reais em 2025 | balanço |\n| 7% de desconto | |'));
  const r = conferirTexto({ texto: '38% das vendas. 3 milhoes de reais. 40 mil clientes. 7% de desconto. 3 lojas.' }, lastro);
  assert.deepEqual(r.faltam.map((f) => `${f.trecho}:${f.motivo}`).sort(), ['40 mil:fora-de-fatos', '7%:linha-sem-fonte']);
});

test('fatos: a vírgula decimal faz parte do número ("2,5%" não libera "25%"; "12,5%" não libera "125")', () => {
  const lastro = montarLastro(lerTabelaDeFatos('| Fato | Fonte |\n|---|---|\n| Cresceu 2,5% ao mês | balanço |\n| 12,5% dos pedidos | sistema |\n| Ticket de R$ 1.250,90 | caixa |'));
  const r = conferirTexto({ texto: 'Cresceu 25% ao mês. 125 clientes. 2,5% ao mês. 12,5% dos pedidos. R$ 1.250,90 de ticket.' }, lastro);
  assert.deepEqual(r.faltam.map((f) => `${f.trecho}:${f.motivo}`).sort(), ['125:fora-de-fatos', '25%:fora-de-fatos']);
});

test('fatos: número de uma linha só se junta pelo separador de número, não atravessa palavras', () => {
  assert.equal(numerosDaLinha('1 de 3 pedidos (33%)').has('133'), false);
  assert.ok(numerosDaLinha('(11) 4198-2000').has('1141982000'));
  assert.ok(numerosDaLinha('1 250 pedidos').has('1250'), 'espaço fino é separador de milhar');
  const lastro = montarLastro(lerTabelaDeFatos('| Fato | Fonte |\n|---|---|\n| 1 de 3 pedidos (33%) | sistema |'));
  assert.deepEqual(conferirTexto({ texto: 'Foram 133 pedidos.' }, lastro).faltam.map((f) => f.trecho), ['133']);
});

test('fatos: tabela com ou sem barra nas bordas, barra escapada na célula, e tabela ilegível avisada', () => {
  assert.deepEqual(celulasDaLinha('| Preço \\| à vista | loja |'), ['Preço | à vista', 'loja']);
  const semBorda = lerTabelaDeFatos('Fato | Fonte | Data\n--- | --- | ---\nAbriu em 2019 | a dona | 2026\n\nTexto solto 1982 | nada');
  assert.deepEqual(semBorda.map((l) => [l.fato, l.fonte, l.comFonte]), [['Abriu em 2019', 'a dona', true]]);
  const escapada = lerTabelaDeFatos('| Fato | Fonte |\n|:--|--:|\n| R$ 120 \\| R$ 150 | tabela de preços \\| 2026 |');
  assert.deepEqual(escapada.map((l) => [l.fato, l.fonte]), [['R$ 120 | R$ 150', 'tabela de preços | 2026']]);
  // sem a linha separadora: a tabela não vale, e isso é dito (em vez de tudo virar fora-de-fatos)
  const md = '| Fato | Fonte |\n| Abriu em 2019 | a dona |';
  assert.equal(lerTabelaDeFatos(md).length, 0);
  assert.equal(tabelaDeFatosIlegivel(md), true);
  assert.equal(tabelaDeFatosIlegivel('# Fatos sem tabela'), false);
});

