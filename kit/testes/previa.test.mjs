// Prévia lado a lado (abrir) e antes e depois (antes + comparar), sem navegador: o servidor, as
// páginas geradas e as conferências que reprovam (menos de 2 mudanças, site igual ao de antes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { paginaDaPrevia, esc, CELULAR, COMPUTADOR } from '../scripts/lib/previa.mjs';
import { paginaDeComparacao } from '../scripts/lib/comparacao.mjs';
import { lerMudancas } from '../scripts/lib/antes-depois.mjs';

const DESPACHANTE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'estudio.mjs');

function estudio(env, ...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
  return { codigo: r.status, json: JSON.parse(r.stdout.trim().split('\n').pop()) };
}

function escrever(arquivo, texto) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, texto);
}

// Um site mínimo já montado, numa pasta temporária.
function siteDeTeste() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-previa-'));
  const env = { ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') };
  const site = path.join(base, 'sites', 'loja', 'site');
  escrever(path.join(site, 'index.html'), '<!doctype html><title>Loja</title><link rel="stylesheet" href="assets/site.css"><h1>Loja</h1>');
  escrever(path.join(site, 'assets', 'site.css'), 'body{background:#123}');
  return { base, env, site, ferr: env.ESTUDIO_FERRAMENTAS };
}

function encerrar(base) {
  const pasta = path.join(base, 'ferr', 'servidores');
  const estados = [];
  for (const sub of ['', 'comparar']) {
    const dir = path.join(pasta, sub);
    if (fs.existsSync(dir)) for (const n of fs.readdirSync(dir)) if (n.endsWith('.json')) estados.push(path.join(dir, n));
  }
  for (const e of estados) {
    try {
      process.kill(JSON.parse(fs.readFileSync(e, 'utf8')).pid);
    } catch {}
  }
  fs.rmSync(base, { recursive: true, force: true });
}

test('prévia: celular e computador na mesma página, mesma origem, nada de fora e texto escapado', () => {
  const html = paginaDaPrevia();
  assert.ok(html.includes(`data-largura="${CELULAR.largura}"`) && html.includes(`data-altura="${CELULAR.altura}"`));
  assert.ok(html.includes(`data-largura="${COMPUTADOR.largura}"`) && html.includes(`data-altura="${COMPUTADOR.altura}"`));
  assert.equal(html.split('<iframe').length - 1, 2);
  for (const ruim of ['src="http', "src='http", 'href="http', '<select', 'url(http']) assert.equal(html.includes(ruim), false, ruim);
  assert.equal(esc('<b a="1">&\''), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  const comp = paginaDeComparacao({ pedido: 'mais <i>caseiro</i>', mudancas: [{ titulo: 'Cor <script>', porque: '' }, { titulo: 'Letra', porque: 'mais redonda' }] });
  assert.ok(comp.includes('mais &lt;i&gt;caseiro&lt;/i&gt;'));
  assert.ok(comp.includes('Cor &lt;script&gt;'));
  assert.ok(comp.includes('src="antes/"') && comp.includes('src="depois/"'));
  assert.equal(comp.includes('<select'), false);
});

test('lerMudancas: só conta mudança com título e guarda o pedido', () => {
  assert.deepEqual(lerMudancas({ pedido: ' mais elegante ', mudancas: [{ titulo: ' A ' }, { titulo: '' }, { porque: 'x' }, 'solto'] }), {
    pedido: 'mais elegante',
    mudancas: [{ titulo: 'A', porque: '' }],
    ignoradas: 3,
  });
  assert.deepEqual(lerMudancas(null), { pedido: '', mudancas: [], ignoradas: 0 });
});

test('abrir: devolve a prévia lado a lado, servida pelo mesmo servidor do site', async () => {
  const t = siteDeTeste();
  try {
    const r = estudio(t.env, 'abrir', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 0, JSON.stringify(r.json));
    const { endereco, previa } = r.json.dados;
    assert.equal(previa, `${endereco}__previa/`);
    const pagina = await (await fetch(previa)).text();
    assert.ok(pagina.includes('O site no tamanho de celular') && pagina.includes('O site no tamanho de computador'));
    assert.ok((await (await fetch(endereco)).text()).includes('<h1>Loja</h1>'));
    const id = await (await fetch(`${endereco}__estudio.json`)).json();
    assert.equal(id.previa, '/__previa/');
    // a prévia nunca vai para a pasta do site (não entra no que vai para o ar)
    assert.equal(fs.readdirSync(t.site).includes('__previa'), false);
  } finally {
    encerrar(t.base);
  }
});

test('antes e depois: reprova sem antes, com menos de 2 mudanças e com o site igual; mostra os dois lados', async () => {
  const t = siteDeTeste();
  const mudancas = path.join(t.base, 'sites', 'loja', 'revisao', 'antes-depois', 'mudancas.json');
  try {
    let r = estudio(t.env, 'comparar', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 1);
    assert.equal(r.json.codigo, 'ANTES_NAO_GUARDADO');

    r = estudio(t.env, 'antes', 'loja');
    assert.equal(r.json.codigo, 'ANTES_GUARDADO');
    assert.deepEqual(JSON.parse(fs.readFileSync(mudancas, 'utf8')), { pedido: '', mudancas: [] });

    r = estudio(t.env, 'comparar', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 2);
    assert.equal(r.json.codigo, 'POUCAS_MUDANCAS');
    assert.equal(r.json.dados.precisa, 2);

    const duas = { pedido: 'mais caseiro', mudancas: [{ titulo: 'Fundo creme', porque: 'mais acolhedor' }, { titulo: 'Letra redonda', porque: 'menos formal' }] };
    fs.writeFileSync(mudancas, JSON.stringify(duas));
    r = estudio(t.env, 'comparar', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 2);
    assert.equal(r.json.codigo, 'NADA_MUDOU');

    fs.writeFileSync(path.join(t.site, 'assets', 'site.css'), 'body{background:#f4ecdc}');
    r = estudio(t.env, 'comparar', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 0, JSON.stringify(r.json));
    assert.equal(r.json.codigo, 'COMPARACAO_PRONTA');
    assert.deepEqual(r.json.dados.mudancas, ['Fundo creme', 'Letra redonda']);
    assert.deepEqual(r.json.avisos, []);
    const { endereco } = r.json.dados;
    const pagina = await (await fetch(endereco)).text();
    assert.ok(pagina.includes('Você pediu: mais caseiro') && pagina.includes('Fundo creme') && pagina.includes('Letra redonda'));
    assert.equal(await (await fetch(`${endereco}antes/assets/site.css`)).text(), 'body{background:#123}');
    assert.equal(await (await fetch(`${endereco}depois/assets/site.css`)).text(), 'body{background:#f4ecdc}');

    fs.writeFileSync(mudancas, JSON.stringify({ ...duas, mudancas: [...duas.mudancas, { titulo: 'C' }, { titulo: 'D' }] }));
    r = estudio(t.env, 'comparar', 'loja', '--sem-navegador');
    assert.equal(r.codigo, 0);
    assert.deepEqual(r.json.avisos.map((a) => a.codigo), ['MUDANCAS_DEMAIS']);
    // nada do antes e depois entra no site que vai para o ar
    assert.deepEqual(fs.readdirSync(t.site).sort(), ['assets', 'index.html']);
  } finally {
    encerrar(t.base);
  }
});
