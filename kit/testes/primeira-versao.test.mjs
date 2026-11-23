// Primeira versão já premium: o exemplo do estúdio não puxa a direção de ninguém (nenhum rastro do
// exemplo antigo de padaria), as letras da marca de exemplo nascem leves e com licença de nome
// próprio, e as quatro regras do piloto estão na skill de site novo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirLetras } from '../scripts/lib/letras.mjs';

const ESTE = fileURLToPath(import.meta.url);
const KIT = path.join(path.dirname(ESTE), '..');
const RAIZ = path.join(KIT, '..');

// Pastas que não são do estúdio (ou são da pessoa): só o LEIA-ME das pastas da pessoa é nosso.
const FORA = new Set(['.git', 'node_modules', '.ferramentas']);
const DA_PESSOA = new Set(['sites', 'referencias', 'minha-marca']);
const TERCEIROS = [['vendor', 'gsap'], ['vendor', 'lenis'], ['vendor', 'axe']].map((p) => p.join(path.sep));
const TEXTO = ['.md', '.mjs', '.js', '.css', '.json', '.txt', '.svg', '.html', '.sh', '.ps1', '.cmd', '.yml', '.env'];
const IMAGEM = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic'];

function arquivosDoEstudio(pasta = RAIZ) {
  const lista = [];
  for (const nome of fs.readdirSync(pasta)) {
    if (FORA.has(nome) || nome === 'package-lock.json') continue;
    const c = path.join(pasta, nome);
    if (pasta === RAIZ && DA_PESSOA.has(nome)) {
      const leia = path.join(c, 'LEIA-ME.txt');
      if (fs.existsSync(leia)) lista.push(leia);
      continue;
    }
    if (TERCEIROS.some((t) => c.includes(t))) continue;
    if (fs.statSync(c).isDirectory()) lista.push(...arquivosDoEstudio(c));
    else lista.push(c);
  }
  return lista;
}
const rel = (a) => path.relative(RAIZ, a).split(path.sep).join('/');
const ehTexto = (a) => TEXTO.some((e) => a.endsWith(e)) || !path.basename(a).includes('.');

// Rastros do exemplo antigo (a padaria de madrugada): palavras, nomes, letras e cores dele.
const RASTROS = [
  'padaria', 'aurora', 'fornada', 'forno', 'fermenta', 'brioche', 'pingado', 'miolo', 'pão', 'café',
  'cardápio', 'cardapio', 'amoreiras', 'antes do sol', 'bakery', 'horizonte__', 'data-sol',
  'fraunces', 'dm sans', 'dmsans',
  '#f4efe4', '#eae2d2', '#1d1a2e', '#575270', '#8f4a0e', '#16122a', '#221c3e', '#bab4d0', '#ffb86e', '#ffe2b8',
];

test('nenhum rastro do exemplo antigo de padaria: texto, nome, letra ou cor', () => {
  const lista = arquivosDoEstudio().filter((a) => a !== ESTE && ehTexto(a));
  assert.ok(lista.length > 60, `só ${lista.length} arquivos de texto`);
  const achados = [];
  for (const arquivo of lista) {
    const baixo = fs.readFileSync(arquivo, 'utf8').toLowerCase();
    for (const r of RASTROS) if (baixo.includes(r)) achados.push(`${rel(arquivo)}: "${r}"`);
  }
  assert.deepEqual(achados, []);
});

test('o molde e a marca de exemplo não trazem foto nenhuma (nem a do exemplo antigo)', () => {
  const pastas = [path.join(KIT, 'molde'), path.join(KIT, 'marca-exemplo')];
  const fotos = pastas.flatMap((p) => arquivosDoEstudio(p)).filter((a) => IMAGEM.some((e) => a.toLowerCase().endsWith(e)));
  assert.deepEqual(fotos.map(rel), []);
});

// Medido no piloto (2026-11-23): as letras que o estúdio produziu sem ajuda (.ttf inteiro) e as do
// site entregue (.woff2 recortado à mão, no meio do piloto). A meta: 60% mais leve que o melhor dos dois.
const LETRAS_DO_PILOTO = Object.freeze({ ttf_inteiro: 408496 + 62712, woff2_recortado: 131312 + 20836 + 20184 });

