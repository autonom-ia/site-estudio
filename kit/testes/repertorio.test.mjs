// Repertório de referências (kit/repertorio/): o formato de todas as fichas, só link e nenhuma
// imagem, os cinco jeitos de fazer aqui, a instrução de escolha na skill novo-site e a chegada
// pela atualização.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.join(KIT, '..');
const PASTA = path.join(KIT, 'repertorio');

// A ação de quem visita o site: um arquivo <ação>.json por ação.
const ACOES = ['pedir', 'reservar', 'comprar', 'simular', 'escolher', 'visitar', 'orcar', 'participar'];
// Os cinco jeitos de entregar a ideia num site sem servidor ("como fazemos aqui").
const PADROES = ['troca-de-fotos', 'pedido-no-whatsapp', 'link-de-pagamento-ou-agenda', 'simulador-na-pagina', 'mapa-por-botao'];
// Os dois jeitos com 3D, cada um com a demo própria do estúdio em kit/demos/3d.
const PADROES_3D = ['configurador-3d', 'marca-em-3d'];
const DEMO_3D = 'kit/demos/3d';
// ondeVer: o caminho do link até a parte da página onde o princípio aparece (quase nunca é a capa).
const CAMPOS = ['id', 'nome', 'link', 'ondeVer', 'ramo', 'duvida', 'principio', 'comoFazemosAqui', 'noCelular', 'naoTrazer'];
// Texto que termina em ponto final; a dúvida termina em interrogação.
const FRASES = ['ondeVer', 'principio', 'noCelular', 'naoTrazer'];
const TEXTO_MAXIMO = 240;
const FICHAS_MINIMO = 35;
const FICHAS_MAXIMO = 45;
const EXTENSOES_DE_IMAGEM = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.heic', '.bmp', '.tif', '.tiff', '.ico'];
const PERMITIDOS_NO_ID = 'abcdefghijklmnopqrstuvwxyz0123456789-';

const mesmasChaves = (obj, chaves) => obj !== null && typeof obj === 'object' && !Array.isArray(obj)
  && JSON.stringify(Object.keys(obj).sort()) === JSON.stringify([...chaves].sort());
const temImagem = (texto) => EXTENSOES_DE_IMAGEM.some((ext) => texto.toLowerCase().includes(ext));

function problemasDoTexto(nome, valor, fim) {
  if (typeof valor !== 'string' || valor.trim() !== valor || valor.length < 3) return [`${nome} vazio ou com espaço sobrando`];
  const p = [];
  if (valor.length > TEXTO_MAXIMO) p.push(`${nome} passa de ${TEXTO_MAXIMO} caracteres`);
  if (valor.includes('—') || valor.includes('–')) p.push(`${nome} tem travessão`);
  if (temImagem(valor)) p.push(`${nome} cita arquivo de imagem`);
  if (fim && !valor.endsWith(fim)) p.push(`${nome} não termina em "${fim}"`);
  return p;
}

function problemasDoLink(link) {
  let u;
  try {
    u = new URL(link);
  } catch {
    return ['link não é endereço'];
  }
  const p = [];
  if (u.protocol !== 'https:') p.push('link sem https');
  if (u.username || u.password || u.port) p.push('link com usuário, senha ou porta');
  if (u.search || u.hash) p.push('link com ? ou #');
  if (u.href !== link) p.push('link fora da forma normal');
  if (temImagem(u.pathname)) p.push('link aponta para imagem');
  const partes = u.hostname.split('.');
  if (partes.length < 2 || partes.every((x) => x !== '' && [...x].every((c) => c >= '0' && c <= '9'))) p.push('link sem domínio público');
  return p;
}

