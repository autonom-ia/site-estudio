// Conversa sem jargão, coleta em duas perguntas e pedido vago com antes e depois.
// Tudo o que é mostrado à pessoa (os textos de kit/mensagens.json e de instalar/mensagens.json, as
// falas entre aspas das skills e do AGENTS.md e a porta de entrada do README) não pode ter palavra
// técnica. A comparação é por palavra, sem acento e sem diferença de maiúscula, sem expressão regular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, ...rel.split('/')), 'utf8');
const lerJson = (rel) => JSON.parse(ler(rel));

// Palavras que a pessoa nunca lê. Nome de botão de serviço de fora (Deploy, Commit changes) e o
// nome do aplicativo Terminal ficam de fora: a pessoa precisa achá-los na tela.
const PROIBIDAS = Object.freeze([
  'rodada', 'rodadas', 'nota', 'notas', 'json', 'pasta', 'pastas', 'comando', 'comandos', 'zip',
  'preflight', 'revisor', 'revisores', 'revisora', 'revisoras', 'script', 'scripts', 'viewport', 'cdn',
  'sandbox', 'npm', 'build', 'log', 'logs', 'html', 'css', 'md', 'mjs',
]);

const ehMarcaDeAcento = (ch) => ch.codePointAt(0) >= 0x300 && ch.codePointAt(0) <= 0x36f;
const semAcento = (s) => [...s.normalize('NFD')].filter((ch) => !ehMarcaDeAcento(ch)).join('').toLowerCase();

// Tira o que está entre {{ }}: é o nome de um valor que o assistente troca, não texto lido.
function semMarcadores(texto) {
  let saida = '';
  let resto = texto;
  for (;;) {
    const ini = resto.indexOf('{{');
    if (ini === -1) return saida + resto;
    const fim = resto.indexOf('}}', ini + 2);
    if (fim === -1) return saida + resto;
    saida += `${resto.slice(0, ini)} `;
    resto = resto.slice(fim + 2);
  }
}

function palavras(texto) {
  const lista = [];
  let atual = '';
  for (const ch of `${semAcento(semMarcadores(texto))} `) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) atual += ch;
    else {
      if (atual) lista.push(atual);
      atual = '';
    }
  }
  return lista;
}

export const palavrasProibidas = (texto) => palavras(texto).filter((p) => PROIBIDAS.includes(p));

function falasDoKit() {
  return Object.entries(lerJson('kit/mensagens.json'))
    .filter(([codigo]) => !codigo.startsWith('_'))
    .map(([codigo, m]) => ({ onde: `kit/mensagens.json ${codigo}`, texto: m.texto }));
}

const CAMPOS_DE_FALA = Object.freeze(['texto', 'nome', 'frase', 'consequencia', 'pronto']);
function falasDoInstalador() {
  const json = lerJson('instalar/mensagens.json');
  const falas = [];
  for (const grupo of ['textos', 'itens', 'erros']) {
    for (const [codigo, m] of Object.entries(json[grupo])) {
      for (const [campo, valor] of Object.entries(m)) {
        const onde = `instalar/mensagens.json ${grupo}.${codigo}.${campo}`;
        if (typeof valor === 'string' && (CAMPOS_DE_FALA.includes(campo) || campo.startsWith('linha_'))) falas.push({ onde, texto: valor });
        if (Array.isArray(valor) && campo.startsWith('opcoes')) for (const o of valor) falas.push({ onde, texto: o });
      }
    }
  }
  return falas;
}

// Linhas de um Markdown sem o cabeçalho YAML, sem bloco de código e sem trecho entre crases.
function linhasDeTexto(markdown) {
  const linhas = markdown.split('\n');
  let i = 0;
  if (linhas[0] === '---') {
    i = linhas.indexOf('---', 1) + 1;
  }
  const saida = [];
  let emCodigo = false;
  for (; i < linhas.length; i += 1) {
    if (linhas[i].trim().startsWith('```')) {
      emCodigo = !emCodigo;
      continue;
    }
    if (emCodigo) continue;
    saida.push(linhas[i].split('`').filter((_, k) => k % 2 === 0).join(''));
  }
  return saida;
}

// Fala de skill: o trecho entre aspas retas. Trecho com <marcador> é molde de arquivo ou pedido a
// outro assistente (as lentes da revisão), nunca é dito à pessoa.
export function falasDoMarkdown(markdown) {
  const falas = [];
  for (const linha of linhasDeTexto(markdown)) {
    const partes = linha.split('"');
    for (let k = 1; k < partes.length; k += 2) {
      const t = partes[k];
      const ini = t.indexOf('<');
      if (ini !== -1 && t.indexOf('>', ini) !== -1) continue;
      if (t.trim()) falas.push(t);
    }
  }
  return falas;
}

const SKILLS = path.join(RAIZ, '.claude', 'skills');
function falasDasSkills() {
  const falas = [];
  for (const skill of fs.readdirSync(SKILLS).sort()) {
    const arquivo = path.join(SKILLS, skill, 'SKILL.md');
    if (!fs.existsSync(arquivo)) continue;
    for (const texto of falasDoMarkdown(fs.readFileSync(arquivo, 'utf8'))) falas.push({ onde: `.claude/skills/${skill}/SKILL.md`, texto });
  }
  for (const texto of falasDoMarkdown(ler('AGENTS.md'))) falas.push({ onde: 'AGENTS.md', texto });
  return falas;
}

