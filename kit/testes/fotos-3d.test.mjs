// Fotos de conferência com 3D: o navegador das conferências desenha WebGL (desenhista por software,
// igual no Mac, no Linux e no Windows, com ou sem placa de vídeo), a foto mostra a cena e não um
// quadro vazio, e o "prints" espera cada parte 3D abrir e acusa a que não abriu ou saiu lisa.
// Os testes de navegador pulam se não houver Chrome, Edge ou Chromium.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesDoNavegador } from './fixtures/navegador.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { argumentosDoNavegador, ARGS_3D, esperar } from '../scripts/lib/cdp.mjs';
import { abrirLeitor } from '../scripts/lib/leitor.mjs';
import { abrirSessao, ehLocal } from '../scripts/lib/sessao.mjs';
import { fotografarPng } from '../scripts/comandos/prints.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const opcoes = opcoesDoNavegador(240000);

// Cores conhecidas: fundo da página, fundo do desenho e a forma desenhada por cima.
const PAGINA = [255, 255, 255];
const FUNDO_3D = [28, 70, 191];
const FORMA = [212, 240, 79];
const perto = (px, cor, folga = 18) => Math.abs(px[0] - cor[0]) + Math.abs(px[1] - cor[1]) + Math.abs(px[2] - cor[2]) <= folga;

// Um triângulo em WebGL de verdade (sombreador compilado na hora), sobre o fundo azul.
function desenhoWebgl(id, atraso = 0) {
  return `(function () {
  var tela = document.getElementById('${id}');
  var palco = tela.parentNode;
  var gl = tela.getContext('webgl');
  window.__render = gl ? gl.getParameter(gl.RENDERER) : 'sem webgl';
  if (!gl) return;
  setTimeout(function () {
    function s(t, f) { var x = gl.createShader(t); gl.shaderSource(x, f); gl.compileShader(x); return x; }
    var p = gl.createProgram();
    gl.attachShader(p, s(gl.VERTEX_SHADER, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'));
    gl.attachShader(p, s(gl.FRAGMENT_SHADER, 'precision mediump float; void main() { gl_FragColor = vec4(${FORMA.map((c) => (c / 255).toFixed(4)).join(', ')}, 1.0); }'));
    gl.linkProgram(p);
    gl.useProgram(p);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(${FUNDO_3D.map((c) => (c / 255).toFixed(4)).join(', ')}, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (palco.hasAttribute('data-3d')) palco.setAttribute('data-3d-estado', 'pronta');
  }, ${atraso});
})();`;
}

let base;
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-3d-'));
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