// conferidaEm (opcional): o dia em que a ficha foi conferida ao vivo, AAAA-MM-DD, nunca no futuro.
const HOJE = new Date().toISOString().slice(0, 10);
function dataValida(v) {
  if (typeof v !== 'string' || v.length !== 10) return false;
  const [ano, mes, dia] = v.split('-');
  const digitos = (x, n) => typeof x === 'string' && x.length === n && [...x].every((c) => c >= '0' && c <= '9');
  if (!digitos(ano, 4) || !digitos(mes, 2) || !digitos(dia, 2)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v <= HOJE;
}

function problemasDaFicha(f) {
  const campos = f && Object.hasOwn(f, 'conferidaEm') ? [...CAMPOS, 'conferidaEm'] : CAMPOS;
  if (!mesmasChaves(f, campos)) return [`campos diferentes de: ${CAMPOS.join(', ')} (e conferidaEm, opcional)`];
  const p = [];
  if (campos.length > CAMPOS.length && !dataValida(f.conferidaEm)) p.push('conferidaEm fora do formato AAAA-MM-DD ou no futuro');
  const idOk = typeof f.id === 'string' && f.id.length >= 2 && !f.id.startsWith('-') && !f.id.endsWith('-')
    && [...f.id].every((c) => PERMITIDOS_NO_ID.includes(c));
  if (!idOk) p.push('id fora do formato (minúsculas, números e hífen)');
  p.push(...problemasDoTexto('nome', f.nome), ...problemasDoTexto('ramo', f.ramo), ...problemasDoTexto('duvida', f.duvida, '?'));
  for (const c of FRASES) p.push(...problemasDoTexto(c, f[c], '.'));
  p.push(...problemasDoLink(f.link));
  const como = f.comoFazemosAqui;
  if (!mesmasChaves(como, ['padrao', 'texto'])) p.push('comoFazemosAqui sem padrao e texto');
  else {
    if (![...PADROES, ...PADROES_3D].includes(como.padrao)) p.push(`padrao "${como.padrao}" não existe`);
    p.push(...problemasDoTexto('comoFazemosAqui.texto', como.texto, '.'));
  }
  return p;
}

function lerRepertorio() {
  return ACOES.map((acao) => ({ acao, arquivo: `${acao}.json`, dados: JSON.parse(fs.readFileSync(path.join(PASTA, `${acao}.json`), 'utf8')) }));
}
const todasAsFichas = () => lerRepertorio().flatMap((r) => r.dados.fichas.map((f) => ({ ...f, acao: r.acao })));

test('o repertório tem um arquivo por ação, e cada um diz o que quem visita quer', () => {
  const jsons = fs.readdirSync(PASTA).filter((n) => n.endsWith('.json')).sort();
  assert.deepEqual(jsons, ACOES.map((a) => `${a}.json`).sort());
  for (const { acao, arquivo, dados } of lerRepertorio()) {
    assert.ok(mesmasChaves(dados, ['acao', 'visitanteQuer', 'fichas']), `${arquivo}: campos acao, visitanteQuer e fichas`);
    assert.equal(dados.acao, acao, `${arquivo}: acao diferente do nome do arquivo`);
    assert.deepEqual(problemasDoTexto('visitanteQuer', dados.visitanteQuer, '.'), [], arquivo);
    assert.ok(Array.isArray(dados.fichas) && dados.fichas.length >= 4, `${arquivo}: pelo menos 4 fichas`);
  }
});

test('a data de conferência é AAAA-MM-DD de verdade e nunca no futuro', () => {
  for (const v of ['2026-11-24', '2024-02-29']) assert.equal(dataValida(v), true, v);
  for (const v of ['2026-13-01', '2026-02-30', '2023-02-29', '24/11/2026', '2026-1-24', '2026-11-2a', '9999-12-31', 20261124, null]) assert.equal(dataValida(v), false, String(v));
});

test('toda ficha do repertório segue o formato', () => {
  const achados = [];
  for (const { acao, ...ficha } of todasAsFichas()) for (const p of problemasDaFicha(ficha)) achados.push(`${acao}/${ficha.id}: ${p}`);
  assert.deepEqual(achados, []);
});

test('cerca de 40 fichas, sem id nem link repetido, com ramos variados em cada ação', () => {
  const fichas = todasAsFichas();
  assert.ok(fichas.length >= FICHAS_MINIMO && fichas.length <= FICHAS_MAXIMO, `${fichas.length} fichas`);
  const repetidos = (campo) => fichas.map((f) => f[campo]).filter((v, i, todos) => todos.indexOf(v) !== i);
  assert.deepEqual(repetidos('id'), []);
  assert.deepEqual(repetidos('link'), []);
  // dá sempre para escolher 2 de outro ramo, qualquer que seja o ramo do site
  for (const acao of ACOES) {
    const ramos = new Set(fichas.filter((f) => f.acao === acao).map((f) => f.ramo));
    assert.ok(ramos.size >= 3, `${acao}: só ${ramos.size} ramos`);
  }
  assert.ok(new Set(fichas.map((f) => f.ramo)).size >= 25);
});

test('os cinco jeitos de fazer aqui aparecem no repertório e estão explicados no como-usar.md', () => {
  const fichas = todasAsFichas();
  for (const padrao of PADROES) {
    assert.ok(fichas.filter((f) => f.comoFazemosAqui.padrao === padrao).length >= 3, `${padrao} em menos de 3 fichas`);
  }
  const guia = fs.readFileSync(path.join(PASTA, 'como-usar.md'), 'utf8');
  for (const padrao of PADROES) assert.ok(guia.includes(`### \`${padrao}\``), `como-usar.md sem a explicação de ${padrao}`);
  for (const acao of ACOES) assert.ok(guia.includes(`\`${acao}.json\``), `como-usar.md sem ${acao}.json`);
  assert.ok(guia.split('\n').length < 300);
});

test('os jeitos com 3D apontam para a demo própria e o como-usar diz quando usar, quando não e o limite de peso', () => {
  const fichas = todasAsFichas();
  for (const padrao of PADROES_3D) {
    const com = fichas.filter((f) => f.comoFazemosAqui.padrao === padrao);
    assert.ok(com.length >= 1, `nenhuma ficha com ${padrao}`);
    for (const f of com) assert.ok(f.comoFazemosAqui.texto.includes(DEMO_3D), `${f.id}: não aponta para ${DEMO_3D}`);
    // ficha de 3D só entra conferida ao vivo, com a data da conferência
    for (const f of com) assert.ok(dataValida(f.conferidaEm), `${f.id}: sem conferidaEm`);
  }
  assert.ok(fs.existsSync(path.join(RAIZ, ...DEMO_3D.split('/'), '_gerador', 'ordem.mjs')), 'a demo não existe');
  const guia = fs.readFileSync(path.join(PASTA, 'como-usar.md'), 'utf8');
  const secao = guia.slice(guia.indexOf('## 3D: só com prova e com limite'), guia.indexOf('## Quando nenhuma ficha serve'));
  assert.ok(secao.length > 200, 'como-usar.md sem a seção de 3D');
  for (const trecho of ['**Quando usar.**', '**Quando não usar.**', 'celular fraco', 'O negócio não precisa', '200 KB comprimido', '1,5 MB', '`3d-pesado`',
    'imagem de reserva', 'reduzir movimento', 'perto da tela', '`aria-live`', '--demo 3d', 'CENA_3D_NAO_ABRIU', 'CENA_3D_VAZIA',
    ...PADROES_3D.map((p) => `### \`${p}\``)]) {
    assert.ok(secao.includes(trecho), `seção de 3D sem "${trecho}"`);
  }
  // o limite escrito é o mesmo que o checar aplica
  return import('../scripts/lib/peso-3d.mjs').then(({ LIMITE_3D }) => {
    assert.equal(LIMITE_3D.js_kb_comprimido, 200);
    assert.equal(LIMITE_3D.modelo_kb, 1536);
  });
});

test('as skills levam o 3D: a novo-site escolhe e constrói pela regra, a revisar confere', () => {
  for (const pasta of ['.claude', '.agents']) {
    const site = fs.readFileSync(path.join(RAIZ, pasta, 'skills', 'novo-site', 'SKILL.md'), 'utf8');
    for (const trecho of ['**3D só com prova e com limite.**', '`configurador-3d`', '`marca-em-3d`', '"Quando não usar"', '--demo 3d', '`3d-pesado`', 'CENA_3D_NAO_ABRIU', '--reduzido']) {
      assert.ok(site.includes(trecho), `${pasta} novo-site sem "${trecho}"`);
    }
    const revisar = fs.readFileSync(path.join(RAIZ, pasta, 'skills', 'revisar', 'SKILL.md'), 'utf8');
    for (const trecho of ['CENA_3D_NAO_ABRIU', 'CENA_3D_VAZIA', '3D: só com prova e com limite', 'Se há 3D']) {
      assert.ok(revisar.includes(trecho), `${pasta} revisar sem "${trecho}"`);
    }
  }
});

test('o repertório é só texto: nenhum print, foto ou logo de marca no estúdio', () => {
  for (const nome of fs.readdirSync(PASTA)) {
    assert.ok(fs.statSync(path.join(PASTA, nome)).isFile(), `${nome} é pasta`);
    assert.ok(nome.endsWith('.json') || nome.endsWith('.md'), `${nome} não é texto`);
  }
});

test('a conferência de ficha acusa campo de print, link inseguro, imagem, dúvida sem pergunta, jeito inexistente e travessão', () => {
  const boa = todasAsFichas()[0];
  const { acao, ...base } = boa;
  assert.ok(acao);
  assert.deepEqual(problemasDaFicha(base), []);
  const com = (mudanca) => problemasDaFicha({ ...base, ...mudanca });
  assert.equal(problemasDaFicha({ ...base, print: 'tela.png' }).length, 1);
  assert.ok(com({ link: 'http://exemplo.com.br/' }).includes('link sem https'));
  assert.ok(com({ link: 'https://exemplo.com.br/?utm=1' }).includes('link com ? ou #'));
  assert.ok(com({ link: 'https://exemplo.com.br/capa.jpg' }).includes('link aponta para imagem'));
  assert.ok(com({ link: 'https://10.0.0.1/' }).includes('link sem domínio público'));
  assert.ok(com({ duvida: 'Quanto custa.' }).some((p) => p.startsWith('duvida não termina')));
  assert.ok(com({ principio: 'Veja o print em tela.webp.' }).includes('principio cita arquivo de imagem'));
  assert.ok(com({ comoFazemosAqui: { padrao: 'mapa-embutido', texto: 'Mapa na página.' } }).includes('padrao "mapa-embutido" não existe'));
  assert.ok(com({ naoTrazer: `A marca ${'—'} toda.` }).includes('naoTrazer tem travessão'));
  assert.ok(com({ id: 'Com Espaco' }).some((p) => p.startsWith('id fora')));
});

test('a skill novo-site escolhe pela ação e pela dúvida, com 2 de outro ramo, e confere ao vivo só as escolhidas', () => {
  for (const pasta of ['.claude', '.agents']) {
    const skill = fs.readFileSync(path.join(RAIZ, pasta, 'skills', 'novo-site', 'SKILL.md'), 'utf8');
    const inicio = skill.indexOf('## Etapa 3.');
    const etapa3 = skill.slice(inicio, skill.indexOf('## Etapa 4.'));
    assert.ok(inicio !== -1 && etapa3.length > 0, `${pasta}: sem a etapa 3`);
    for (const trecho of ['kit/repertorio/como-usar.md', 'ação principal', 'dúvida', 'só contexto', '2 de outro ramo', 'celular', 'ao vivo', 'Nunca abra todas', 'só o endereço',
      '`ondeVer`', 'recusa leitura automática', 'não saiu do ar', 'chamar no WhatsApp', 'Da ação do brief ao arquivo']) {
      assert.ok(etapa3.includes(trecho), `${pasta}: etapa 3 sem "${trecho}"`);
    }
  }
  const molde = fs.readFileSync(path.join(KIT, 'molde', 'referencias.md'), 'utf8');
  for (const coluna of ['Endereço', 'Ramo', 'Motivo', 'Princípio', 'Como fazemos aqui', 'No celular', 'Conferida ao vivo em']) {
    assert.ok(molde.includes(coluna), `molde/referencias.md sem a coluna ${coluna}`);
  }
  assert.equal(molde.toLowerCase().includes('print'), false, 'molde/referencias.md ainda pede print');
});

test('o repertório chega pela atualização: o kit nunca é pasta preservada', async () => {
  const { PRESERVADOS } = await import('../scripts/lib/atualizacao.mjs');
  assert.equal(PRESERVADOS.includes('kit'), false);
  assert.ok(PRESERVADOS.includes('referencias'), 'a pasta referencias/ da pessoa continua preservada');
});

// Linhas da tabela que vem logo depois do título, sem o cabeçalho: [[célula, célula], ...].
function tabelaDepois(texto, titulo) {
  const inicio = texto.indexOf(titulo);
  if (inicio === -1) return [];
  const linhas = texto.slice(inicio).split('\n').slice(1);
  const primeira = linhas.findIndex((l) => l.startsWith('|'));
  if (primeira === -1) return [];
  const fim = linhas.findIndex((l, i) => i > primeira && !l.startsWith('|'));
  return linhas.slice(primeira + 2, fim === -1 ? undefined : fim)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

test('toda ação que o brief oferece, inclusive ligar e chamar no WhatsApp, leva a um arquivo do repertório', () => {
  const guia = fs.readFileSync(path.join(PASTA, 'como-usar.md'), 'utf8');
  const linhas = tabelaDepois(guia, '## Da ação do brief ao arquivo');
  assert.ok(linhas.length >= ACOES.length, 'como-usar.md sem a tabela "Da ação do brief ao arquivo"');
  for (const [acao, destino] of linhas) {
    const citados = ACOES.filter((a) => destino.includes(`\`${a}.json\``));
    assert.ok(citados.length >= 1, `"${acao}" não leva a nenhum arquivo do repertório`);
  }
  const brief = fs.readFileSync(path.join(KIT, 'molde', 'brief.md'), 'utf8');
  const exemplo = brief.slice(brief.indexOf('O que a pessoa faz ao abrir o site ('));
  const oferecidas = exemplo.slice(exemplo.indexOf('(') + 1, exemplo.indexOf(')')).split(', ');
  assert.ok(oferecidas.includes('chamar no WhatsApp') && oferecidas.includes('ligar'), oferecidas.join(', '));
  const naTabela = linhas.map(([acao]) => acao.toLowerCase());
  for (const a of oferecidas) assert.ok(naTabela.some((c) => c.includes(a.toLowerCase())), `a ação "${a}" do brief não está na tabela`);
  for (const a of ACOES) assert.ok(linhas.some(([, destino]) => destino.includes(`\`${a}.json\``)), `nenhuma ação do brief leva a ${a}.json`);
});

test('o como-usar manda seguir o ondeVer e separa site que recusa leitor de site fora do ar', () => {
  const guia = fs.readFileSync(path.join(PASTA, 'como-usar.md'), 'utf8');
  for (const trecho of ['`ondeVer`', 'recusa leitura automática', 'não saiu do ar', '403', 'links-do-repertorio.mjs', 'Quando nenhuma ficha serve']) {
    assert.ok(guia.includes(trecho), `como-usar.md sem "${trecho}"`);
  }
});

test('o AGENTS.md admite a busca fora do repertório quando nenhuma ficha serve, como o como-usar', () => {
  for (const nome of ['AGENTS.md', 'CLAUDE.md']) {
    const texto = fs.readFileSync(path.join(RAIZ, nome), 'utf8');
    const regra = texto.slice(texto.indexOf('**Referência é princípio, não cópia.**')).split('\n')[0];
    assert.ok(regra.includes('kit/repertorio/') && regra.includes('nenhuma ficha serve'), `${nome}: ${regra}`);
  }
});
