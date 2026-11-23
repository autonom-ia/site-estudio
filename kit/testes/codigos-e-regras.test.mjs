// Regras do repositório: códigos de mensagem existem, nada de expressão regular, nada privado,
// nenhum <select> nativo, endereço externo, caixa genérica nem travessão no molde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTE = fileURLToPath(import.meta.url);
const KIT = path.join(path.dirname(ESTE), '..');
const RAIZ = path.join(KIT, '..');

// Pastas que não são nossas ou não são código versionado.
const IGNORAR = new Set(['.git', 'node_modules', '.ferramentas', 'sites', 'referencias', 'minha-marca']);
// Bibliotecas de terceiros copiadas sem alteração.
const TERCEIROS = [['vendor', 'gsap'], ['vendor', 'lenis'], ['vendor', 'axe']].map((p) => p.join(path.sep));

function arquivos(pasta, fins) {
  const lista = [];
  if (!fs.existsSync(pasta)) return lista;
  for (const nome of fs.readdirSync(pasta)) {
    if (IGNORAR.has(nome)) continue;
    const c = path.join(pasta, nome);
    if (fs.statSync(c).isDirectory()) lista.push(...arquivos(c, fins));
    else if (fins.some((f) => nome.endsWith(f))) lista.push(c);
  }
  return lista;
}
const deTerceiros = (arquivo) => TERCEIROS.some((t) => arquivo.includes(t));
const rel = (a) => path.relative(RAIZ, a).split(path.sep).join('/');

const ehCodigo = (s) => s.length >= 2 && [...s].every((ch) => (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_');

function literaisDepois(texto, prefixo) {
  const achados = [];
  let i = texto.indexOf(prefixo);
  while (i !== -1) {
    const ini = i + prefixo.length;
    const fim = texto.indexOf("'", ini);
    if (fim !== -1) achados.push(texto.slice(ini, fim));
    i = texto.indexOf(prefixo, ini);
  }
  return achados;
}

test('todo código usado no kit existe em kit/mensagens.json', () => {
  const mensagens = JSON.parse(fs.readFileSync(path.join(KIT, 'mensagens.json'), 'utf8'));
  const faltando = [];
  for (const arquivo of arquivos(path.join(KIT, 'scripts'), ['.mjs'])) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const prefixo of ["falha('", "reprovado('", "aviso('", "codigo: '", "erro('", "KitErro('"]) {
      for (const c of literaisDepois(texto, prefixo)) if (ehCodigo(c) && !mensagens[c]) faltando.push(`${c} (${rel(arquivo)})`);
    }
    for (const c of literaisDepois(texto, "? '")) if (ehCodigo(c) && c.includes('_') && !mensagens[c]) faltando.push(`${c} (${rel(arquivo)})`);
  }
  assert.deepEqual(faltando, []);
});

test('toda mensagem do kit tem texto e ação', () => {
  const mensagens = JSON.parse(fs.readFileSync(path.join(KIT, 'mensagens.json'), 'utf8'));
  for (const [codigo, m] of Object.entries(mensagens)) {
    assert.ok(typeof m.texto === 'string' && m.texto.trim(), `${codigo} sem texto`);
    assert.ok(typeof m.acao === 'string' && m.acao.trim(), `${codigo} sem ação`);
  }
});

test('códigos do kit não colidem com os do instalador', (t) => {
  const arquivo = path.join(RAIZ, 'instalar', 'mensagens.json');
  if (!fs.existsSync(arquivo)) {
    t.skip('instalar/mensagens.json ainda não existe');
    return;
  }
  const kit = JSON.parse(fs.readFileSync(path.join(KIT, 'mensagens.json'), 'utf8'));
  const inst = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const comuns = new Set(['DESCONHECIDO', 'ESTUDIO_NAO_INSTALADO']);
  const iguais = Object.keys(kit).filter((c) => !c.startsWith('_') && !comuns.has(c) && inst[c] !== undefined);
  assert.deepEqual(iguais, []);
});