test('letras da marca de exemplo: .woff2, licença com o nome de cada família e 60% mais leves que no piloto', () => {
  const r = conferirLetras(path.join(KIT, 'marca-exemplo'));
  assert.ok(r.fontes.length >= 2, 'a marca de exemplo tem título e texto');
  assert.deepEqual(r.pesadas, [], 'toda letra em .woff2');
  assert.deepEqual(r.semLicenca, [], 'cada família com a sua licença');
  const licencas = fs.readdirSync(path.join(KIT, 'marca-exemplo', 'fontes')).filter((n) => n.endsWith('.txt'));
  assert.ok(licencas.every((n) => n.startsWith('OFL-') && n.length > 'OFL-.txt'.length), licencas.join(', '));
  const meta = Math.floor(LETRAS_DO_PILOTO.woff2_recortado * 0.4);
  assert.ok(r.bytes <= meta, `letras com ${r.bytes} bytes; a meta é até ${meta} (60% abaixo das ${LETRAS_DO_PILOTO.woff2_recortado} do piloto)`);
  assert.ok(r.bytes <= LETRAS_DO_PILOTO.ttf_inteiro * 0.4);
  // o tokens.css declara só as letras que estão na pasta
  const tokens = fs.readFileSync(path.join(KIT, 'marca-exemplo', 'tokens.css'), 'utf8');
  for (const f of r.fontes) assert.ok(tokens.includes(`url("${f.rel}")`), f.rel);
});

const SKILL = (dir, nome) => fs.readFileSync(path.join(RAIZ, dir, 'skills', nome, 'SKILL.md'), 'utf8');

test('as quatro regras do piloto estão na skill de site novo (Claude Code e Codex)', () => {
  const regras = [
    '**Coleta visual antes da direção.**',
    '**Assinatura tipográfica no topo.**',
    '**Um único momento forte, com a ação logo abaixo.**',
    '**Fotos reais pequenas e agrupadas, nunca esticadas.**',
  ];
  for (const dir of ['.claude', '.agents']) {
    const texto = SKILL(dir, 'novo-site');
    for (const r of regras) assert.ok(texto.includes(r), `${dir}: falta ${r}`);
    // as âncoras que as regras citam existem no molde
    for (const parte of ['abertura.mjs', 'fotos.mjs']) assert.ok(texto.includes(`_gerador/secoes/${parte}`), parte);
  }
  for (const parte of ['abertura', 'fotos', 'pico']) assert.ok(fs.existsSync(path.join(KIT, 'molde', '_gerador', 'secoes', `${parte}.mjs`)), parte);
});

test('todo texto nasce de um fato com fonte, e quem confere a frase é o revisor de fatos', () => {
  for (const dir of ['.claude', '.agents']) {
    assert.ok(SKILL(dir, 'novo-site').includes('**Todo texto da página nasce de uma linha do `fatos.md`.**'), dir);
    assert.ok(SKILL(dir, 'revisar').includes('todo texto da página nasce de uma linha de <fatos.md>'), dir);
  }
  assert.ok(fs.readFileSync(path.join(KIT, 'molde', 'fatos.md'), 'utf8').includes('Todo texto do site nasce de uma linha desta tabela'));
});

test('o molde mostra as regras: assinatura em linhas de pesos diferentes, um pico só com a ação logo abaixo', async () => {
  const { default: abertura } = await import('../molde/_gerador/secoes/abertura.mjs');
  const { default: pico } = await import('../molde/_gerador/secoes/pico.mjs');
  const { esc, palavras } = await import('../molde/_gerador/montar.mjs');
  const topo = abertura({ esc, link: (r) => r });
  assert.ok(topo.includes('class="assinatura"') && topo.includes('data-assina'));
  assert.ok(topo.split('assinatura__linha--').length - 1 >= 3, 'cartaz com 3 linhas ou mais');
  const forte = pico({ palavras });
  const fim = forte.lastIndexOf('</p>');
  assert.ok(fim !== -1 && forte.indexOf('class="botao"', fim) !== -1, 'a ação vem logo depois do momento forte');
  const ordem = fs.readFileSync(path.join(KIT, 'molde', '_gerador', 'ordem.mjs'), 'utf8');
  assert.equal(ordem.split("'pico'").length - 1, 1, 'um pico só no molde');
  const css = fs.readFileSync(path.join(KIT, 'molde', 'site', 'assets', 'css', 'site.css'), 'utf8');
  assert.ok(css.includes('.fotos__grupo img { width: auto; max-width: 100%; height: auto; }'), 'foto nunca maior que o arquivo');
});
