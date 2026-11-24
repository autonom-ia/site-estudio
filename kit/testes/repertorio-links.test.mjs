// A conferência de rede do repertório (kit/scripts/manutencao/links-do-repertorio.mjs) fica fora
// do npm test, porque depende da internet. Aqui só a classificação da resposta, sem rede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificar, linksDoRepertorio } from '../scripts/manutencao/links-do-repertorio.mjs';

test('resposta normal é no ar; bloqueio e desafio são "recusa leitor", nunca "fora do ar"', () => {
  assert.equal(classificar({ status: 200 }), 'no-ar');
  assert.equal(classificar({ status: 204 }), 'no-ar');
  for (const status of [202, 401, 403, 405, 429]) assert.equal(classificar({ status }), 'recusa-leitor', String(status));
  for (const status of [404, 410]) assert.equal(classificar({ status }), 'fora-do-ar', String(status));
  assert.equal(classificar({ status: 500 }), 'erro-do-site');
  assert.equal(classificar({ erro: 'TimeoutError' }), 'sem-resposta');
  assert.equal(classificar({ erro: 'ENOTFOUND' }), 'fora-do-ar');
});

test('a conferência lê todos os links das fichas, cada um com a ação e o id', () => {
  const links = linksDoRepertorio();
  assert.ok(links.length >= 35, String(links.length));
  for (const l of links) assert.ok(l.acao && l.id && l.link.startsWith('https://'), JSON.stringify(l));
});
