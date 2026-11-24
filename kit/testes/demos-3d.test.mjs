// Demos de 3D (kit/demos/3d): o molde com a marca em 3D (roda raiada no topo) e o configurador
// 3D (caramanhola). Prova antes do repertório: o 3D só baixa quando o palco chega perto da tela,
// a imagem de reserva fica sem WebGL e com "reduzir movimento", teclado e leitor de tela
// funcionam, o peso fica abaixo do limite e as fotos de conferência mostram a cena.
// Os testes de navegador pulam se não houver Chrome, Edge ou Chromium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { esperar } from '../scripts/lib/cdp.mjs';
import { abrirSessao } from '../scripts/lib/sessao.mjs';
import { conferir3d, LIMITE_3D } from '../scripts/lib/peso-3d.mjs';
import { demosDisponiveis } from '../scripts/comandos/novo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEMO = path.join(RAIZ, 'kit', 'demos', '3d');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const SEM_NAVEGADOR = !acharNavegador();
const opcoes = { skip: SEM_NAVEGADOR ? 'sem Chrome, Edge ou Chromium nesta máquina' : false, timeout: 300000 };
// Orçamento das demos, bem abaixo do limite do estúdio: o carregador (o único arquivo de 3D
// baixado ao abrir a página) e todo o código 3D, comprimidos.
const CARREGADOR_KB = 3;
const DEMO_KB = 20;
const CELULAR = Object.freeze({ largura: 390, altura: 844, movel: true });