// Tira o endereço dos links do Markdown, "[texto](endereço)": só o texto é lido pela pessoa.
function semEnderecoDeLink(texto) {
  let saida = '';
  let resto = texto;
  for (;;) {
    const ini = resto.indexOf('](');
    const fim = ini === -1 ? -1 : resto.indexOf(')', ini);
    if (fim === -1) return saida + resto;
    saida += `${resto.slice(0, ini)}]`;
    resto = resto.slice(fim + 1);
  }
}

function portaDeEntrada() {
  const readme = ler('README.md');
  const ini = readme.indexOf('<!-- porta-de-entrada');
  const fim = readme.indexOf('<!-- /porta-de-entrada -->');
  assert.ok(ini !== -1 && fim > ini, 'README sem a porta de entrada marcada');
  const corpo = readme.slice(readme.indexOf('-->', ini) + 3, fim);
  return [{ onde: 'README.md (porta de entrada)', texto: semEnderecoDeLink(linhasDeTexto(corpo).join('\n')) }];
}

test('o filtro de jargão acha a palavra inteira, sem acento nem maiúscula, e ignora {{ }}', () => {
  assert.deepEqual(palavrasProibidas('O .zip está na Pasta do site'), ['zip', 'pasta']);
  assert.deepEqual(palavrasProibidas('Os REVISORES deram a nota da rodada'), ['revisores', 'nota', 'rodada']);
  assert.deepEqual(palavrasProibidas('Os seus sites continuam em {{pasta_do_estudio}}.'), []);
  assert.deepEqual(palavrasProibidas('anotação, pastel, logo e login não são jargão'), []);
  assert.deepEqual(falasDoMarkdown('---\ndescription: "pasta"\n---\nDiga: "Pronto." e `"zip"`\n```\n"json"\n```\n"Leia <x.json>"'), ['Pronto.']);
});

test('nenhuma mensagem mostrada à pessoa tem palavra técnica', () => {
  const falas = [...falasDoKit(), ...falasDoInstalador(), ...falasDasSkills(), ...portaDeEntrada()];
  // o extrator não pode passar por estar vazio
  assert.ok(falasDoKit().length >= 40);
  assert.ok(falasDoInstalador().length >= 40);
  assert.ok(falasDasSkills().length >= 40);
  const achados = [];
  for (const { onde, texto } of falas) {
    const ruins = palavrasProibidas(texto);
    if (ruins.length) achados.push(`${onde}: ${ruins.join(', ')} em "${texto.slice(0, 90)}"`);
  }
  assert.deepEqual(achados, []);
});

test('coleta: só duas perguntas obrigatórias (o negócio e onde ele aparece); gosto é opcional e pode ser delegado', () => {
  const skill = ler('.claude/skills/novo-site/SKILL.md');
  const ini = skill.indexOf('**Perguntas obrigatórias (só estas duas)**');
  assert.ok(ini !== -1, 'novo-site sem o bloco das perguntas obrigatórias');
  const bloco = skill.slice(ini, skill.indexOf('\n\n', ini));
  const perguntas = bloco.split('\n').filter((l) => l.length > 2 && l[0] >= '0' && l[0] <= '9' && l[1] === '.');
  assert.equal(perguntas.length, 2, bloco);
  assert.ok(perguntas[0].includes('negócio'));
  for (const lugar of ['Instagram', 'site', 'Google']) assert.ok(perguntas[1].includes(lugar), lugar);
  assert.ok(skill.includes('"Pode decidir por mim ★"'));
  assert.ok(skill.includes('Gosto visual e sites favoritos são sempre opcionais'));
  // a marca não abre outra rodada de perguntas antes do site
  assert.ok(ler('AGENTS.md').includes('Não pare para perguntar: a marca nasce junto com o primeiro site'));
  assert.ok(ler('.claude/skills/minha-marca/SKILL.md').includes('as perguntas 1 e 2 já foram feitas na coleta'));
});

test('pedido vago: a skill manda guardar o antes, mudar 2 ou 3 coisas concretas e comparar', () => {
  const skill = ler('.claude/skills/novo-site/SKILL.md');
  const ini = skill.indexOf('## Pedido vago: antes e depois');
  assert.ok(ini !== -1);
  const secao = skill.slice(ini, skill.indexOf('\n## ', ini + 5));
  for (const passo of ['./estudio antes <nome>', '2 ou 3 mudanças concretas', 'mudancas.json', './estudio comparar <nome>', '"O depois ★"']) {
    assert.ok(secao.includes(passo), passo);
  }
  const kit = lerJson('kit/mensagens.json');
  for (const c of ['ANDAMENTO_ABRI', 'ANDAMENTO_CONFERENCIA', 'ANDAMENTO_FOTOS', 'ANDAMENTO_OLHARES', 'ANDAMENTO_AJUSTES', 'ANDAMENTO_PRONTO']) {
    assert.ok(kit[c] && skill.includes(c), c);
  }
});
