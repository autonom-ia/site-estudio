// Contraste na borda da tela: quando o centro de um texto cai a menos de 1 px da borda num passo da
// rolagem, o navegador não devolve elemento nenhum naquele ponto. Isso não é "outro elemento por
// cima": o medidor mede o texto noutra posição. Pula se não houver navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { abrirSessao, visitar } from '../scripts/lib/sessao.mjs';
import { medir } from '../scripts/lib/pagina.mjs';
import { LIMITES } from '../scripts/comandos/medir.mjs';
import { TAMANHOS } from '../scripts/lib/site.mjs';

const opcoes = { skip: acharNavegador() ? false : 'sem Chrome, Edge ou Chromium nesta máquina', timeout: 120000 };
const CELULAR = TAMANHOS.find((t) => t.nome === 'celular');

// O rótulo é posto de modo que o centro da caixa do texto fique 0,2 px acima do pé da tela, na
// rolagem do topo. Fundo e texto lisos: no passo seguinte da rolagem o contraste é medido.
const PAGINA = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Borda</title><style>html,body{margin:0;background:#fffdf8;color:#1b1b1b}p{margin:0}</style></head>
<body>
<p id="borda" style="position:absolute;top:600px;left:20px;font-size:20px;line-height:20px">Para que dia</p>
<div style="height:3000px"></div>
<script>
(function () {
  var p = document.getElementById('borda');
  var r = document.createRange();
  r.selectNodeContents(p.firstChild);
  var q = r.getClientRects()[0];
  p.style.top = (600 + (innerHeight - 0.2 - (q.top + q.bottom) / 2)) + 'px';
})();
</script>
</body></html>
`;

test('medir: texto com o centro a 0,2 px da borda da tela não vira "outro elemento por cima"', opcoes, async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-borda-'));
  fs.writeFileSync(path.join(pasta, 'index.html'), PAGINA);
  const sessao = await abrirSessao(pasta);
  try {
    await visitar(sessao, { rel: 'index.html' }, CELULAR);
    const ponto = await sessao.avaliar(() => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('borda').firstChild);
      const q = r.getClientRects()[0];
      const y = (q.top + q.bottom) / 2;
      return { folga: innerHeight - y, pilha: document.elementsFromPoint((q.left + q.right) / 2, y).length };
    });
    // o caso do piloto: o centro está dentro da tela, mas o navegador não devolve nada ali
    assert.ok(ponto.folga > 0 && ponto.folga < 1, JSON.stringify(ponto));
    assert.equal(ponto.pilha, 0, 'o navegador devolveria algo na borda: o teste não reproduz o caso');

    const m = await sessao.avaliar(medir, { ...LIMITES, movel: true });
    assert.deepEqual(m.warn.filter((w) => w.tipo === 'contraste-nao-medido'), []);
    assert.deepEqual(m.red, []);
    assert.equal(m.contraste_medido, 1, 'o rótulo foi medido noutra posição da rolagem');
    assert.equal(m.contraste_sem_medir, 0);
    // quem chama sem o limite (borda_da_tela) mede com 1 px, e o resultado é o mesmo
    const { borda_da_tela: _borda, ...semBorda } = LIMITES;
    const padrao = await sessao.avaliar(medir, { ...semBorda, movel: true });
    assert.deepEqual(padrao.warn.filter((w) => w.tipo === 'contraste-nao-medido'), []);
    assert.equal(padrao.contraste_medido, 1);
  } finally {
    await sessao.fechar();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
