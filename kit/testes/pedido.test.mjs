// A peça de pedido (kit/pecas/pedido.js), que o assistente copia para o site quando a ação principal
// é um pedido montado na página e enviado pelo WhatsApp. Um piloto achou três defeitos nesse tipo de
// pedido escrito à mão: a mensagem pronta vazia ("Quero:" solto), uma palavra repetida ("Quero"
// duas vezes) e o leitor de tela falando a mensagem a cada letra digitada (aria-live no resumo).
// Aqui: a mensagem nunca sai vazia, a peça não escreve palavra própria (nada se repete por conta
// dela), nada vem marcado, e o anúncio só sai quando a pessoa termina um campo.
// A parte com navegador pula se não houver Chrome, Edge ou Chromium.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { abrirSessao, visitar } from '../scripts/lib/sessao.mjs';
import { TAMANHOS } from '../scripts/lib/site.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PECA = path.join(RAIZ, 'kit', 'pecas', 'pedido.js');
const CODIGO = fs.readFileSync(PECA, 'utf8');

function carregarPeca() {
  const contexto = vm.createContext({ Intl, encodeURIComponent, Number, String });
  vm.runInContext(CODIGO, contexto);
  return contexto.SitePedido;
}

// Palavras de um texto, sem pontuação nas pontas e em minúsculas (sem expressão regular).
const PONTUACAO = '.,;:!?()-';
function palavras(texto) {
  const lista = [];
  for (const bruta of texto.split('\n').join(' ').split(' ')) {
    let p = bruta.toLowerCase();
    while (p && PONTUACAO.includes(p[0])) p = p.slice(1);
    while (p && PONTUACAO.includes(p[p.length - 1])) p = p.slice(0, -1);
    if (p) lista.push(p);
  }
  return lista;
}
const contar = (lista) => lista.reduce((m, p) => m.set(p, (m.get(p) || 0) + 1), new Map());

const ABERTURA = 'Olá! Quero encomendar na Oficina Raio.';

test('pedido: sem nada escolhido, a mensagem é a abertura inteira; nunca vazia nem terminada em dois-pontos', () => {
  const { montarMensagem, ABERTURA_PADRAO } = carregarPeca();
  assert.equal(montarMensagem(ABERTURA, [], []), ABERTURA);
  // o caso do piloto: a abertura escrita com dois-pontos à espera do resto
  assert.equal(montarMensagem('Olá! Quero fazer uma encomenda: ', [], []), 'Olá! Quero fazer uma encomenda');
  for (const vazia of ['', '   ', undefined, null, ':']) assert.equal(montarMensagem(vazia, [], []), ABERTURA_PADRAO);
  // campo vazio, item desmarcado ou com zero não viram linha solta
  const nada = montarMensagem(ABERTURA, [{ nome: 'Câmara de ar', quantidade: 0 }, { nome: '  ' }], [{ rotulo: 'Recado', valor: '  ' }, { rotulo: 'Para o dia', valor: '' }]);
  assert.equal(nada, ABERTURA);
  assert.ok(!nada.trim().endsWith(':'));
});

test('pedido: só o dia preenchido sai "Para o dia: 25/12/2026", sem "Quero:" e sem "Quero" repetido', () => {
  const { montarMensagem, formatarDia } = carregarPeca();
  const m = montarMensagem(ABERTURA, [], [{ rotulo: 'Para o dia', valor: formatarDia('2026-12-25') }]);
  assert.equal(m, `${ABERTURA}\nPara o dia: 25/12/2026`);
  assert.equal(contar(palavras(m)).get('quero'), 1);
  assert.ok(!m.includes('Quero:'));
  assert.equal(formatarDia('25/12'), '25/12', 'texto que não é data do campo fica como veio');
});