// Montados em pedaços para este arquivo não se acusar.
const B = '/';
const PROIBIDOS_JS = [
  `new Reg${'Exp'}`, `Reg${'Exp'}(`, `.mat${'ch'}(`, `.mat${'chAll'}(`, `.sea${'rch'}(`,
  `.replace(${B}`, `.replaceAll(${B}`, `.split(${B}`, `${B}.test(`, `${B}i.test(`, `${B}g.test(`, `${B}u.test(`,
  `= ${B}^`, `(${B}^`, `= ${B}\\`, `(${B}\\`, `= ${B}[`, `(${B}[`,
];
PROIBIDOS_JS.push(`.ex${'ec'}(`);
const PROIBIDOS_SH = [`=${'~'}`, `grep -${'E'}`, `grep -${'P'}`, `egrep`];
// PowerShell não diferencia maiúscula: a conferência é feita no texto em minúsculas.
const PROIBIDOS_PS1 = [
  `-mat${'ch'} `, `-repl${'ace'} `, `-spl${'it'} `, `[reg${'ex'}]`, `select-string -pat${'tern'}`,
  `-cmat${'ch'} `, `-imat${'ch'} `, `-notmat${'ch'} `, `-cnotmat${'ch'} `, `-inotmat${'ch'} `,
  `-crepl${'ace'} `, `-irepl${'ace'} `, `-cspl${'it'} `, `-ispl${'it'} `,
  `switch -reg${'ex'}`, `switch -casesensitive -reg${'ex'}`, `[system.text.regularexp${'ressions'}`, `regularexp${'ressions.regex'}`,
].map((p) => p.toLowerCase());

