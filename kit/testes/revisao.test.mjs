// Revisão mais curta e estável (v1.1), sem navegador: o resumo de cada rodada, o contexto que os
// revisores da rodada seguinte recebem (régua + aceitos e recusados, sem nota nenhuma), e as duas
// metas medidas em separado: passar com 8,5 em até 2 rodadas; estabilidade de até 0,3 por lente
// numa reavaliação do mesmo estado do site, sem conserto entre as duas notas.
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
const SKILL = fs.readFileSync(path.join(RAIZ, '.claude', 'skills', 'revisar', 'SKILL.md'), 'utf8');

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
  visitante: { oferta: 'revisão de bicicleta', proximo_passo: 'ligar', sem_ajuda: true },
  bloqueios: [],
  aceitos: [],
  recusados: [],
  ...extra,
});

test('rodada-N.json: valida notas de 0 a 10, as 4 lentes, o número da rodada, as listas e o visitante', () => {
  assert.deepEqual(validarRodada(rodada(1, { arte: 8, geral: 8, fatos: 8, qa: 8 }), 1), []);
  const erros = validarRodada({ rodada: 2, notas: { arte: 11, geral: '8' }, aceitos: [{}], recusados: 'nada' }, 1);
  for (const parte of ['"rodada" deveria ser 1', 'nota "arte"', 'nota "geral"', 'nota "fatos"', 'nota "qa"', 'aceitos[0] sem "problema"', '"recusados" precisa ser uma lista', 'falta "visitante"']) {
    assert.ok(erros.some((e) => e.includes(parte)), `${parte} em ${erros.join(' | ')}`);
  }
  assert.deepEqual(validarRodada([], 1), ['não é um objeto']);
  // o teste do visitante é obrigatório e "sem_ajuda" é sim ou não, não texto
  const visitanteRuim = validarRodada(rodada(1, { arte: 8, geral: 8, fatos: 8, qa: 8 }, { visitante: { oferta: '', proximo_passo: 'ligar', sem_ajuda: 'sim' } }), 1);
  assert.ok(visitanteRuim.some((e) => e.includes('visitante.oferta')), visitanteRuim.join(' | '));
  assert.ok(visitanteRuim.some((e) => e.includes('visitante.sem_ajuda')), visitanteRuim.join(' | '));
  // a reavaliação é opcional e pode ser parcial (só a lente que se quer medir), mas cada nota é válida
  const notas = { arte: 8, geral: 8, fatos: 8, qa: 8 };
  assert.deepEqual(validarRodada(rodada(1, notas, { reavaliacao: { notas: { arte: 8.1 } } }), 1), []);
  const reavRuim = validarRodada(rodada(1, notas, { reavaliacao: { notas: { arte: 11, cor: 8 } } }), 1);
  assert.ok(reavRuim.some((e) => e.includes('reavaliacao') && e.includes('"arte"')), reavRuim.join(' | '));
  assert.ok(reavRuim.some((e) => e.includes('"cor" não é uma lente')), reavRuim.join(' | '));
  assert.ok(validarRodada(rodada(1, notas, { reavaliacao: { notas: {} } }), 1).some((e) => e.includes('pelo menos uma lente')));
  assert.ok(validarRodada(rodada(1, notas, { reavaliacao: {} }), 1).some((e) => e.includes('reavaliacao.notas')));
});