test('o desenho 3D por software vem desligado; só a sessão das conferências liga, e o leitor de sites de fora nunca', async () => {
  const comum = { caminho: path.join('x', 'chrome'), porta: 9, perfil: 'p', largura: 10, altura: 10 };
  assert.deepEqual(ARGS_3D, ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']);
  const padrao = argumentosDoNavegador(comum);
  for (const a of ARGS_3D) assert.equal(padrao.includes(a), false, `ligado sem pedir: ${a}`);
  const com = argumentosDoNavegador({ ...comum, com3d: true });
  for (const a of ARGS_3D) assert.ok(com.includes(a), a);
  // o perfil guardado do login (Instagram) nunca leva o 3D por software junto
  const guardado = argumentosDoNavegador({ ...comum, guardado: true });
  for (const a of ARGS_3D) assert.equal(guardado.includes(a), false, `perfil guardado com ${a}`);
  // a sessão das conferências pede o desenho 3D
  const pedidosSessao = [];
  await assert.rejects(abrirSessao('/nao-importa', {}, {
    servir: async () => ({ origem: 'http://127.0.0.1:1', fechar: async () => {} }),
    launch: async (o) => {
      pedidosSessao.push(o);
      throw new Error('parou na sessão');
    },
    openTab: async () => null,
  }), { message: 'parou na sessão' });
  assert.equal(pedidosSessao[0].com3d, true);
  // o leitor abre sites da internet: pede o navegador sem o desenhista 3D
  const pedidos = [];
  await assert.rejects(abrirLeitor({
    launch: async (o) => {
      pedidos.push(o);
      return { porta: 1, close: () => {} };
    },
    openTab: async () => {
      throw new Error('parou aqui');
    },
  }, { perfil: path.join('x', 'perfil'), com3d: true }), { message: 'parou aqui' });
  // nem se pedirem: o leitor com o login do Instagram abre o perfil guardado, sem o 3D
  assert.equal(pedidos[0].com3d, false);
  assert.equal(pedidos[0].perfil, path.join('x', 'perfil'));
});

test('a sessão das conferências só deixa passar pedido para o próprio computador', () => {
  for (const u of ['http://127.0.0.1:4100/index.html', 'http://localhost:9/a.css', 'http://[::1]:8/x', 'data:text/plain,a', 'blob:http://127.0.0.1:1/abc', 'about:blank']) assert.equal(ehLocal(u), true, u);
  for (const u of ['https://example.com/a.js', 'http://192.0.2.1/x.png', 'http://127.0.0.1.example.com/', 'ws://127.0.0.1:1/', 'file:///etc/hosts', 'qualquer coisa']) assert.equal(ehLocal(u), false, u);
});

test('na sessão, recurso de fora é recusado antes de sair e console.error da página vira erro', opcoes, async () => {
  const pasta = path.join(base, 'fora');
  fs.mkdirSync(pasta);
  fs.writeFileSync(path.join(pasta, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fora</title></head>
<body><img src="http://192.0.2.1/foto.png" alt=""><script>console.error('Site Estúdio 3D: o desenho não compilou (teste)');</script></body></html>`);
  const sessao = await abrirSessao(pasta, { tamanho: { largura: 390, altura: 844, movel: true } });
  try {
    const pedidos = [];
    sessao.tab.on((m) => {
      if (m.method === 'Network.loadingFailed') pedidos.push(m.params.errorText);
    });
    const inicio = Date.now();
    await sessao.ir(sessao.url('index.html'));
    await esperar(300);
    // recusado na hora (BLOCKED_BY_CLIENT), sem esperar a rede, e ainda listado como endereço de fora
    assert.ok(Date.now() - inicio < 8000);
    assert.ok(pedidos.some((e) => e.includes('BLOCKED_BY_CLIENT')), JSON.stringify(pedidos));
    assert.deepEqual(sessao.rede().externos, ['http://192.0.2.1/foto.png']);
    assert.deepEqual(sessao.errosJs(), ['console.error: Site Estúdio 3D: o desenho não compilou (teste)']);
  } finally {
    await sessao.fechar();
  }
});

test('a foto de conferência mostra o desenho WebGL, mesmo fora da primeira tela', opcoes, async () => {
  const pasta = path.join(base, 'webgl');
  fs.mkdirSync(pasta);
  fs.writeFileSync(path.join(pasta, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>WebGL</title></head>
<body style="margin:0;background:#fff"><div style="height:1400px"></div>
<canvas id="c" width="200" height="120" style="display:block;width:200px;height:120px"></canvas><div style="height:600px"></div>
<script>${desenhoWebgl('c')}</script></body></html>`);
  const sessao = await abrirSessao(pasta, { tamanho: { largura: 390, altura: 844, movel: true } });
  try {
    await sessao.ir(sessao.url('index.html'));
    await esperar(400);
    const render = await sessao.tab.evaluate('window.__render');
    assert.notEqual(render, 'sem webgl', 'o navegador abriu sem WebGL');
    assert.deepEqual(sessao.errosJs(), []);
    const foto = await fotografarPng(sessao.tab, { x: 0, y: 1300, width: 390, height: 400 }, 1);
    const px = (x, y) => {
      const i = (y * foto.w + x) * 4;
      return [foto.px[i], foto.px[i + 1], foto.px[i + 2]];
    };
    // o canvas começa em y 100 da foto: o meio do triângulo, o canto do fundo azul e a página branca
    assert.ok(perto(px(100, 170), FORMA), `forma: ${px(100, 170)}`);
    assert.ok(perto(px(6, 106), FUNDO_3D), `fundo do desenho: ${px(6, 106)}`);
    assert.ok(perto(px(300, 170), PAGINA), `página: ${px(300, 170)}`);
    assert.ok(perto(px(100, 50), PAGINA), `acima do desenho: ${px(100, 50)}`);
  } finally {
    await sessao.fechar();
  }
});

test('prints espera cada parte 3D abrir, mesmo a que ainda não começou, e acusa a que não abriu, a lisa e a fora da foto', opcoes, async () => {
  const site = path.join(base, 'sites', 'cenas', 'site');
  fs.mkdirSync(site, { recursive: true });
  const palco = (nome, estado, conteudo) => `<div data-3d="${nome}" data-3d-estado="${estado}" style="position:relative;width:220px;height:140px;margin:40px">${conteudo}</div>`;
  const tela = (id) => `<canvas id="${id}" width="220" height="140" style="display:block;width:220px;height:140px"></canvas>`;
  fs.writeFileSync(path.join(site, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cenas</title></head>
<body style="margin:0;background:#fff">
${palco('boa', 'carregando', tela('boa'))}
<div style="height:900px;background:#eee"></div>
${palco('lenta', 'carregando', tela('lenta'))}
${palco('lisa', 'pronta', '')}
${palco('parada', 'reserva" data-3d-motivo="falhou', '<p>imagem parada</p>')}
${palco('tarde', 'reserva', tela('tarde'))}
<div data-3d="escondida" data-3d-estado="pronta" style="width:0;height:0;overflow:hidden"></div>
<script>${desenhoWebgl('boa')}${desenhoWebgl('lenta', 1500)}${desenhoWebgl('tarde', 1200)}</script>
</body></html>`);
  const env = { ...process.env, ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_NAO_ABRIR: '1' };
  const rodar = (...extra) => {
    const r = spawnSync(process.execPath, [DESPACHANTE, 'prints', 'cenas', '--tamanhos', '390', '--sem-secoes', ...extra], { encoding: 'utf8', env, timeout: 200000 });
    const linhas = (r.stdout || '').trim().split('\n');
    return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
  };
  const r = rodar();
  assert.equal(r.codigo, 0, JSON.stringify(r.json));
  const estados = Object.fromEntries(r.json.dados.cenas3d.map((c) => [c.cena, c.estado]));
  // a "lenta" fica pronta 1,5 s depois de aparecer, e a "tarde" nem passa por "carregando": a foto esperou as duas
  assert.deepEqual(estados, { boa: 'pronta', lenta: 'pronta', lisa: 'pronta', parada: 'reserva', tarde: 'pronta', escondida: 'fora-da-foto' });
  assert.equal(r.json.dados.cenas3d.find((c) => c.cena === 'parada').motivo, 'falhou');
  const avisos3d = r.json.avisos.filter((a) => a.codigo.startsWith('CENA_3D_')).map((a) => `${a.codigo} ${a.dados.cena}`).sort();
  assert.deepEqual(avisos3d, ['CENA_3D_FORA_DA_FOTO escondida', 'CENA_3D_NAO_ABRIU parada', 'CENA_3D_VAZIA lisa']);
  const boa = r.json.dados.cenas3d.find((c) => c.cena === 'boa');
  assert.ok(boa.uniforme < 0.9, `a cena boa saiu lisa: ${boa.uniforme}`);

  // com "reduzir movimento", a imagem parada é o certo: não acusa a que ficou na reserva
  const reduzido = rodar('--reduzido', '--rodada', '2');
  assert.equal(reduzido.codigo, 0, JSON.stringify(reduzido.json));
  const avisosReduzido = reduzido.json.avisos.filter((a) => a.codigo.startsWith('CENA_3D_')).map((a) => `${a.codigo} ${a.dados.cena}`).sort();
  assert.deepEqual(avisosReduzido, ['CENA_3D_FORA_DA_FOTO escondida', 'CENA_3D_VAZIA lisa']);
});
