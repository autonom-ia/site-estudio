// Revisão mais curta e estável (v1.1), sem navegador: o resumo de cada rodada, o contexto que os
// revisores da rodada seguinte recebem (régua + aceitos e recusados), a medida da meta (8,5 em até
// 2 rodadas, oscilação de cada lente até 0,3).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validarRodada, trajetoria, montarContexto } from '../scripts/lib/rodadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const REGUA = fs.readFileSync(path.join(RAIZ, 'kit', 'regua-revisao.md'), 'utf8');

let base;
let env;
function estudio(...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env, timeout: 60000 });
  const linhas = (r.stdout || '').trim().split('\n');
  return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
}
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-rev-'));
  env = { ...process.env, ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem-marca'), ESTUDIO_NAO_ABRIR: '1' };
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

const rodada = (n, notas, extra = {}) => ({
  rodada: n,
  notas,
  visitante: { oferta: 'pão e café', proximo_passo: 'ligar', sem_ajuda: true },
  bloqueios: [],
  aceitos: [],
  recusados: [],
  ...extra,
});

test('rodada-N.json: valida notas de 0 a 10, as 4 lentes, o número da rodada e as listas', () => {
  assert.deepEqual(validarRodada(rodada(1, { arte: 8, geral: 8, fatos: 8, qa: 8 }), 1), []);
  const erros = validarRodada({ rodada: 2, notas: { arte: 11, geral: '8' }, aceitos: [{}], recusados: 'nada' }, 1);
  for (const parte of ['"rodada" deveria ser 1', 'nota "arte"', 'nota "geral"', 'nota "fatos"', 'nota "qa"', 'aceitos[0] sem "problema"', '"recusados" precisa ser uma lista']) {
    assert.ok(erros.some((e) => e.includes(parte)), `${parte} em ${erros.join(' | ')}`);
  }
  assert.deepEqual(validarRodada([], 1), ['não é um objeto']);
});

test('trajetória: média de uma casa, passa com 8,5 e nenhuma lente abaixo de 7,5, oscilação por lente', () => {
  const t = trajetoria([
    rodada(1, { arte: 7.3, geral: 7.4, fatos: 7.4, qa: 8.6 }),
    rodada(2, { arte: 8.4, geral: 8.6, fatos: 8.8, qa: 9.0 }),
    rodada(3, { arte: 8.6, geral: 8.4, fatos: 8.8, qa: 9.0 }),
  ]);
  assert.deepEqual(t.notas.map((n) => [n.rodada, n.media, n.passou]), [[1, 7.7, false], [2, 8.7, true], [3, 8.7, true]]);
  assert.equal(t.passou_na_rodada, 2);
  assert.deepEqual(t.oscilacao, { arte: 1.1, geral: 1.2, fatos: 1.4, qa: 0.4, media: 1 });
  // média alta não basta: uma lente abaixo de 7,5 ou um bloqueio seguram a rodada
  const baixa = trajetoria([rodada(1, { arte: 7.4, geral: 9.5, fatos: 9.5, qa: 9.5 })]);
  assert.equal(baixa.notas[0].passou, false);
  const bloqueada = trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 }, { bloqueios: ['fato sem fonte'] })]);
  assert.deepEqual([bloqueada.notas[0].passou, bloqueada.passou_na_rodada], [false, null]);
  // rodada que falta no meio não vira oscilação falsa
  const pulada = trajetoria([rodada(1, { arte: 6, geral: 6, fatos: 6, qa: 6 }), rodada(3, { arte: 9, geral: 9, fatos: 9, qa: 9 })]);
  assert.equal(pulada.oscilacao.arte, 0);
});

test('contexto: régua sempre; decisões das rodadas anteriores, da mais nova para a mais velha', () => {
  const primeira = montarContexto(1, REGUA, []);
  assert.ok(primeira.includes('## Régua das notas') && primeira.includes('primeira rodada'));
  const ctx = montarContexto(3, REGUA, [
    rodada(1, { arte: 7, geral: 7, fatos: 7, qa: 8 }, { recusados: [{ lente: 'arte', problema: 'centralizar o pico', porque: 'o brief aprovado pede o pico à esquerda' }] }),
    rodada(2, { arte: 8.4, geral: 8.6, fatos: 8.8, qa: 9 }, { aceitos: [{ lente: 'qa', pagina: 'index.html', problema: 'foco some depois do menu', conserto: 'foco vai para a parte' }] }),
  ]);
  assert.ok(ctx.indexOf('### Rodada 2 (média 8,7)') < ctx.indexOf('### Rodada 1 (média 7,3)'), ctx);
  assert.ok(ctx.includes('- QA (index.html). foco some depois do menu: foco vai para a parte'));
  assert.ok(ctx.includes('- Diretor de arte. centralizar o pico: o brief aprovado pede o pico à esquerda'));
  assert.ok(ctx.includes('Não reabra sem fato novo'));
});

test('revisao: escreve contexto-rN.md, avisa rodada ilegível e devolve a trajetória das notas', () => {
  assert.equal(estudio('novo', 'rev').codigo, 0);
  const pasta = path.join(base, 'rev', 'revisao');
  fs.mkdirSync(pasta, { recursive: true });
  const r1 = rodada(1, { arte: 7.6, geral: 7.8, fatos: 8.0, qa: 8.6 }, { recusados: [{ lente: 'fatos', problema: 'tirar o horário', porque: 'a fonte confirma' }] });
  fs.writeFileSync(path.join(pasta, 'rodada-1.json'), JSON.stringify(r1));
  fs.writeFileSync(path.join(pasta, 'rodada-1.md'), '# Rodada 1\n');
  fs.writeFileSync(path.join(pasta, 'rodada-2.md'), '# Rodada 2\n');
  fs.writeFileSync(path.join(pasta, 'rodada-2.json'), '{ "rodada": 2, ');
  const r = estudio('revisao', 'rev');
  assert.equal(r.codigo, 0, JSON.stringify(r.json));
  assert.equal(r.json.codigo, 'REVISAO_PRONTA');
  assert.equal(r.json.dados.rodada, 3);
  assert.deepEqual(r.json.dados.rodadas_anteriores, [1]);
  assert.deepEqual(r.json.avisos.map((a) => a.codigo), ['RODADA_ILEGIVEL']);
  assert.deepEqual(r.json.dados.notas.map((n) => n.media), [8]);
  const ctx = fs.readFileSync(path.join(pasta, 'contexto-r3.md'), 'utf8');
  assert.ok(ctx.startsWith('# Contexto da rodada 3'));
  assert.ok(ctx.includes('## Régua das notas') && ctx.includes('tirar o horário: a fonte confirma'));
  // a rodada pode ser escolhida
  const r2 = estudio('revisao', 'rev', '--rodada', '1');
  assert.equal(r2.json.dados.rodada, 1);
  assert.ok(fs.readFileSync(path.join(pasta, 'contexto-r1.md'), 'utf8').includes('primeira rodada'));
});