test('trajetória: média de uma casa para mostrar, passa com 8,5 e nenhuma lente abaixo de 7,5', () => {
  const t = trajetoria([
    rodada(1, { arte: 7.3, geral: 7.4, fatos: 7.4, qa: 8.6 }),
    rodada(2, { arte: 8.4, geral: 8.6, fatos: 8.8, qa: 9.0 }),
  ]);
  assert.deepEqual(t.notas.map((n) => [n.rodada, n.media, n.passou]), [[1, 7.7, false], [2, 8.7, true]]);
  assert.equal(t.passou_na_rodada, 2);
  assert.equal(t.oscilacao, undefined, 'variação entre rodadas com conserto no meio não é medida de estabilidade');
  // média alta não basta: uma lente abaixo de 7,5 ou um bloqueio seguram a rodada
  const baixa = trajetoria([rodada(1, { arte: 7.4, geral: 9.5, fatos: 9.5, qa: 9.5 })]);
  assert.equal(baixa.notas[0].passou, false);
  const bloqueada = trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 }, { bloqueios: ['fato sem fonte'] })]);
  assert.deepEqual([bloqueada.notas[0].passou, bloqueada.passou_na_rodada], [false, null]);
});

test('trajetória: 8,45 não vira 8,5 para passar; 8,5 exato passa', () => {
  const quase = trajetoria([rodada(1, { arte: 8.4, geral: 8.5, fatos: 8.4, qa: 8.5 })]);
  assert.equal(quase.notas[0].passou, false);
  assert.equal(quase.passou_na_rodada, null);
  const exato = trajetoria([rodada(1, { arte: 8.4, geral: 8.6, fatos: 8.5, qa: 8.5 })]);
  assert.deepEqual([exato.notas[0].media, exato.notas[0].passou], [8.5, true]);
});

test('trajetória: visitante sem ajuda bloqueia sozinho e o geral acima de 7 é acusado', () => {
  const t = trajetoria([rodada(1, { arte: 9, geral: 8.5, fatos: 9, qa: 9 }, { visitante: { oferta: 'revisão', proximo_passo: 'ligar', sem_ajuda: false } })]);
  assert.equal(t.notas[0].passou, false);
  assert.equal(t.passou_na_rodada, null);
  assert.equal(t.notas[0].bloqueios, 1);
  assert.deepEqual(t.notas[0].alertas, ['visitante_sem_ajuda', 'geral_acima_do_teto']);
  const noTeto = trajetoria([rodada(1, { arte: 9, geral: 7, fatos: 9, qa: 9 }, { visitante: { oferta: 'revisão', proximo_passo: 'ligar', sem_ajuda: false } })]);
  assert.deepEqual(noTeto.notas[0].alertas, ['visitante_sem_ajuda']);
  assert.deepEqual(trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 })]).notas[0].alertas, []);
});

test('trajetória: oferta ou próximo passo que não batem com o brief também põem o geral no teto 7 (a régua manda)', () => {
  const naoBate = { oferta: 'aluguel de bicicleta', proximo_passo: 'ligar', sem_ajuda: true, bate_com_brief: false };
  const acima = trajetoria([rodada(1, { arte: 9, geral: 8.5, fatos: 9, qa: 9 }, { visitante: naoBate })]);
  assert.deepEqual(acima.notas[0].alertas, ['visitante_nao_bate', 'geral_acima_do_teto']);
  // o teto vale, mas só o "sem ajuda" é bloqueio: a lente no teto já segura a rodada pela nota mínima
  assert.equal(acima.notas[0].bloqueios, 0);
  const noTeto = trajetoria([rodada(1, { arte: 9, geral: 7, fatos: 9, qa: 9 }, { visitante: naoBate })]);
  assert.deepEqual(noTeto.notas[0].alertas, ['visitante_nao_bate']);
  const os2 = trajetoria([rodada(1, { arte: 9, geral: 8, fatos: 9, qa: 9 }, { visitante: { ...naoBate, sem_ajuda: false } })]);
  assert.deepEqual(os2.notas[0].alertas, ['visitante_sem_ajuda', 'visitante_nao_bate', 'geral_acima_do_teto']);
  // "bate_com_brief" é sim ou não; ausente (rodada antiga) não acusa nada
  const ruim = validarRodada(rodada(1, { arte: 8, geral: 8, fatos: 8, qa: 8 }, { visitante: { ...naoBate, bate_com_brief: 'não' } }), 1);
  assert.ok(ruim.some((e) => e.includes('visitante.bate_com_brief')), ruim.join(' | '));
  assert.deepEqual(validarRodada(rodada(1, { arte: 8, geral: 8, fatos: 8, qa: 8 }), 1), []);
});