let base;
let env;
function estudio(...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env, timeout: 280000 });
  const linhas = (r.stdout || '').trim().split('\n');
  let json = null;
  try {
    json = JSON.parse(linhas[linhas.length - 1]);
  } catch {}
  return { codigo: r.status, json };
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-demo3d-'));
  env = { ...process.env, ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem-marca'), ESTUDIO_NAO_ABRIR: '1' };
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

test('a demo 3D mora em kit/demos/3d, por cima do molde, e é só texto (nenhuma foto, nenhum modelo)', () => {
  assert.deepEqual(demosDisponiveis(), ['3d']);
  for (const rel of ['_gerador/ordem.mjs', '_gerador/secoes/abertura-3d.mjs', '_gerador/secoes/configurador-3d.mjs',
    'site/assets/3d/3d.js', 'site/assets/3d/cena-3d.js', 'site/assets/3d/raio-3d.js', 'site/assets/3d/caramanhola-3d.js', 'site/assets/3d/3d.css']) {
    assert.ok(fs.existsSync(path.join(DEMO, ...rel.split('/'))), rel);
  }
  const andar = (p) => fs.readdirSync(p).flatMap((n) => (fs.statSync(path.join(p, n)).isDirectory() ? andar(path.join(p, n)) : [n]));
  for (const nome of andar(DEMO)) assert.ok(['.mjs', '.js', '.css'].some((e) => nome.endsWith(e)), `${nome} não é texto`);
});

test('o peso da demo: o carregador e todo o código 3D bem abaixo do limite do estúdio', () => {
  const r = conferir3d(path.join(DEMO, 'site'));
  assert.deepEqual(r.acima, []);
  assert.deepEqual(r.modelos, []);
  assert.ok(r.js_kb_comprimido <= DEMO_KB && DEMO_KB < LIMITE_3D.js_kb_comprimido, `${r.js_kb_comprimido} KB`);
  const carregador = gzipSync(fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', '3d.js')), { level: 9 }).length / 1024;
  assert.ok(carregador <= CARREGADOR_KB, `carregador com ${carregador.toFixed(1)} KB`);
});

test('as seções já trazem a imagem de reserva e só o carregador; escolhas em rádio dentro de fieldset, nunca select', async () => {
  const { esc, palavras } = await import('../molde/_gerador/montar.mjs');
  const { default: abertura } = await import('../demos/3d/_gerador/secoes/abertura-3d.mjs');
  const { default: configurador } = await import('../demos/3d/_gerador/secoes/configurador-3d.mjs');
  const ctx = { esc, palavras, link: (r) => r, assets: 'assets/' };
  for (const html of [abertura(ctx), configurador(ctx)]) {
    assert.ok(html.includes('data-3d-estado="reserva"'), 'o palco nasce na reserva');
    assert.ok(html.includes('class="palco-3d__reserva'), 'a imagem de reserva vem na página');
    assert.ok(html.includes('src="assets/3d/3d.js" defer'), 'só o carregador vai na página');
    assert.equal(html.includes('cena-3d.js'), false, 'o motor não vai na página: só baixa perto da tela');
    assert.equal(html.toLowerCase().includes('<select'), false);
    assert.equal(html.includes('<canvas'), false, 'sem desenho vazio esperando: o canvas nasce do 3D');
  }
  const marca = abertura(ctx);
  assert.ok(marca.includes('data-3d="raio"') && marca.includes('aria-hidden="true"'), 'a roda é enfeite');
  const conf = configurador(ctx);
  assert.equal(conf.split('<fieldset').length - 1, 3);
  assert.equal(conf.split('<legend').length - 1, 3);
  assert.equal(conf.split('type="radio"').length - 1, 8);
  assert.ok(conf.includes('role="img"') && conf.includes('aria-live="polite"'));
});

test('arte: reserva da roda na pose do 3D, contorno alisado que mantém pontos e quinas, rodinha gravada e cara da marca', async () => {
  const { esc, palavras } = await import('../molde/_gerador/montar.mjs');
  const { default: abertura } = await import('../demos/3d/_gerador/secoes/abertura-3d.mjs');
  const { default: configurador, suavizar } = await import('../demos/3d/_gerador/secoes/configurador-3d.mjs');
  const ctx = { esc, palavras, link: (r) => r, assets: 'assets/' };
  // a pose parada vai para a cena: o desenho de reserva e o 3D parado são a mesma roda
  const marca = abertura(ctx);
  assert.ok(marca.includes('data-3d-pose="'), 'a roda sem a pose para a cena');
  assert.equal(marca.includes('<circle class="roda-reserva__pneu"'), false, 'a reserva voltou a ser a roda de frente');
  // o alisado passa pelos pontos originais, mantém a quina e põe 3 pontos entre vizinhos
  const bruto = [[0, 0], [0.3, 0], [0.3, 0], [0.4, 0.5], [0.4, 1]];
  const liso = suavizar(bruto);
  for (const p of bruto) assert.ok(liso.some((q) => q[0] === p[0] && q[1] === p[1]), String(p));
  assert.equal(liso.length, bruto.length + 3 * 3);
  const quina = liso.findIndex((q) => q[0] === 0.3 && q[1] === 0);
  assert.deepEqual(liso[quina + 1], [0.3, 0], 'a quina continua sendo ponto repetido');
  const conf = configurador(ctx);
  assert.ok(conf.includes('data-3d-emblema="') && conf.includes('class="caramanhola-reserva__emblema"'), 'a rodinha gravada no 3D e na reserva');
  assert.equal(conf.split('data-tom="').length - 1, 4, 'cada cor diz se é clara ou escura');
  assert.ok(conf.includes('class="assinatura configurador__titulo"'));
  assert.equal(conf.split('assinatura__linha--').length - 1, 4, 'o título com as quatro linhas de pesos');
  assert.ok(conf.includes('<a class="botao" data-3d-pedido'), 'a ação principal com o botão da marca');
  assert.ok(conf.includes('class="caramanhola-reserva__bancada"'), 'a peça fica de pé numa linha de bancada');
});

test('demo 3D: conferências passam e as fotos mostram as duas cenas abertas, no celular e no computador', opcoes, () => {
  const novo = estudio('novo', 'demo', '--demo', '3d');
  assert.equal(novo.codigo, 0, JSON.stringify(novo.json));
  assert.equal(novo.json.dados.demo, '3d');
  assert.deepEqual(novo.json.dados.paginas, ['index.html', 'monte/index.html']);
  assert.equal(estudio('novo', 'outra', '--demo', 'nada').json.codigo, 'ARGUMENTO_INVALIDO');

  const pr = estudio('prints', 'demo', '--tamanhos', '390,1440');
  assert.equal(pr.codigo, 0, JSON.stringify(pr.json));
  assert.deepEqual(pr.json.avisos, []);
  const vistas = pr.json.dados.cenas3d.map((c) => `${c.pagina} ${c.largura} ${c.cena} ${c.estado}`).sort();
  assert.deepEqual(vistas, [
    'index.html 1440 raio pronta', 'index.html 390 raio pronta',
    'monte/index.html 1440 caramanhola pronta', 'monte/index.html 390 caramanhola pronta',
  ]);
  for (const c of pr.json.dados.cenas3d) assert.ok(c.uniforme < 0.95, `${c.cena} em ${c.largura}: ${c.uniforme}`);

  // com "reduzir movimento", as fotos mostram a imagem de reserva, sem aviso
  const reduzido = estudio('prints', 'demo', '--tamanhos', '390', '--reduzido', '--rodada', '2');
  assert.equal(reduzido.codigo, 0);
  assert.deepEqual(reduzido.json.avisos, []);
  assert.ok(reduzido.json.dados.cenas3d.every((c) => c.estado === 'reserva'));

  const acess = estudio('acessibilidade', 'demo');
  assert.equal(acess.codigo, 0, JSON.stringify(acess.json && acess.json.dados));
  assert.equal(estudio('medir', 'demo').codigo, 0);
  // o checar só reprova porque a demo é do negócio fictício (molde: true), e nunca por erro ou peso
  const ch = estudio('checar', 'demo');
  assert.deepEqual([...new Set(ch.json.dados.vermelhos.map((v) => v.tipo))], ['resto-do-molde']);
});

// Uma página da demo com o configurador longe do topo, para ver quando o 3D baixa.
function paginaLonge() {
  const site = path.join(base, 'demo', 'site');
  const html = fs.readFileSync(path.join(site, 'monte', 'index.html'), 'utf8');
  const marca = '<main id="conteudo" tabindex="-1">';
  assert.ok(html.includes(marca));
  fs.mkdirSync(path.join(site, 'longe'), { recursive: true });
  fs.writeFileSync(path.join(site, 'longe', 'index.html'), html.replace(marca, `${marca}<div style="height:3200px"></div>`));
  return site;
}

const estado = (s) => s.tab.evaluate(`document.getElementById('caramanhola').getAttribute('data-3d-estado')`);
const baixou = (s, arquivo) => s.rede().arquivos.some((a) => a.url.endsWith(`/assets/3d/${arquivo}`));
async function esperarEstado(s, alvo, teto = 15000) {
  const fim = Date.now() + teto;
  while (Date.now() < fim) {
    if ((await estado(s)) === alvo) return true;
    await esperar(100);
  }
  return false;
}
const irAoPalco = (s) => s.tab.evaluate(`document.getElementById('caramanhola').scrollIntoView({ block: 'center' })`);

test('o 3D só baixa quando o palco chega perto da tela; sem WebGL ou com reduzir movimento, fica a reserva', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  const site = paginaLonge();

  const s = await abrirSessao(site, { tamanho: CELULAR });
  try {
    await s.ir(s.url('longe/'));
    await esperar(900);
    assert.equal(await estado(s), 'reserva');
    assert.ok(baixou(s, '3d.js'), 'o carregador vem com a página');
    assert.equal(baixou(s, 'cena-3d.js'), false, 'o motor baixou antes de o palco chegar perto');
    await irAoPalco(s);
    assert.ok(await esperarEstado(s, 'pronta'), `ficou em ${await estado(s)}`);
    assert.ok(baixou(s, 'cena-3d.js') && baixou(s, 'caramanhola-3d.js'));
    assert.deepEqual(s.errosJs(), []);
  } finally {
    await s.fechar();
  }

  const r = await abrirSessao(site);
  try {
    await r.tamanho(CELULAR, { reduzido: true });
    await r.ir(r.url('longe/'));
    await irAoPalco(r);
    await esperar(1200);
    assert.equal(await estado(r), 'reserva');
    assert.equal(baixou(r, 'cena-3d.js'), false, 'com reduzir movimento, o 3D nem baixa');
    const reserva = await r.tab.evaluate(`getComputedStyle(document.querySelector('#caramanhola .palco-3d__reserva')).opacity`);
    assert.equal(reserva, '1');
  } finally {
    await r.fechar();
  }

  const w = await abrirSessao(site, { tamanho: CELULAR });
  try {
    await w.tab.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl' || t === 'webgl2' || t === 'experimental-webgl' ? null : o.call(this, t, ...a); }; })();",
    });
    await w.ir(w.url('longe/'));
    await irAoPalco(w);
    await esperar(1500);
    assert.equal(await estado(w), 'reserva');
    assert.deepEqual(w.errosJs(), [], 'sem WebGL, nenhum erro: a reserva fica');
  } finally {
    await w.fechar();
  }
});