// Literal de expressão regular em JS: uma barra onde a linguagem espera um valor (depois de = ( , [ !
// & | ? : ou return), seguida de algo que não abre comentário. Divisão tem um valor antes da barra,
// então nunca cai aqui. Texto entre aspas e comentários são pulados.
const ANTES_DE_VALOR = '=(,[!&|?:';
function literaisDeRegex(codigo) {
  const achados = [];
  let ultimo = '';
  let palavra = '';
  const n = codigo.length;
  // linha #! do começo (o "env" do sistema), não é código
  let i = codigo.startsWith('#!') ? Math.max(codigo.indexOf('\n'), 0) : 0;
  while (i < n) {
    const ch = codigo[i];
    const prox = codigo[i + 1] || '';
    if (ch === '/' && prox === '/') {
      while (i < n && codigo[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && prox === '*') {
      const fim = codigo.indexOf('*/', i + 2);
      i = fim === -1 ? n : fim + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < n && codigo[j] !== ch) j += codigo[j] === '\\' ? 2 : 1;
      i = j + 1;
      ultimo = ch;
      palavra = '';
      continue;
    }
    if (ch === '/') {
      const valorEsperado = ANTES_DE_VALOR.includes(ultimo) || palavra === 'return' || palavra === 'typeof';
      if (valorEsperado && prox !== ' ' && prox !== '=') achados.push(codigo.slice(i, i + 20).split('\n')[0]);
    }
    const ehLetra = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '$';
    if (ehLetra(ch)) palavra = ultimo !== '' && ehLetra(ultimo) ? palavra + ch : ch;
    else if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') palavra = '';
    if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') ultimo = ch;
    i += 1;
  }
  return achados;
}

test('o detector de literal de expressão regular acha o literal e não acusa divisão, texto ou comentário', () => {
  const barra = '/';
  assert.equal(literaisDeRegex(`const x = ${barra}a+${barra}g;`).length, 1);
  assert.equal(literaisDeRegex(`if (${barra}^a${barra}.test(s)) {}`).length, 1);
  assert.equal(literaisDeRegex(`f(a, ${barra}b${barra}u);`).length, 1);
  assert.equal(literaisDeRegex(`function f() { return ${barra}x${barra}; }`).length, 1);
  assert.equal(literaisDeRegex('const meio = (a + b) / 2; const r = total / n;').length, 0);
  assert.equal(literaisDeRegex("const u = 'https://x/y'; // (veja /aqui)\n/* = /z */ const k = a / b;").length, 0);
  assert.equal(literaisDeRegex('const t = `${a}/${b}`; x /= 2;').length, 0);
  assert.equal(literaisDeRegex(`#!${barra}usr${barra}bin${barra}env node\nconst a = 1;`).length, 0);
});

test('nenhuma expressão regular no código do repositório', () => {
  const achados = [];
  const checar = (lista, proibidos, minusculas = false) => {
    for (const arquivo of lista) {
      if (arquivo === ESTE || deTerceiros(arquivo)) continue;
      const bruto = fs.readFileSync(arquivo, 'utf8');
      const texto = minusculas ? bruto.toLowerCase() : bruto;
      for (const p of proibidos) if (texto.includes(p)) achados.push(`${rel(arquivo)}: ${p}`);
    }
  };
  checar(arquivos(RAIZ, ['.mjs', '.js', '.html', '.cjs']), PROIBIDOS_JS);
  checar([...arquivos(RAIZ, ['.sh']), path.join(RAIZ, 'estudio')].filter((a) => fs.existsSync(a)), PROIBIDOS_SH);
  checar(arquivos(RAIZ, ['.ps1']), PROIBIDOS_PS1, true);
  for (const arquivo of arquivos(RAIZ, ['.mjs', '.js', '.cjs'])) {
    if (arquivo === ESTE || deTerceiros(arquivo)) continue;
    for (const l of literaisDeRegex(fs.readFileSync(arquivo, 'utf8'))) achados.push(`${rel(arquivo)}: literal ${l}`);
  }
  assert.deepEqual(achados, []);
});

// Nomes, domínios e servidores que não podem aparecer em nada publicado. Ficam aqui só como
// impressão digital (SHA-256, primeiros 24 caracteres), para o próprio teste não publicar os nomes.
// Cada palavra do texto (e cada pedaço dela separado por . - _) é conferida contra a lista.
const DIGITAIS = new Set([
  '138df632fd0de2067dfcd75b', '064d1e677b995c1f68eaf774', '7dce9376d2930f33ae0c841c', '186f25181aaf249af7fa5a5a',
  '344bff8b2788383a072daddf', 'd4dfebb4d4870361bcf38648', 'd65c0627d93f1b36bcc53664', '86b468bf8549504c71446c7d',
  '791e0160c30baee8322e49f0', '0c9469351793cc965bc41d22', '7499155658c3de953e2f7685', 'f08b9ed777b422e9031ea92f',
  '6013de0381f648b7f2151888', '5542b87967a040b52faa59e7',
]);
// sigla de três letras: só em maiúsculas e como palavra inteira (MENSAGENS não conta)
const DIGITAL_SIGLA = '09ddf36201cda6a7b9c8ace9';
const digital = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
const CAMINHO_DE_MAQUINA = `/Us${'ers/'}`;

function palavrasDoTexto(texto) {
  const lista = [];
  let atual = '';
  const ehDaPalavra = (ch) => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch > '\u007f' || ch === '.' || ch === '-' || ch === '_';
  for (const ch of `${texto} `) {
    if (ehDaPalavra(ch)) atual += ch;
    else {
      if (atual) lista.push(atual);
      atual = '';
    }
  }
  return lista;
}

function achadosPrivados(texto) {
  const achados = new Set();
  for (const palavra of palavrasDoTexto(texto.normalize('NFC'))) {
    const pedacos = [palavra];
    for (const sep of ['.', '-', '_']) for (const p of palavra.split(sep)) if (p && p !== palavra) pedacos.push(p);
    for (const p of pedacos) {
      if (DIGITAIS.has(digital(p.toLowerCase()))) achados.add(digital(p.toLowerCase()));
      if (digital(p) === DIGITAL_SIGLA) achados.add('sigla');
    }
  }
  if (texto.includes(CAMINHO_DE_MAQUINA)) achados.add('caminho de máquina');
  return [...achados];
}

test('a impressão digital acha o nome mesmo dentro de domínio, caminho ou e-mail', () => {
  assert.deepEqual(achadosPrivados('nada aqui, MENSAGENS, ensaio'), []);
  assert.equal(achadosPrivados(`x@${['clau', 'dete'].join('')}.example`).length, 1);
  assert.equal(achadosPrivados(`cidade ${['E', 'NS'].join('')}.`).length, 1);
});

test('nada privado no repositório (clientes, domínios, servidores, caminhos de máquina)', () => {
  const lista = arquivos(RAIZ, ['.mjs', '.js', '.json', '.html', '.css', '.md', '.txt', '.sh', '.ps1', '.cmd', '.yml', '.env', '.svg'])
    .filter((a) => a !== ESTE && !deTerceiros(a) && !a.endsWith('package-lock.json'));
  for (const extra of ['estudio', 'VERSAO', '.gitignore']) if (fs.existsSync(path.join(RAIZ, extra))) lista.push(path.join(RAIZ, extra));
  const achados = [];
  for (const arquivo of lista) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const a of achadosPrivados(texto)) achados.push(`${rel(arquivo)}: ${a}`);
  }
  assert.deepEqual(achados, []);
});

function textoDoMolde() {
  return arquivos(path.join(KIT, 'molde'), ['.mjs', '.html', '.css', '.js', '.md'])
    .filter((a) => !deTerceiros(a))
    .map((a) => ({ arquivo: a, texto: fs.readFileSync(a, 'utf8') }));
}

