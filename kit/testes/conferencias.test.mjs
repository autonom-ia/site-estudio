// Conferências da revisão mais curta (v1.1), no Chrome: fotos sem buraco e sem parte presa no meio,
// nenhum alarme falso para texto só de leitor de tela e faixa decorativa, e as 4 conferências
// novas (foto esticada, link e frase repetidos, foco perdido depois do menu, linha longa no
// tablet). Pula se não houver navegador (menos o de um "prints" por vez, que não abre o navegador).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { crc32 } from '../scripts/lib/zip.mjs';
import { abrirSessao, visitar } from '../scripts/lib/sessao.mjs';
import { TAMANHOS } from '../scripts/lib/site.mjs';
import { secoes } from '../scripts/lib/pagina.mjs';
import { prenderParaFoto } from '../scripts/lib/pagina-fotos.mjs';
import { decodePng } from '../scripts/lib/png.mjs';
import { FONTE_DE_EXEMPLO } from '../scripts/lib/fatos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const GSAP = path.join(RAIZ, 'kit', 'molde', 'site', 'assets', 'vendor', 'gsap');
const opcoes = { skip: acharNavegador() ? false : 'sem Chrome, Edge ou Chromium nesta máquina', timeout: 300000 };

let base;
let env;
function estudio(...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env, timeout: 280000 });
  const linhas = (r.stdout || '').trim().split('\n');
  return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-conf-'));
  env = { ...process.env, ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem-marca'), ESTUDIO_NAO_ABRIR: '1' };
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

// PNG de uma cor só, w×h, sem biblioteca.
function png(w, h, [r, g, b]) {
  const pedaco = (tipo, dados) => {
    const t = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(t) >>> 0);
    return Buffer.concat([tam, t, crc]);
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(w, 0);
  cab.writeUInt32BE(h, 4);
  cab[8] = 8;
  cab[9] = 2;
  const linha = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x += 1) linha.set([r, g, b], 1 + x * 3);
  const cru = Buffer.concat(Array.from({ length: h }, () => linha));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', cab), pedaco('IDAT', zlib.deflateSync(cru)), pedaco('IEND', Buffer.alloc(0))]);
}

// Linhas (y) de uma foto onde a coluna x = 5 tem a cor pedida (cada canal perto de 0 ou 255).
function linhasDaCor(img, cor) {
  const ys = [];
  for (let y = 0; y < img.h; y += 1) {
    const i = (y * img.w + 5) * 4;
    const k = [img.px[i], img.px[i + 1], img.px[i + 2]].map((v) => (v > 128 ? 1 : 0)).join('');
    if (k === cor) ys.push(y);
  }
  return ys;
}