test('o configurador funciona só com o teclado, e a escolha é dita e levada ao pedido', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  const s = await abrirSessao(path.join(base, 'demo', 'site'), { tamanho: CELULAR });
  const tecla = async (key, code) => {
    for (const type of ['keyDown', 'keyUp']) await s.tab.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: code === 'Tab' ? 9 : 39 });
    await esperar(120);
  };
  const ler = (js) => s.tab.evaluate(js);
  try {
    await s.ir(s.url('monte/'));
    await esperar(500);
    await ler(`document.querySelector('input[name="cor"]:checked').focus()`);
    await tecla('ArrowRight', 'ArrowRight');
    assert.equal(await ler(`document.querySelector('input[name="cor"]:checked').value`), 'azul');
    await tecla('Tab', 'Tab');
    assert.equal(await ler('document.activeElement.name'), 'acabamento');
    await tecla('ArrowRight', 'ArrowRight');
    const resumo = 'Caramanhola azul quadro, brilhante, com faixa refletiva.';
    assert.equal(await ler(`document.querySelector('[data-3d-resumo]').textContent`), resumo);
    assert.equal(await ler(`document.querySelector('[data-3d-resumo]').getAttribute('aria-live')`), 'polite');
    assert.equal(await ler(`document.getElementById('caramanhola').getAttribute('aria-label')`), resumo);
    const href = await ler(`document.querySelector('[data-3d-pedido]').getAttribute('href')`);
    assert.ok(href.endsWith(encodeURIComponent(`Olá! Quero esta: ${resumo}`)), href);
    // a imagem de reserva acompanha a escolha só com CSS
    assert.equal(await ler(`getComputedStyle(document.querySelector('.configurador')).getPropertyValue('--esmalte').trim()`), '#1C46BF');
    assert.deepEqual(s.errosJs(), []);
  } finally {
    await s.fechar();
  }
});