test('molde sem <select> nativo, sem endereço externo carregado e sem travessão no texto', () => {
  const lista = textoDoMolde();
  assert.ok(lista.length >= 12);
  for (const { arquivo, texto } of lista) {
    const baixo = texto.toLowerCase();
    assert.equal(baixo.includes('<select'), false, `${rel(arquivo)} tem <select>`);
    for (const attr of ['src="http', "src='http", 'href="http', "href='http", 'url(http', 'url("http', "url('http", '@import']) {
      assert.equal(baixo.includes(attr), false, `${rel(arquivo)} aponta para fora (${attr})`);
    }
    if (arquivo.includes(`${path.sep}secoes${path.sep}`)) {
      assert.equal(texto.includes('\u2014') || texto.includes('\u2013'), false, `${rel(arquivo)} tem travessão`);
    }
  }
});

test('molde sem caixa genérica: nada de cartão (card) com borda e fundo em volta de conteúdo', () => {
  const css = fs.readFileSync(path.join(KIT, 'molde', 'site', 'assets', 'css', 'site.css'), 'utf8').toLowerCase();
  for (const proibido of ['.card ', '.card{', '.card,', '.card-', '.card_', 'cartao', 'box-shadow']) assert.equal(css.includes(proibido), false, proibido);
  for (const { arquivo, texto } of textoDoMolde()) {
    if (!arquivo.endsWith('.mjs')) continue;
    for (const c of ['class="card"', 'class="card ', 'class="card-', ' card"']) assert.equal(texto.includes(c), false, `${rel(arquivo)} usa card`);
  }
});

test('molde traz o vendor local, a marca de exemplo e o axe-core com versão fixa', () => {
  for (const v of ['gsap/gsap.min.js', 'gsap/ScrollTrigger.min.js', 'lenis/lenis.min.js', 'lenis/lenis.css']) {
    assert.ok(fs.existsSync(path.join(KIT, 'molde', 'site', 'assets', 'vendor', ...v.split('/'))), v);
  }
  for (const f of ['tokens.css', 'fontes/Fraunces-Variable.woff2', 'fontes/DMSans-Variable.woff2', 'fontes/OFL-Fraunces.txt', 'fontes/OFL-DMSans.txt']) {
    assert.ok(fs.existsSync(path.join(KIT, 'marca-exemplo', ...f.split('/'))), f);
  }
  const versao = fs.readFileSync(path.join(KIT, 'vendor', 'axe', 'VERSAO'), 'utf8').trim();
  const cabeca = fs.readFileSync(path.join(KIT, 'vendor', 'axe', 'axe.min.js'), 'utf8').slice(0, 200);
  assert.ok(cabeca.includes(`axe v${versao}`), `axe.min.js não é a versão ${versao}`);
  assert.ok(fs.existsSync(path.join(KIT, 'vendor', 'axe', 'LICENSE')));
  const gsap = fs.readFileSync(path.join(KIT, 'molde', 'site', 'assets', 'vendor', 'gsap', 'gsap.min.js'), 'utf8').slice(0, 200);
  assert.ok(gsap.includes('GSAP 3.13.0'));
});

test('todo número, contato e @ das seções do molde está em fatos.md do molde, com a fonte do exemplo', async () => {
  const { lerTabelaDeFatos, montarLastro, conferirTexto, FONTE_DE_EXEMPLO } = await import('../scripts/lib/fatos.mjs');
  const linhas = lerTabelaDeFatos(fs.readFileSync(path.join(KIT, 'molde', 'fatos.md'), 'utf8'));
  assert.ok(linhas.length > 10);
  // a fonte do molde é a constante única de lib/fatos.mjs, e nunca conta como fonte
  for (const l of linhas) {
    assert.equal(l.fonte, FONTE_DE_EXEMPLO, l.fato);
    assert.equal(l.comFonte, false, l.fato);
    assert.equal(l.exemplo, true, l.fato);
  }
  const lastro = montarLastro(linhas);
  assert.ok(lastro.doExemplo.size > 10);
  const r = conferirTexto({ texto: 'desde 2019 · R$ 18,00 · (11) 0000-0000 · ola@cafeaurora.example · 120', enderecos: ['tel:+551100000000', 'mailto:ola@cafeaurora.example'] }, lastro);
  // tudo o que o molde mostra está em fatos.md, mas só com a fonte do exemplo: reprova até trocar
  assert.ok(r.faltam.length >= 6);
  assert.deepEqual(r.faltam.filter((f) => f.motivo !== 'fonte-de-exemplo'), []);
});

