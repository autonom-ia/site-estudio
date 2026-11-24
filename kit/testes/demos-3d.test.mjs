// Demos de 3D (kit/demos/3d): o molde com a marca em 3D (roda raiada no topo) e o configurador
// 3D (caramanhola). Prova antes do repertório: o 3D só baixa quando o palco chega perto da tela,
// a imagem de reserva fica sem WebGL e com "reduzir movimento", teclado e leitor de tela
// funcionam, o peso fica abaixo do limite e as fotos de conferência mostram a cena.
// Os testes de navegador pulam se não houver Chrome, Edge ou Chromium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesDoNavegador } from './fixtures/navegador.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { esperar } from '../scripts/lib/cdp.mjs';
import { abrirSessao } from '../scripts/lib/sessao.mjs';
import { conferir3d, LIMITE_3D } from '../scripts/lib/peso-3d.mjs';
import { fotografarPng } from '../scripts/comandos/prints.mjs';
import { demosDisponiveis } from '../scripts/comandos/novo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEMO = path.join(RAIZ, 'kit', 'demos', '3d');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const opcoes = opcoesDoNavegador(300000);
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

test('arte 2: reserva e 3D parado são a mesma peça (pose, câmera e bancada), e o brilhante reflete em peça em pé', async () => {
  const { esc, palavras } = await import('../molde/_gerador/montar.mjs');
  const { default: abertura } = await import('../demos/3d/_gerador/secoes/abertura-3d.mjs');
  const { default: configurador, emblemaNaPose, bancadaNaReserva, enquadramento } = await import('../demos/3d/_gerador/secoes/configurador-3d.mjs');
  const ctx = { esc, palavras, link: (r) => r, assets: 'assets/' };
  const conf = configurador(ctx);
  // a pose e a câmera vão para a cena; a reserva é enquadrada pela mesma câmera
  const inicio = conf.indexOf('data-3d-pose="') + 'data-3d-pose="'.length;
  const pose = JSON.parse(conf.slice(inicio, conf.indexOf('"', inicio)).split('&quot;').join('"'));
  assert.deepEqual(Object.keys(pose).sort(), ['alvo', 'bancada', 'distancia', 'fov', 'giro', 'olhar']);
  assert.deepEqual(Object.keys(pose.bancada).sort(), ['frente', 'fundo', 'lados', 'some']);
  const q = enquadramento();
  assert.ok(conf.includes(`viewBox="${q.x.toFixed(1)} ${q.y.toFixed(1)} ${q.largura.toFixed(1)} ${q.altura.toFixed(1)}"`), 'a reserva fora do enquadramento da câmera');
  // a rodinha da reserva no ângulo de repouso: deslocada do meio e achatada (elipse)
  const rodinha = emblemaNaPose();
  assert.ok(conf.includes(`d="${rodinha.d}"`));
  assert.ok(rodinha.centro[0] > 60 + 10, `rodinha no meio: ${rodinha.centro[0]}`);
  assert.equal(emblemaNaPose(0).centro[0], 60, 'no giro zero, a rodinha fica de frente');
  // a bancada tem corpo: tampo da linha do fundo para a frente, e a linha na mesma altura
  const b = bancadaNaReserva();
  assert.ok(b.frente > b.linha + 20, JSON.stringify(b));
  assert.ok(conf.includes(`class="caramanhola-reserva__tampo" x="-400" y="${b.linha.toFixed(1)}"`));
  assert.ok(conf.includes(`y1="${b.linha.toFixed(1)}" y2="${b.linha.toFixed(1)}"`));
  // a cena lê a pose e a câmera da página e põe o tampo embaixo da sombra
  const cena = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', 'caramanhola-3d.js'), 'utf8');
  for (const trecho of ["getAttribute('data-3d-pose')", 'pose.distancia', 'pose.olhar', 'formas.plano(', 'chao: true', 'metal: 0.3, acende: 0.12']) assert.ok(cena.includes(trecho), trecho);
  // o motor tem a segunda janela, em pé, que só acende com brilho
  const motor = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', 'cena-3d.js'), 'utf8');
  assert.ok(motor.includes('janelaEmPe') && motor.includes('* uBrilho;'), 'sem a janela em pé');
  // fosco bem fosco
  assert.ok(conf.includes('data-brilho="0.08"'));
  // marca: o cubo da reserva com as duas abas, como no 3D
  assert.equal(abertura(ctx).split('class="roda-reserva__aba"').length - 1, 2);
});