test('pedido: itens, quantidade, preço e total; a peça não escreve palavra que a parte não deu', () => {
  const { montarMensagem, linkDoWhatsapp } = carregarPeca();
  const itens = [
    { nome: 'Câmara de ar aro 29', quantidade: 2, preco: 35 },
    { nome: 'Revisão completa', preco: 180 },
    { nome: 'Fita de guidão' },
  ];
  const campos = [{ rotulo: 'Para o dia:', valor: '25/12/2026' }, { rotulo: 'Entrega', valor: 'Retirar na loja' }];
  const m = montarMensagem(ABERTURA, itens, campos);
  const linhas = m.split('\n');
  assert.equal(linhas[0], ABERTURA);
  assert.equal(linhas[1], '- Câmara de ar aro 29: 2 (R$ 70,00)');
  assert.equal(linhas[2], '- Revisão completa (R$ 180,00)');
  assert.equal(linhas[3], '- Fita de guidão');
  assert.equal(linhas[4], 'Total: R$ 250,00');
  assert.equal(linhas[5], 'Para o dia: 25/12/2026', 'um dois-pontos só, mesmo com o rótulo escrito com ele');
  assert.equal(linhas[6], 'Entrega: Retirar na loja');
  // cada palavra da mensagem veio da abertura, de um item, de um rótulo ou de um valor (mais "total")
  const dadas = contar(palavras([ABERTURA, ...itens.map((i) => i.nome), ...campos.map((c) => `${c.rotulo} ${c.valor}`)].join(' ')));
  for (const [p, n] of contar(palavras(m))) {
    if (p === 'total' || p.startsWith('r$') || p.includes(',00') || p === '2') continue;
    assert.ok(dadas.has(p), `a peça escreveu "${p}" por conta própria`);
    assert.ok(n <= dadas.get(p), `"${p}" aparece ${n} vezes na mensagem e só ${dadas.get(p)} no que a parte deu`);
  }
  // o link leva a mensagem inteira, codificada, ao número só com dígitos
  const link = linkDoWhatsapp('+55 (11) 90000-0000', m);
  assert.ok(link.startsWith('https://wa.me/5511900000000?text='), link);
  assert.equal(decodeURIComponent(link.split('?text=')[1]), m);
});

test('pedido: a peça não marca opção nenhuma e manda o resumo visível ficar fora de região viva', () => {
  assert.ok(!CODIGO.includes('.checked =') && !CODIGO.includes(".checked=") && !CODIGO.includes("setAttribute('checked'"), 'a peça marca opção sozinha');
  assert.ok(!CODIGO.includes("'aria-live'"), 'a peça põe região viva no resumo');
  assert.ok(CODIGO.includes('Nunca é região viva (sem aria-live)'));
  assert.ok(CODIGO.includes('opção marcada por padrão só com um fato com fonte'));
});

// No navegador: a pessoa digita letra por letra; o resumo visível e o link acompanham, mas o anúncio
// do leitor de tela só muda quando ela termina o campo (change). Sem nada escolhido, o link já vai
// com a abertura.
const PAGINA = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido</title></head><body>
<section>
  <form data-pedido data-whatsapp="5511900000000" data-mensagem="${ABERTURA}">
    <fieldset><legend>O que dá para pedir</legend>
      <label><input type="checkbox" data-item="Câmara de ar aro 29"> Câmara de ar aro 29</label>
      <label><input type="checkbox" data-item="Revisão completa"> Revisão completa</label>
      <label for="fitas">Fitas de guidão</label> <input id="fitas" type="number" min="0" value="0" data-item="Fita de guidão">
      <button type="button" data-mais="fitas">Mais uma fita de guidão</button>
    </fieldset>
    <label for="dia">Para o dia</label> <input id="dia" type="date" data-campo="Para o dia">
    <label for="recado">Recado</label> <input id="recado" type="text" data-campo="Recado">
  </form>
  <p data-pedido-mensagem>${ABERTURA}</p>
  <p data-pedido-aviso role="status"></p>
  <a data-pedido-enviar href="https://wa.me/5511900000000?text=${encodeURIComponent(ABERTURA)}">Enviar pelo WhatsApp</a>