// Cabeçalho preso vermelho, seção presa com ScrollTrigger (pin), coluna "sticky" amarela, barra
// "fixed" magenta no pé da tela e um pedido de refresh do ScrollTrigger no meio da rolagem (o que
// devolvia a página ao fim da rolagem depois do "volta ao topo").
const PRESOS = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>presos</title>
<style>body{margin:0} header{position:sticky;top:0;height:80px;background:#f00;z-index:9}
section{height:1200px;background:#00f;position:relative} #c{background:#0f0}
.col{position:sticky;top:100px;height:200px;background:#ff0;width:200px}
.barra{position:fixed;bottom:0;left:0;right:0;height:60px;background:#f0f} .x{width:100px;height:100px;background:#fff}</style>
</head><body><header></header><main>
<section id="a" data-secao="a"></section><section id="p" data-secao="p" style="background:#000"><div class="x"></div></section>
<section id="b" data-secao="b"></section><section id="c" data-secao="c"><div class="col"></div></section>
</main><div class="barra"></div>
<script src="gsap.min.js"></script><script src="ScrollTrigger.min.js"></script>
<script>gsap.registerPlugin(ScrollTrigger);
gsap.to('.x', { x: 200, scrollTrigger: { trigger: '#p', pin: true, start: 'top top', end: '+=150%', scrub: true } });
addEventListener('scroll', function () { if (scrollY > 1500 && !window.__pedido) { window.__pedido = true; ScrollTrigger.refresh(); } });
</script></body></html>`;

test('fotos de conferência: página no topo, sem buraco de seção presa e sem parte presa no meio', opcoes, async () => {
  const pasta = path.join(base, 'presos');
  fs.mkdirSync(pasta);
  fs.writeFileSync(path.join(pasta, 'index.html'), PRESOS);
  for (const f of ['gsap.min.js', 'ScrollTrigger.min.js']) fs.copyFileSync(path.join(GSAP, f), path.join(pasta, f));
  const sessao = await abrirSessao(pasta);
  try {
    for (const t of TAMANHOS.slice(0, 3)) {
      const doc = await visitar(sessao, { rel: 'index.html', url: '' }, t);
      assert.equal(doc.topo, true, `${t.largura}: a página não voltou ao topo`);
      assert.equal(await sessao.tab.evaluate('scrollY'), 0, `${t.largura}: rolada`);
      assert.equal(await sessao.tab.evaluate('document.querySelectorAll(".pin-spacer").length'), 0, `${t.largura}: espaçador do pin`);
      await sessao.avaliar(prenderParaFoto);
      const partes = await sessao.avaliar(secoes);
      // sem buraco: cada parte começa onde a anterior termina
      for (let k = 1; k < partes.length; k += 1) assert.ok(Math.abs(partes[k].y - (partes[k - 1].y + partes[k - 1].altura)) <= 1, `${t.largura}: buraco antes de ${partes[k].nome}`);
      for (const s of partes) {
        const r = await sessao.tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: s.y, width: t.largura, height: s.altura, scale: 1 } });
        const img = decodePng(Buffer.from(r.data, 'base64'));
        const vermelho = linhasDaCor(img, '100');
        const magenta = linhasDaCor(img, '101');
        if (s.nome === 'header') assert.equal(vermelho.length, 80, `${t.largura}: cabeçalho`);
        else assert.equal(vermelho.length, 0, `${t.largura}: cabeçalho preso no meio de ${s.nome}`);
        // a barra presa só aparece na primeira tela (onde a pessoa a vê ao abrir)
        for (const y of magenta) assert.ok(s.y + y < t.altura, `${t.largura}: barra presa em ${s.nome}, y ${s.y + y}`);
        if (s.nome === 'c') assert.deepEqual([linhasDaCor(img, '110')[0], linhasDaCor(img, '110').length], [0, 200], `${t.largura}: coluna presa fora do lugar`);
      }
    }
  } finally {
    await sessao.fechar();
  }
});

// Boa prática que não pode virar alarme: título com texto só para leitor de tela (recorte de 1 px,
// sem quebra de linha, mais largo que a tela) e faixa decorativa com aria-hidden que vaza a tela.
const ESCONDIDOS = `export default function escondidos() {
  return \`<section class="escondidos" data-secao="escondidos" style="padding:4rem 1.5rem;position:relative">
  <h2 style="font-size:28px"><span style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">Texto só para quem usa leitor de tela, comprido o bastante para passar da borda da tela</span>Parte visível</h2>
  <div style="overflow:hidden"><p aria-hidden="true" style="white-space:nowrap;font-size:64px;line-height:1.2;margin:0">Faixa decorativa que vaza a tela de propósito de um lado ao outro</p></div>
</section>\`;
}
`;

// As 4 conferências novas: foto pequena esticada, link e frase repetidos, parágrafo largo demais
// no tablet e um script que rola até a parte sem levar o foco junto.
const ESTRAGOS = `export default function estragos({ assets }) {
  const longo = 'Este parágrafo ocupa a largura inteira da tela, do jeito que o celular esticado deixa no tablet, e por isso cada linha fica longa demais para ler com conforto. '.repeat(3);
  return \`<section class="estragos" data-secao="estragos" style="padding:4rem 1.5rem">
  <img src="\${assets}img/pequena.png" alt="Foto pequena esticada" width="40" height="30" style="width:100%;height:auto">
  <p style="max-width:none;font-size:15px;line-height:1.5">\${longo}</p>
  <p><a href="#visita">Ver o endereço</a></p><p><a href="#visita">Ver o endereço</a></p>
  <p><a href="#visita">Ver o endereço</a></p><p><a href="#visita">Ver o endereço</a></p>
  <p>Uma frase dita de novo e de novo.</p><p>Uma frase dita de novo e de novo.</p><p>Uma frase dita de novo e de novo.</p>
  <script>document.addEventListener('click', function (e) {
    var a = e.target.closest('header a[href*="#"]');
    var alvo = a && document.getElementById(a.hash.slice(1));
    if (!alvo) return;
    e.preventDefault();
    window.scrollTo({ top: alvo.getBoundingClientRect().top + scrollY, behavior: 'instant' });
  }, true);</script>
</section>\`;
}
`;

function semAtributo(texto, nome) {
  let saida = texto;
  const marca = ` ${nome}="`;
  let i = saida.indexOf(marca);
  while (i !== -1) {
    saida = saida.slice(0, i) + saida.slice(saida.indexOf('"', i + marca.length) + 1);
    i = saida.indexOf(marca);
  }
  return saida;
}

test('conferências novas acham o que a revisão achava, sem alarme para leitor de tela e faixa decorativa', opcoes, () => {
  assert.equal(estudio('novo', 'conferencias').codigo, 0);
  const pasta = path.join(base, 'conferencias');
  const gerador = path.join(pasta, '_gerador');
  for (const arq of fs.readdirSync(path.join(gerador, 'secoes'))) {
    const c = path.join(gerador, 'secoes', arq);
    fs.writeFileSync(c, semAtributo(fs.readFileSync(c, 'utf8'), 'data-molde'));
  }
  fs.writeFileSync(path.join(gerador, 'secoes', 'escondidos.mjs'), ESCONDIDOS);
  fs.writeFileSync(path.join(gerador, 'secoes', 'estragos.mjs'), ESTRAGOS);
  const ordem = path.join(gerador, 'ordem.mjs');
  const textoDaOrdem = fs.readFileSync(ordem, 'utf8');
  // Se o molde mudar e o alvo sumir, o teste para aqui, em vez de seguir sem as seções injetadas.
  for (const alvo of ['  molde: true,\n', "'servicos', 'pico'"]) assert.ok(textoDaOrdem.includes(alvo), `ordem.mjs do molde sem ${alvo}`);
  fs.writeFileSync(ordem, textoDaOrdem.replace('  molde: true,\n', '').replace("'servicos', 'pico'", "'escondidos', 'servicos', 'estragos', 'pico'"));
  const fatos = path.join(pasta, 'fatos.md');
  fs.writeFileSync(fatos, fs.readFileSync(fatos, 'utf8').replaceAll(FONTE_DE_EXEMPLO, 'Teste automatizado do estúdio'));
  fs.writeFileSync(path.join(pasta, 'site', 'assets', 'img', 'pequena.png'), png(40, 30, [200, 120, 60]));
  assert.equal(estudio('montar', 'conferencias').codigo, 0);

  const md = estudio('medir', 'conferencias', '--tamanhos', '390,768');
  const tudo = [...md.json.dados.vermelhos, ...md.json.dados.amarelos];
  assert.deepEqual(tudo.filter((v) => v.tipo === 'texto-cortado'), [], 'leitor de tela ou faixa decorativa viraram alarme');
  assert.ok(md.json.dados.amarelos.some((v) => v.tipo === 'foto-esticada' && v.detalhe.startsWith('pequena.png tem 40x30 px')), 'foto esticada');
  const longas = md.json.dados.amarelos.filter((v) => v.tipo === 'linha-longa').map((v) => v.largura);
  assert.deepEqual(longas, [768], 'linha longa só no tablet');

  const ck = estudio('checar', 'conferencias');
  assert.equal(ck.codigo, 0, JSON.stringify(ck.json.dados.vermelhos));
  const am = ck.json.dados.amarelos;
  assert.ok(am.some((v) => v.tipo === 'link-repetido' && v.detalhe.includes('"Ver o endereço" aparece 4 vezes')), JSON.stringify(am));
  assert.ok(am.some((v) => v.tipo === 'frase-repetida' && v.detalhe.includes('aparece 3 vezes')), JSON.stringify(am));
  assert.ok(!am.some((v) => v.tipo === 'link-repetido' && v.detalhe.includes('Onde fica')), 'o link que o menu e o rodapé repetem (2 vezes) fica abaixo do limite de 4');

  const ax = estudio('acessibilidade', 'conferencias', '--tamanhos', '768');
  assert.equal(ax.codigo, 2, JSON.stringify(ax.json.dados));
  const foco = ax.json.dados.vermelhos.find((v) => v.regra === 'foco-perdido');
  assert.ok(foco, JSON.stringify(ax.json.dados.vermelhos));
  assert.equal(foco.largura, 768);
  assert.ok(foco.nos[0].resumo.includes('#visita'), foco.nos[0].resumo);
});

test('prints: um por vez na mesma pasta; o segundo recebe PRINTS_EM_ANDAMENTO e não apaga nada', () => {
  assert.equal(estudio('novo', 'fila').codigo, 0);
  const pasta = path.join(base, 'fila', 'revisao', 'prints-r1');
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'inicio-390-inteira.jpg'), 'foto do outro prints');
  // a trava é de um processo vivo (este): outro "prints" está fotografando a rodada 1
  fs.writeFileSync(`${pasta}.trava`, String(process.pid));
  const r = estudio('prints', 'fila', '--rodada', '1');
  assert.equal(r.codigo, 1);
  assert.equal(r.json.codigo, 'PRINTS_EM_ANDAMENTO');
  assert.equal(r.json.dados.rodada, 1);
  assert.ok(fs.existsSync(path.join(pasta, 'inicio-390-inteira.jpg')), 'apagou a foto do outro');
  assert.ok(fs.existsSync(`${pasta}.trava`), 'tirou a trava do outro');
});