test('arte 3: bancada que some no fundo, reserva pela câmera (pé, tampa em duas peças, faixa com friso) e roda de borracha', async () => {
  const { esc, palavras } = await import('../molde/_gerador/montar.mjs');
  const { default: abertura } = await import('../demos/3d/_gerador/secoes/abertura-3d.mjs');
  const { default: configurador } = await import('../demos/3d/_gerador/secoes/configurador-3d.mjs');
  const ctx = { esc, palavras, link: (r) => r, assets: 'assets/' };
  const conf = configurador(ctx);
  // o tampo e a linha somem para os lados e para a frente, na reserva e na cena
  for (const trecho of ['mask="url(#caramanhola-some-lados)"', 'mask="url(#caramanhola-some-frente)"']) assert.ok(conf.includes(trecho), trecho);
  const cena = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', 'caramanhola-3d.js'), 'utf8');
  assert.ok(cena.includes('some: [b.lados[0], b.lados[1], b.some[0], b.some[1]]') && cena.includes('some: [b.lados[0], b.lados[1], 0, 0]'));
  const motor = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', 'cena-3d.js'), 'utf8');
  assert.ok(motor.includes('uniform vec4 uSome;') && motor.includes('* a, a);'), 'o motor sem o sumir no fundo');
  // tampa em duas peças com a face de cima à vista; faixa como cinta com friso de sombra
  assert.equal(conf.split('class="caramanhola-reserva__tampa"').length - 1, 2);
  assert.equal(conf.split('class="caramanhola-reserva__tampa-topo"').length - 1, 2);
  assert.ok(conf.includes('class="caramanhola-reserva__friso"') && conf.includes('class="caramanhola-reserva__cinta"'));
  assert.ok(cena.includes('frisos') && cena.includes('cena.luz.borda = 0.55'));
  // a cor tem o nome da marca
  assert.ok(conf.includes('>Verde luz<') && !conf.includes('Verde faixa'));
  // no celular, o palco vai de borda a borda
  const css = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', '3d.css'), 'utf8');
  assert.ok(css.includes('margin-inline: calc(-1 * var(--margem));'));
  // marca: pneu de borracha (mais escuro que o aro), as duas faixas como no 3D, cubo de 64 lados
  const roda = fs.readFileSync(path.join(DEMO, 'site', 'assets', '3d', 'raio-3d.js'), 'utf8');
  assert.ok(roda.includes("[1, 1, 1], 0.06)") && roda.includes('{ cor: tinta, brilho: 0.06 }') && roda.includes('], 64), { cor: metal'));
  assert.equal(abertura(ctx).split('class="roda-reserva__faixa"').length - 1, 2);
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

  // as conferências precisam aprovar de fato (nenhum vermelho), não só terminar sem erro;
  // o medir reprova página que rola para o lado, então isto também cobre o celular de 390 px
  const acess = estudio('acessibilidade', 'demo');
  assert.equal(acess.codigo, 0, JSON.stringify(acess.json && acess.json.dados));
  assert.equal(acess.json.ok, true);
  assert.deepEqual(acess.json.dados.vermelhos, []);
  const med = estudio('medir', 'demo');
  assert.equal(med.codigo, 0, JSON.stringify(med.json && med.json.dados && med.json.dados.vermelhos));
  assert.equal(med.json.ok, true);
  assert.deepEqual(med.json.dados.vermelhos, []);
  assert.ok(med.json.dados.tamanhos.includes(390), JSON.stringify(med.json.dados.tamanhos));
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
    // o leitor de tela ouve a escolha uma vez só: pelo resumo; o palco tem um nome fixo
    assert.equal(await ler(`document.getElementById('caramanhola').getAttribute('aria-label')`), 'A caramanhola com a escolha feita');
    assert.equal(await ler(`document.querySelectorAll('.configurador [aria-live]').length`), 1);
    const href = await ler(`document.querySelector('[data-3d-pedido]').getAttribute('href')`);
    assert.ok(href.endsWith(encodeURIComponent(`Olá! Quero esta: ${resumo}`)), href);
    // a imagem de reserva acompanha a escolha só com CSS
    assert.equal(await ler(`getComputedStyle(document.querySelector('.configurador')).getPropertyValue('--esmalte').trim()`), '#1C46BF');
    assert.deepEqual(s.errosJs(), []);
  } finally {
    await s.fechar();
  }
});