</section>
<script src="assets/js/pedido.js" defer></script>
</body></html>
`;

const opcoes = { skip: acharNavegador() ? false : 'sem Chrome, Edge ou Chromium nesta máquina', timeout: 120000 };

test('pedido no navegador: digitar não fala a cada letra; terminar o campo fala a mensagem pronta uma vez', opcoes, async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-pedido-'));
  fs.writeFileSync(path.join(pasta, 'index.html'), PAGINA);
  // como no site: a peça copiada para assets/js/ e carregada no fim da parte
  fs.mkdirSync(path.join(pasta, 'assets', 'js'), { recursive: true });
  fs.copyFileSync(PECA, path.join(pasta, 'assets', 'js', 'pedido.js'));
  const sessao = await abrirSessao(pasta);
  try {
    await visitar(sessao, { rel: 'index.html' }, TAMANHOS.find((t) => t.nome === 'celular'));
    const r = await sessao.avaliar(async (abertura) => {
      const quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const aviso = document.querySelector('[data-pedido-aviso]');
      const enviar = document.querySelector('[data-pedido-enviar]');
      const resumo = document.querySelector('[data-pedido-mensagem]');
      let falas = 0;
      new MutationObserver(() => {
        falas += 1;
      }).observe(aviso, { childList: true, characterData: true, subtree: true });
      const texto = () => decodeURIComponent(enviar.getAttribute('href').split('?text=')[1]);
      const inicio = { link: texto(), marcados: document.querySelectorAll('input:checked').length, vivo: document.querySelectorAll('[aria-live]').length };
      const recado = document.getElementById('recado');
      for (const letra of 'Sem pressa') {
        recado.value += letra;
        recado.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await quadro();
      const digitando = { falas, resumo: resumo.textContent, link: texto() };
      recado.dispatchEvent(new Event('change', { bubbles: true }));
      await quadro();
      const terminou = { falas, aviso: aviso.textContent };
      document.querySelector('[data-mais="fitas"]').click();
      document.querySelector('[data-item="Revisão completa"]').click();
      await quadro();
      return { abertura, inicio, digitando, terminou, fim: texto() };
    }, ABERTURA);
    assert.equal(r.inicio.link, ABERTURA, 'sem nada escolhido, a mensagem já é a abertura');
    assert.equal(r.inicio.marcados, 0, 'nada vem marcado');
    assert.equal(r.inicio.vivo, 0, 'o resumo não é região viva');
    assert.equal(r.digitando.falas, 0, 'o leitor de tela falou enquanto a pessoa digitava');
    assert.equal(r.digitando.resumo, `${ABERTURA}\nRecado: Sem pressa`);
    assert.equal(r.digitando.link, r.digitando.resumo);
    assert.equal(r.terminou.falas, 1);
    assert.equal(r.terminou.aviso, `Mensagem pronta: ${ABERTURA}\nRecado: Sem pressa`);
    assert.equal(r.fim, `${ABERTURA}\n- Revisão completa\n- Fita de guidão: 1\nRecado: Sem pressa`);
  } finally {
    await sessao.fechar();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('a primeira versão já nasce com o pedido certo: a skill novo-site e o como-usar mandam usar a peça', () => {
  const skill = fs.readFileSync(path.join(RAIZ, '.claude', 'skills', 'novo-site', 'SKILL.md'), 'utf8');
  for (const trecho of [
    'a ação principal funciona sozinha desde a primeira versão',
    'a página diz o que dá para pedir, marcar ou comprar, a partir das linhas do `fatos.md`',
    'a mensagem pronta do WhatsApp nunca sai vazia e não repete palavra',
    'nenhuma opção vem marcada por padrão sem um fato com fonte',
    '`kit/pecas/pedido.js`',
  ]) assert.ok(skill.includes(trecho), `skill novo-site sem: ${trecho}`);
  const guia = fs.readFileSync(path.join(RAIZ, 'kit', 'repertorio', 'como-usar.md'), 'utf8');
  const secao = guia.slice(guia.indexOf('### `pedido-no-whatsapp`'), guia.indexOf('### `link-de-pagamento-ou-agenda`'));
  for (const trecho of [
    '**A página diz o que dá para pedir.**',
    '**Nada vem marcado sem fonte.**',
    '**Use a peça pronta `kit/pecas/pedido.js`.**',
    '**A mensagem pronta nunca sai vazia.**',
    '**O leitor de tela fala uma vez, não a cada letra.**',
    'nunca é região viva (sem `aria-live`)',
  ]) assert.ok(secao.includes(trecho), `como-usar, pedido-no-whatsapp, sem: ${trecho}`);
  // a orientação antiga punha a quantidade num aria-live, sem dizer o que não pode ser região viva
  assert.ok(!secao.includes('a quantidade num `aria-live`'));
});