test('skill revisar: o teto 7 do diretor geral segue a régua (oferta, próximo passo ou sem ajuda)', () => {
  assert.ok(REGUA.includes('oferta ou próximo passo errados, ou não dá para fazer sem ajuda'));
  assert.ok(SKILL.includes('"bate_com_brief"'), 'a skill manda gravar se as respostas batem com o brief');
  assert.ok(SKILL.includes('Visitante com resposta que não bate com o brief, ou com "não" na terceira pergunta, põe o diretor geral no teto 7'));
});

test('metas separadas: rodadas por passou_na_rodada; estabilidade só por reavaliação do mesmo estado', () => {
  const r1 = rodada(1, { arte: 7.3, geral: 7.4, fatos: 7.4, qa: 8.6 });
  // sem reavaliação, a estabilidade não foi medida: nada de "0" por falta de dado
  const semMedida = trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 })]);
  assert.equal(semMedida.estabilidade, null);
  assert.deepEqual(semMedida.metas, { em_ate_2_rodadas: true, estabilidade: null });
  // subir de 7,7 para 8,7 com conserto no meio é progresso, não instabilidade
  const r2 = rodada(2, { arte: 8.4, geral: 8.6, fatos: 8.8, qa: 9.0 }, { reavaliacao: { notas: { arte: 8.6, geral: 8.4, fatos: 8.8, qa: 9.1 } } });
  const t = trajetoria([r1, r2]);
  assert.deepEqual(t.estabilidade, { arte: 0.2, geral: 0.2, fatos: 0, qa: 0.1, media: 0, rodadas: [2] });
  assert.deepEqual(t.metas, { em_ate_2_rodadas: true, estabilidade: true });
  const instavel = trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 }, { reavaliacao: { notas: { arte: 8.4, geral: 9, fatos: 9, qa: 9 } } })]);
  assert.equal(instavel.estabilidade.arte, 0.6);
  assert.equal(instavel.metas.estabilidade, false);
});

test('estabilidade com reavaliação só da arte: mede a arte, as outras lentes e a média ficam sem medida', () => {
  // o mesmo estado, avaliado por dois diretores de arte novos: 8,5 e 8,4
  const r2 = rodada(2, { arte: 8.5, geral: 8.5, fatos: 8.5, qa: 8.5 }, { reavaliacao: { notas: { arte: 8.4 } } });
  const t = trajetoria([rodada(1, { arte: 8, geral: 7, fatos: 7.5, qa: 8.5 }), r2]);
  assert.deepEqual(t.estabilidade, { arte: 0.1, geral: null, fatos: null, qa: null, media: null, rodadas: [2] });
  assert.deepEqual(t.metas, { em_ate_2_rodadas: true, estabilidade: true });
  // a arte que oscila mais de 0,3 reprova a meta, mesmo sem as outras lentes medidas
  const instavel = trajetoria([rodada(1, { arte: 9, geral: 9, fatos: 9, qa: 9 }, { reavaliacao: { notas: { arte: 8.5 } } })]);
  assert.equal(instavel.estabilidade.arte, 0.5);
  assert.equal(instavel.metas.estabilidade, false);
  // a nota da rodada continua a primeira avaliação: a reavaliação não entra na média que passa ou não
  assert.equal(t.notas[1].media, 8.5);
  assert.equal(t.notas[1].arte, 8.5);
  // a skill revisar manda gravar a reavaliação só com as lentes reavaliadas
  assert.ok(SKILL.includes('`"reavaliacao": { "notas": { "arte": 8.4 } }` mede só a arte'), 'skill sem a reavaliação parcial');
});