// Conta os quadros da cena WebGL (o molde tem outros laços de quadro, de rolagem e de animação,
// que não interessam aqui): cada quadro do motor começa limpando a imagem (clear), uma vez só.
// Com a cena parada, a conta não sobe.
const CONTAR_QUADROS = "(() => { window.__quadros = 0; window.__primeiro = 0; window.__ultimo = 0; for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { if (!C) continue; const o = C.prototype.clear; C.prototype.clear = function (...a) { const t = performance.now(); if (!window.__quadros) window.__primeiro = t; window.__ultimo = t; window.__quadros += 1; return o.apply(this, a); }; } })();";
const quadros = (s) => s.tab.evaluate('window.__quadros');
// Espera por estado, não por relógio fixo (o CI no Windows desenha devagar, por software):
// "subir" espera ao menos n desenhos novos; "parar" espera a conta ficar parada por calmoMs.
async function quadrosSubirem(s, desde, n = 1, teto = 15000) {
  const fim = Date.now() + teto;
  while (Date.now() < fim) {
    if ((await quadros(s)) >= desde + n) return true;
    await esperar(50);
  }
  return false;
}
async function quadrosPararem(s, calmoMs = 1500, teto = 30000) {
  const fim = Date.now() + teto;
  let ultimo = await quadros(s);
  let desde = Date.now();
  while (Date.now() < fim) {
    await esperar(100);
    const agora = await quadros(s);
    if (agora !== ultimo) {
      ultimo = agora;
      desde = Date.now();
    } else if (Date.now() - desde >= calmoMs) return { parou: true, quadros: agora, em: desde };
  }
  return { parou: false, quadros: ultimo, em: desde };
}
const semRolarDeLado = (s) => s.tab.evaluate('document.documentElement.scrollWidth <= innerWidth');

test('quem chega devagar ao palco ainda vê o giro: ele conta do primeiro quadro com o palco à vista', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  const site = paginaLonge();
  const s = await abrirSessao(site, { tamanho: CELULAR });
  try {
    await s.tab.send('Page.addScriptToEvaluateOnNewDocument', { source: CONTAR_QUADROS });
    await s.ir(s.url('longe/'));
    // o palco a 150 px abaixo da tela: perto o bastante para a cena montar, mas fora da vista
    await s.tab.evaluate(`(() => { const p = document.getElementById('caramanhola'); window.scrollTo(0, p.getBoundingClientRect().top + scrollY - innerHeight - 150); })()`);
    assert.ok(await esperarEstado(s, 'pronta'), `ficou em ${await estado(s)}`);
    assert.equal(await s.tab.evaluate(`document.getElementById('caramanhola').getBoundingClientRect().top > innerHeight`), true, 'o palco já estava à vista');
    // a pessoa demora mais que o giro inteiro para chegar
    await esperar(6000);
    const a = await quadros(s);
    await irAoPalco(s);
    assert.ok(await quadrosSubirem(s, a, 3), 'chegou ao palco e a peça já estava parada: o giro contou de antes de aparecer');
    assert.ok((await quadrosPararem(s)).parou, 'a peça continua girando sozinha');
    assert.deepEqual(s.errosJs(), []);
  } finally {
    await s.fechar();
  }
});