test('toda seção do molde, o cabeçalho, a nota do rodapé e a ordem levam data-molde', () => {
  const secoes = path.join(KIT, 'molde', '_gerador', 'secoes');
  for (const nome of fs.readdirSync(secoes)) {
    if (!nome.endsWith('.mjs')) continue;
    const texto = fs.readFileSync(path.join(secoes, nome), 'utf8');
    assert.ok(texto.includes('data-molde="'), `${nome} sem data-molde`);
  }
  assert.ok(fs.readFileSync(path.join(KIT, 'molde', '_gerador', 'ordem.mjs'), 'utf8').includes('molde: true,'));
  const tipos = JSON.parse(fs.readFileSync(path.join(KIT, 'mensagens.json'), 'utf8'))._tipos_dos_achados.acao;
  for (const t of ['resto-do-molde', 'fonte-de-exemplo']) assert.ok(tipos.includes(t), t);
});

test('estudio.cmd: a linha que roda o Node termina em "& exit /b" e o erro sem Node não repete o argumento', () => {
  const linhas = fs.readFileSync(path.join(RAIZ, 'estudio.cmd'), 'utf8').split('\n').map((l) => l.trim());
  const execucao = linhas.filter((l) => l.startsWith('"%ESTUDIO_NODE%"'));
  assert.equal(execucao.length, 1, execucao.join('\n'));
  // o "atualizar" reescreve o .cmd enquanto o cmd.exe o lê: a saída precisa estar na mesma linha
  assert.ok(execucao[0].endsWith('%* & exit /b'), execucao[0]);
  const erro = linhas.find((l) => l.startsWith('echo {"ok":false'));
  assert.ok(erro && erro.includes('"comando":""'), erro);
  assert.equal(erro.includes('%~1'), false);
});

test('.gitattributes fixa CRLF nos .cmd e .ps1 e LF nos scripts de shell', () => {
  const regras = fs.readFileSync(path.join(RAIZ, '.gitattributes'), 'utf8').split('\n').map((l) => l.trim().split(' ').filter(Boolean).join(' '));
  for (const r of ['*.cmd text eol=crlf', '*.ps1 text eol=crlf', '*.sh text eol=lf', 'estudio text eol=lf']) assert.ok(regras.includes(r), r);
});

test('.ps1 e .cmd só têm caracteres ASCII (o PowerShell 5.1 lê sem BOM como ANSI)', () => {
  const lista = [...arquivos(RAIZ, ['.ps1', '.cmd'])];
  assert.ok(lista.length >= 4);
  for (const arquivo of lista) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    const fora = [...texto].findIndex((ch) => ch.charCodeAt(0) > 126 || (ch.charCodeAt(0) < 32 && ch !== '\n' && ch !== '\r' && ch !== '\t'));
    assert.equal(fora, -1, `${rel(arquivo)}: caractere fora do ASCII na posição ${fora}`);
  }
});

test('a versão mora em 6 lugares e todos batem com VERSAO', () => {
  const versao = fs.readFileSync(path.join(RAIZ, 'VERSAO'), 'utf8').trim();
  const pacote = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const trava = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package-lock.json'), 'utf8'));
  const linhaComeco = (arquivo, comeco) => {
    const l = fs.readFileSync(path.join(RAIZ, ...arquivo.split('/')), 'utf8').split('\n').map((x) => x.trim()).find((x) => x.startsWith(comeco));
    assert.ok(l, `${arquivo} sem a linha ${comeco}`);
    return l.slice(comeco.length);
  };
  const sh = linhaComeco('instalar/instalar.sh', 'VERSAO_ESTUDIO="');
  const ps1 = linhaComeco('instalar/instalar.ps1', "$script:VersaoEstudio = '");
  assert.deepEqual(
    {
      'package.json': pacote.version,
      'package-lock.json (topo)': trava.version,
      'package-lock.json (packages."")': trava.packages[''].version,
      'instalar/instalar.sh': sh.slice(0, sh.indexOf('"')),
      'instalar/instalar.ps1': ps1.slice(0, ps1.indexOf("'")),
    },
    {
      'package.json': versao,
      'package-lock.json (topo)': versao,
      'package-lock.json (packages."")': versao,
      'instalar/instalar.sh': versao,
      'instalar/instalar.ps1': versao,
    },
  );
});