test('contexto: régua sem meta nem ruído; decisões sem nota nenhuma, da rodada mais nova para a mais velha', () => {
  const primeira = montarContexto(1, REGUA, []);
  assert.ok(primeira.includes('## Régua das notas') && primeira.includes('primeira rodada'));
  // a régua que o revisor lê não traz a frase de ruído nem "só baixe por problema novo"
  for (const ancora of ['ruído', '0,3', 'problema novo']) assert.ok(!REGUA.includes(ancora), `régua traz "${ancora}"`);
  const ctx = montarContexto(3, REGUA, [
    rodada(1, { arte: 7, geral: 7, fatos: 7, qa: 8 }, { recusados: [{ lente: 'arte', problema: 'centralizar o pico', porque: 'o brief aprovado pede o pico à esquerda' }] }),
    rodada(2, { arte: 8.4, geral: 8.6, fatos: 8.8, qa: 9 }, { aceitos: [{ lente: 'qa', pagina: 'index.html', problema: 'foco some depois do menu', conserto: 'foco vai para a parte' }] }),
  ]);
  assert.ok(ctx.indexOf('### Rodada 2') >= 0 && ctx.indexOf('### Rodada 2') < ctx.indexOf('### Rodada 1'), ctx);
  for (const nota of ['média', '8,7', '7,3', '8.6', '8,6']) assert.ok(!ctx.includes(nota), `contexto traz "${nota}"`);
  assert.ok(ctx.includes('- QA (index.html). foco some depois do menu: foco vai para a parte'));
  assert.ok(ctx.includes('- Diretor de arte. centralizar o pico: o brief aprovado pede o pico à esquerda'));
  assert.ok(ctx.includes('Não reabra sem fato novo'));
});

test('skill revisar: o diretor geral faz o teste do visitante antes de ler o contexto', () => {
  const linhas = SKILL.split('\n');
  const geral = linhas.find((l) => l.startsWith('**Diretor geral.**'));
  assert.ok(geral, 'parágrafo do diretor geral');
  const foto = geral.indexOf('inicio-390-inteira.jpg');
  const contexto = geral.indexOf('contexto-rN.md');
  assert.ok(foto >= 0 && contexto > foto, 'a foto do celular vem antes do contexto no pedido do diretor geral');
  // nenhuma frase manda TODO pedido começar pelo contexto (isso contaminava o teste do visitante)
  assert.ok(!SKILL.includes('Todo pedido começa com'), 'regra geral contradiz o diretor geral');
  // a meta e o ruído não entram no pedido ao revisor
  const lentes = SKILL.slice(SKILL.indexOf('## 3. As 4 lentes'), SKILL.indexOf('## 4.'));
  for (const ancora of ['0,3', 'ruído', '8,5']) assert.ok(!lentes.includes(ancora), `lentes trazem "${ancora}"`);
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
  // reavaliação só da arte no mesmo estado: a rodada é lida e a estabilidade sai medida
  const r2ok = rodada(2, { arte: 8.5, geral: 8.5, fatos: 8.5, qa: 8.5 }, { reavaliacao: { notas: { arte: 8.4 } } });
  fs.writeFileSync(path.join(pasta, 'rodada-2.json'), JSON.stringify(r2ok));
  const parcial = estudio('revisao', 'rev');
  assert.equal(parcial.codigo, 0, JSON.stringify(parcial.json));
  assert.deepEqual(parcial.json.avisos, []);
  assert.deepEqual(parcial.json.dados.rodadas_anteriores, [1, 2]);
  assert.equal(parcial.json.dados.estabilidade.arte, 0.1);
  assert.equal(parcial.json.dados.metas.estabilidade, true);
  // a rodada pode ser escolhida
  const r2 = estudio('revisao', 'rev', '--rodada', '1');
  assert.equal(r2.json.dados.rodada, 1);
  assert.ok(fs.readFileSync(path.join(pasta, 'contexto-r1.md'), 'utf8').includes('primeira rodada'));
});
