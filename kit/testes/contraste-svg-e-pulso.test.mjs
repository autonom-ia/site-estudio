// Consertos da medida trazidos do View Estúdio 1.2, no Chrome:
// - texto dentro de desenho (SVG) entra na medida de contraste, pintado pelo fill, e a forma do
//   próprio desenho atrás dele conta como fundo (selo com letra branca sobre retângulo escuro passa);
//   degradê vira contraste-nao-medido;
// - animação sem fim (pulso de cor no CSS, brilho no GSAP) vai ao instante zero antes da medida, então
//   duas rodadas medem a mesma cor em qualquer hora.
// Pula se não houver navegador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesDoNavegador } from './fixtures/navegador.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirSessao, visitar } from '../scripts/lib/sessao.mjs';
import { TAMANHOS } from '../scripts/lib/site.mjs';
import { medir } from '../scripts/lib/pagina.mjs';
import { LIMITES } from '../scripts/comandos/medir.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GSAP = path.join(RAIZ, 'kit', 'molde', 'site', 'assets', 'vendor', 'gsap', 'gsap.min.js');
const opcoes = opcoesDoNavegador(240000);

const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste</title>
<style>
  body { margin: 0; background: #ffffff; font: 20px/1.5 sans-serif; color: #111111; }
  section { padding: 40px; }
  @keyframes pulso { 0% { color: #111111; } 50% { color: #f4f4f4; } 100% { color: #111111; } }
  #pulso { animation: pulso 2s linear infinite; }
</style></head><body>
<section>
  <svg width="320" height="80" viewBox="0 0 320 80" role="img" aria-label="Selo">
    <rect x="0" y="0" width="320" height="80" fill="#111111"/>
    <text id="selo" x="20" y="50" font-size="24" fill="#ffffff">Selo legível</text>
  </svg>
</section>
<section>
  <svg width="320" height="80" viewBox="0 0 320 80" role="img" aria-label="Claro">
    <text id="claro" x="20" y="50" font-size="16" fill="#dddddd">Texto claro demais</text>
  </svg>
</section>
<section>
  <svg width="320" height="80" viewBox="0 0 320 80" role="img" aria-label="Degradê">
    <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#888"/></linearGradient></defs>
    <text id="degrade" x="20" y="50" font-size="16" fill="url(#g)">Texto com degradê</text>
  </svg>
</section>
<section><p id="pulso">Pulso de cor que começa escuro</p><p id="brilho">Brilho do GSAP que começa escuro</p></section>
<script src="gsap.min.js"></script>
<script>gsap.fromTo('#brilho', { color: '#111111' }, { color: '#f4f4f4', duration: 1, repeat: -1, yoyo: true });</script>
</body></html>`;

let pasta;
before(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-svg-pulso-'));
  fs.writeFileSync(path.join(pasta, 'index.html'), PAGINA);
  fs.copyFileSync(GSAP, path.join(pasta, 'gsap.min.js'));
});
after(() => fs.rmSync(pasta, { recursive: true, force: true }));

test('contraste: texto de SVG medido pelo fill, forma do desenho como fundo, degradê avisado; pulso no instante zero', opcoes, async () => {
  const notebook = TAMANHOS.find((t) => t.nome === 'notebook');
  const sessao = await abrirSessao(pasta);
  try {
    const rodadas = [];
    for (let vez = 0; vez < 2; vez += 1) {
      await visitar(sessao, { rel: 'index.html', url: '' }, notebook);
      const cores = await sessao.tab.evaluate('JSON.stringify([getComputedStyle(document.getElementById("pulso")).color, getComputedStyle(document.getElementById("brilho")).color])');
      const m = await sessao.avaliar(medir, { ...LIMITES, movel: false });
      rodadas.push({ cores: JSON.parse(cores), m });
      // a próxima rodada começa em outra fase do relógio
      await new Promise((r) => setTimeout(r, 700));
    }
    for (const { cores, m } of rodadas) {
      assert.deepEqual(cores, ['rgb(17, 17, 17)', 'rgb(17, 17, 17)'], 'a animação sem fim parou no instante zero');
      const contraste = m.red.filter((v) => v.tipo === 'contraste').map((v) => v.detalhe);
      assert.equal(contraste.length, 1, JSON.stringify(contraste));
      assert.ok(contraste[0].includes('Texto claro demais'), contraste[0]);
      assert.ok(!contraste.some((d) => d.includes('Selo legível')), 'o retângulo do selo é o fundo');
      assert.ok(m.warn.some((v) => v.tipo === 'contraste-nao-medido' && v.detalhe.includes('Texto com degradê')), JSON.stringify(m.warn));
    }
    assert.deepEqual(rodadas[0].m.red, rodadas[1].m.red, 'duas rodadas, a mesma medida');
  } finally {
    await sessao.fechar();
  }
});