test('a caramanhola gira sozinha só nos primeiros segundos; o mouse só pega a cena pronta; parar solta tudo', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  const s = await abrirSessao(path.join(base, 'demo', 'site'), { tamanho: CELULAR });
  try {
    await s.tab.send('Page.addScriptToEvaluateOnNewDocument', { source: CONTAR_QUADROS });
    await s.ir(s.url('index.html'));
    assert.equal(await semRolarDeLado(s), true, 'a página de abertura rola para o lado em 390 px');
    await s.ir(s.url('monte/'));
    assert.equal(await semRolarDeLado(s), true, 'a página do configurador rola para o lado em 390 px');
    const canvas = `document.querySelector('#caramanhola > canvas')`;
    await irAoPalco(s);
    assert.ok(await esperarEstado(s, 'pronta'), `ficou em ${await estado(s)}`);
    assert.equal(await s.tab.evaluate(`getComputedStyle(${canvas}).pointerEvents`), 'auto');
    // girando: logo depois de pronta, a peça segue desenhando (o giro conta do primeiro quadro à
    // vista, então a máquina lenta não perde o giro); o critério é haver desenhos novos, não quantos
    const a = await quadros(s);
    assert.ok(await quadrosSubirem(s, a, 3), 'a peça não está girando logo depois de abrir');
    // e para sozinha (WCAG 2.2.2: movimento que ninguém pediu acaba em até 5 s)
    const parada = await quadrosPararem(s);
    assert.ok(parada.parou, 'a peça continua girando sozinha');
    // girou por um tempo de verdade (não parou no primeiro quadro), e parou no prazo: o giro é de
    // 4,5 s contados do primeiro quadro à vista. Medido no relógio da própria página, do primeiro
    // ao último desenho, para não depender de quando o teste percebe que a cena ficou pronta.
    const girou = Math.round(await s.tab.evaluate('window.__ultimo - window.__primeiro'));
    assert.ok(girou >= 3000, `parou cedo demais: ${girou} ms`);
    assert.ok(girou <= 4500 + 3000, `parou tarde demais: ${girou} ms`);
    const b = parada.quadros;
    // uma escolha acorda a cena para a troca de cor, que acaba e dorme de novo
    await s.tab.evaluate(`(() => { const i = document.querySelector('input[name="cor"][value="azul"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    assert.ok(await quadrosSubirem(s, b, 1), 'a escolha não acordou a cena');
    assert.ok((await quadrosPararem(s)).parou, 'depois da troca, a cena não voltou a dormir');

    // parar: tira o canvas, volta a reserva e solta os ouvintes (escolher não pede mais quadro)
    await s.tab.evaluate(`window.Cena3D.cenaDo(document.getElementById('caramanhola')).parar()`);
    assert.equal(await s.tab.evaluate(`${canvas} === null`), true);
    assert.equal(await estado(s), 'reserva');
    assert.equal(await s.tab.evaluate(`document.getElementById('caramanhola').getAttribute('data-3d-motivo')`), 'parada');
    assert.equal(await s.tab.evaluate(`window.Cena3D.cenaDo(document.getElementById('caramanhola'))`), null);
    const d = await quadros(s);
    await s.tab.evaluate(`(() => { const i = document.querySelector('input[name="cor"][value="concreto"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); window.dispatchEvent(new Event('resize')); })()`);
    await esperar(800); // e a reserva termina de aparecer (transição de 0,5 s)
    assert.equal(await quadros(s), d, 'a cena parada ainda responde a escolhas');
    // a reserva volta inteira (a troca leva 0,5 s; com a máquina ocupada, pode levar mais)
    const opacidade = `getComputedStyle(document.querySelector('#caramanhola .palco-3d__reserva')).opacity`;
    const prazo = Date.now() + 5000;
    while (Date.now() < prazo && (await s.tab.evaluate(opacidade)) !== '1') await esperar(100);
    assert.equal(await s.tab.evaluate(opacidade), '1');
    assert.deepEqual(s.errosJs(), []);
  } finally {
    await s.fechar();
  }
});

test('falha no 3D não some calada: desenho que não compila e montagem que quebra no meio voltam à reserva e avisam', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  const site = path.join(base, 'demo', 'site');
  const casos = [
    {
      nome: 'desenho que não compila',
      injetar: '(() => { for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { if (!C) continue; const o = C.prototype.getShaderParameter; C.prototype.getShaderParameter = function (sh, p) { return p === this.COMPILE_STATUS ? false : o.call(this, sh, p); }; } })();',
      erro: 'Site Estúdio 3D: o desenho não compilou (caramanhola)',
    },
    {
      nome: 'montagem que quebra depois de criar a cena',
      injetar: "(() => { let guardado; Object.defineProperty(window, 'Cena3D', { configurable: true, get() { return guardado; }, set(v) { if (v && v.formas) v.formas.torno = () => { throw new Error('quebrou de propósito'); }; guardado = v; } }); })();",
      erro: 'Site Estúdio 3D: a cena "caramanhola" não abriu: quebrou de propósito',
    },
  ];
  for (const caso of casos) {
    const s = await abrirSessao(site, { tamanho: CELULAR });
    try {
      await s.tab.send('Page.addScriptToEvaluateOnNewDocument', { source: caso.injetar });
      await s.ir(s.url('monte/'));
      await irAoPalco(s);
      const fim = Date.now() + 15000;
      while (Date.now() < fim && (await s.tab.evaluate(`document.getElementById('caramanhola').getAttribute('data-3d-motivo')`)) !== 'falhou') await esperar(100);
      assert.equal(await estado(s), 'reserva', caso.nome);
      assert.equal(await s.tab.evaluate(`document.getElementById('caramanhola').getAttribute('data-3d-motivo')`), 'falhou', caso.nome);
      assert.equal(await s.tab.evaluate(`document.querySelector('#caramanhola > canvas') === null`), true, `${caso.nome}: o canvas ficou`);
      assert.ok(s.errosJs().some((e) => e.startsWith(`console.error: ${caso.erro}`)), `${caso.nome}: ${JSON.stringify(s.errosJs())}`);
      // as escolhas seguem funcionando sem o 3D
      await s.tab.evaluate(`(() => { const i = document.querySelector('input[name="cor"][value="azul"]'); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      assert.ok((await s.tab.evaluate(`document.querySelector('[data-3d-resumo]').textContent`)).includes('azul'), caso.nome);
    } finally {
      await s.fechar();
    }
  }
});

// Mede onde a rodinha gravada aparece (o meio, na horizontal) no palco: no 3D parado e na reserva.
async function meioDaRodinha(s, comReserva) {
  if (comReserva) await s.tab.evaluate(`(() => { const st = document.createElement('style'); st.textContent = '#caramanhola > canvas { opacity: 0 !important; transition: none !important } #caramanhola > .palco-3d__reserva { opacity: 1 !important; transition: none !important }'; document.head.appendChild(st); })()`);
  await esperar(150);
  const caixa = JSON.parse(await s.tab.evaluate(`JSON.stringify((() => { const p = document.getElementById('caramanhola').getBoundingClientRect(); const e = document.querySelector('.caramanhola-reserva__emblema').getBoundingClientRect(); return { x: p.left + scrollX, y: p.top + scrollY, w: p.width, h: p.height, ey0: e.top - p.top, ey1: e.bottom - p.top }; })())`));
  const img = await fotografarPng(s.tab, { x: caixa.x, y: caixa.y, width: caixa.w, height: caixa.h }, 1);
  // pixels claros (a rodinha clara) por dentro da peça grafite (entre o primeiro e o último pixel
  // escuro da linha: o fundo do palco também é claro), nas linhas da rodinha
  const cor = (x, y) => img.px[(y * img.w + x) * 4];
  let soma = 0;
  let n = 0;
  let pecaMeio = 0;
  let linhas = 0;
  const y0 = Math.max(0, Math.floor(caixa.ey0) + 2);
  const y1 = Math.min(img.h, Math.ceil(caixa.ey1) - 2);
  for (let y = y0; y < y1; y += 1) {
    let esq = -1;
    let dir = -1;
    for (let x = 0; x < img.w; x += 1) {
      if (cor(x, y) < 90) {
        if (esq < 0) esq = x;
        dir = x;
      }
    }
    if (esq < 0) continue;
    pecaMeio += (esq + dir) / 2;
    linhas += 1;
    for (let x = esq; x <= dir; x += 1) {
      if (cor(x, y) > 170) {
        soma += x;
        n += 1;
      }
    }
  }
  return { meio: n ? soma / n : null, n, peca: linhas ? pecaMeio / linhas : null, largura: img.w, img };
}

test('o giro do começo termina na pose da reserva: a rodinha no mesmo lugar no 3D parado e na reserva', opcoes, async () => {
  if (!fs.existsSync(path.join(base, 'demo'))) assert.equal(estudio('novo', 'demo', '--demo', '3d').codigo, 0);
  for (const tamanho of [CELULAR, { largura: 1440, altura: 900, movel: false }]) {
    const s = await abrirSessao(path.join(base, 'demo', 'site'), { tamanho });
    try {
      await s.tab.send('Page.addScriptToEvaluateOnNewDocument', { source: CONTAR_QUADROS });
      await s.ir(s.url('monte/'));
      await irAoPalco(s);
      assert.ok(await esperarEstado(s, 'pronta'), `ficou em ${await estado(s)}`);
      // o giro do começo acabou: a cena parou de desenhar (por estado, não por relógio fixo)
      assert.ok((await quadrosPararem(s)).parou, 'a peça não parou de girar');
      const no3d = await meioDaRodinha(s, false);
      const naReserva = await meioDaRodinha(s, true);
      assert.ok(no3d.n > 20 && naReserva.n > 20, `rodinha não achada: 3D ${no3d.n}, reserva ${naReserva.n}`);
      // longe do meio (a pose é de lado) e no mesmo lugar nos dois (tolerância: 3% da largura)
      assert.ok(no3d.meio > no3d.peca + 8, `rodinha do 3D no meio da peça: ${JSON.stringify(no3d)}`);
      assert.ok(Math.abs(no3d.meio - naReserva.meio) < no3d.largura * 0.03, `${tamanho.largura} px: 3D ${no3d.meio.toFixed(1)}, reserva ${naReserva.meio.toFixed(1)}`);
      // a bancada some no fundo: os cantos de baixo do palco têm a cor do fundo da página (nada de
      // retângulo cinza recortado), no 3D e na reserva
      for (const [qual, img] of [['3D', no3d.img], ['reserva', naReserva.img]]) {
        for (const x of [2, img.w - 3]) {
          const i = ((img.h - 3) * img.w + x) * 4;
          const cor = [img.px[i], img.px[i + 1], img.px[i + 2]];
          assert.ok(cor.every((v, k) => Math.abs(v - [236, 238, 234][k]) <= 6), `${tamanho.largura} px, ${qual}, canto ${x}: ${cor}`);
        }
      }
    } finally {
      await s.fechar();
    }
  }
});
