// Instagram com login, sem navegador e sem Instagram de verdade: as 40 publicações e a maior foto
// saem do JSON de exemplo; a sessão é reconhecida pela lista de cookies; verificação e volta para a
// página de entrar são reconhecidas pelo endereço; "sair" apaga o perfil guardado; os textos novos
// não têm jargão (o texto de toda mensagem também passa pelo filtro de conversa.test.mjs).
// Sem expressão regular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { postsDoJson, itensDoJson, bloqueioDoEndereco, respostaDaLeitura, lerInstagramComLogin, limiteDePosts, MAXIMO_COM_LOGIN } from '../scripts/lib/ler-instagram-login.mjs';
import { temSessao, semJanela, abrirLeitorComLogin } from '../scripts/lib/instagram-conta.mjs';
import { lugarPadrao, perfilEmUso, sairDaConta, criarPerfil, migrarPerfilAntigo, gravarPausa, pausadoHoje, registrarParada, pastaDeDados, idDoEstudio } from '../scripts/lib/instagram-lugar.mjs';
import { detalheDoErro, lerFontes } from '../scripts/lib/ler.mjs';
import { acharNavegadorComJanela } from '../scripts/lib/chrome.mjs';
import { KitErro } from '../scripts/lib/saida.mjs';
import { argumentosDoNavegador } from '../scripts/lib/cdp.mjs';
import { EH_MAC, EH_WINDOWS } from '../scripts/lib/caminhos.mjs';
import { respostaDaGrade, itemLogado, USUARIO_LOGADO, USUARIO_DESAFIO, TOTAL_LOGADO, LARGURA_MAIOR, PROTECAO, codigoLogado, codigoDesafio } from './fixtures/instagram-logado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MENSAGENS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'kit', 'mensagens.json'), 'utf8'));
const ORIGEM = 'https://www.instagram.com';
const AGORA = Date.UTC(2026, 10, 24);

test('com login: 40 publicações do JSON, da mais nova para a mais antiga, cada foto na maior largura', () => {
  // as 45 publicações em quatro respostas, uma delas com a proteção na frente
  const textos = [
    JSON.stringify({ require: [[respostaDaGrade(1, 12, ORIGEM)]] }),
    PROTECAO + JSON.stringify(respostaDaGrade(13, 12, ORIGEM)),
    JSON.stringify(respostaDaGrade(25, 12, ORIGEM)),
    JSON.stringify(respostaDaGrade(37, 12, ORIGEM)),
  ];
  assert.equal(itensDoJson(textos, USUARIO_LOGADO).size, TOTAL_LOGADO, 'a publicação de outro perfil não entra');
  const posts = postsDoJson(textos, USUARIO_LOGADO, { base: ORIGEM });
  assert.equal(posts.length, MAXIMO_COM_LOGIN);
  assert.deepEqual(posts.map((p) => p.codigo), Array.from({ length: 40 }, (_, i) => codigoLogado(i + 1)));
  for (const p of posts) {
    assert.ok(p.legenda.startsWith('Legenda logada '), p.codigo);
    assert.equal(p.data.length, 10, p.codigo);
    assert.equal(p.de, 'json');
    assert.equal(p.url, `${ORIGEM}/p/${p.codigo}/`);
    assert.ok(p.fotos.length >= 1, p.codigo);
    for (const f of p.fotos) {
      assert.equal(f.largura, LARGURA_MAIOR, `${p.codigo}: a maior das três, fora de ordem`);
      assert.ok(f.largura >= 1080);
      assert.ok(f.url.endsWith(`-${LARGURA_MAIOR}.jpg`), f.url);
    }
  }
  const carrossel = posts.find((p) => p.codigo === codigoLogado(3));
  assert.equal(carrossel.fotos.length, 2, 'carrossel: uma foto por parte, e a parte não vira publicação');
  assert.ok(!posts.some((p) => p.codigo === 'Outro99'));
});

test('com login: texto quebrado ou vazio não derruba, e sem dono no item a publicação entra', () => {
  assert.equal(postsDoJson(['', '{quebrado', PROTECAO, 'null'], USUARIO_LOGADO).length, 0);
  const semDono = { ...itemLogado(1, ORIGEM) };
  delete semDono.user;
  assert.equal(postsDoJson([JSON.stringify({ items: [semDono] })], USUARIO_LOGADO).length, 1);
  const outro = itemLogado(2, ORIGEM, { usuario: 'Outra.Casa' });
  assert.equal(postsDoJson([JSON.stringify({ items: [outro] })], USUARIO_LOGADO).length, 0);
  assert.equal(postsDoJson([JSON.stringify({ items: [outro] })], 'outra.casa').length, 1, 'o @ é comparado sem maiúscula');
});

test('sessão: só o cookie sessionid do Instagram, com valor e ainda válido', () => {
  const cookie = (extra) => ({ name: 'sessionid', value: 'abc', domain: '.instagram.com', expires: AGORA / 1000 + 3600, ...extra });
  assert.equal(temSessao([cookie()], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ domain: 'www.instagram.com' })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ domain: 'instagram.com' })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ expires: -1 })], { agora: AGORA }), true, 'vale até fechar o navegador');
  assert.equal(temSessao([cookie({ session: true, expires: 0 })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ expires: AGORA / 1000 - 1 })], { agora: AGORA }), false, 'vencido');
  assert.equal(temSessao([cookie({ value: '' })], { agora: AGORA }), false, 'sem valor');
  assert.equal(temSessao([cookie({ name: 'csrftoken' })], { agora: AGORA }), false, 'outro cookie');
  assert.equal(temSessao([cookie({ domain: '.instagram.com.example' })], { agora: AGORA }), false, 'outro site');
  assert.equal(temSessao([cookie({ domain: '.notinstagram.com' })], { agora: AGORA }), false, 'outro site com o nome dentro');
  assert.equal(temSessao([], { agora: AGORA }), false);
  assert.equal(temSessao(null), false);
  assert.equal(temSessao([cookie({ domain: '127.0.0.1' })], { dominio: '127.0.0.1', agora: AGORA }), true);
});

test('verificação e página de entrar: reconhecidas pelo endereço, o resto é página normal', () => {
  const casos = [
    ['https://www.instagram.com/challenge/AbC/?next=/', 'verificacao'],
    ['https://www.instagram.com/challenge/', 'verificacao'],
    ['https://www.instagram.com/auth_platform/codeentry/?apc=x', 'verificacao'],
    ['https://www.instagram.com/checkpoint/123/', 'verificacao'],
    ['https://www.instagram.com/accounts/suspended/?next=/', 'verificacao'],
    ['https://www.instagram.com/accounts/disabled/', 'verificacao'],
    ['https://www.instagram.com/accounts/login/?next=%2Fcasa%2F', 'login'],
    ['https://www.instagram.com/Accounts/Login/', 'login'],
    ['https://www.instagram.com/accounts/emailsignup/', 'login'],
    ['https://www.instagram.com/casa.logada/', ''],
    ['https://www.instagram.com/casa.logada/p/Clg01/', ''],
    ['https://www.instagram.com/challenge.casa/', '', 'um perfil com a palavra no nome não é verificação'],
    ['https://www.instagram.com/casa/challenge/', '', 'só o começo do endereço conta'],
    ['https://www.instagram.com/accounts/onetap/?next=/', ''],
    ['não é endereço', ''],
  ];
  for (const [href, esperado, porque] of casos) assert.equal(bloqueioDoEndereco(href), esperado, porque || href);
});

test('respostas guardadas: só as de dados do próprio Instagram', () => {
  const aceita = respostaDaLeitura(ORIGEM);
  assert.equal(aceita('https://www.instagram.com/graphql/query', 'text/javascript'), true);
  assert.equal(aceita('https://www.instagram.com/api/graphql', 'application/json'), true);
  assert.equal(aceita('https://www.instagram.com/api/v1/feed/user/1/', 'application/json'), true);
  assert.equal(aceita('https://www.instagram.com/casa/', 'text/html'), false);
  assert.equal(aceita('https://scontent.cdninstagram.com/v/foto.jpg', 'image/jpeg'), false);
  assert.equal(aceita('https://outro.example/graphql/query', 'application/json'), false);
  assert.equal(aceita('não é endereço', 'application/json'), false);
});

test('janela fechada: nenhuma aba de página aberta', () => {
  assert.equal(semJanela([{ type: 'browser' }, { type: 'service_worker' }]), true);
  assert.equal(semJanela([]), true);
  assert.equal(semJanela(undefined), true);
  assert.equal(semJanela([{ type: 'page', url: 'https://www.instagram.com/accounts/login/' }]), false);
});

test('navegador: a janela é um Chrome normal; o perfil guardado não usa o chaveiro do sistema', () => {
  const base = { caminho: '/x/Google Chrome', porta: 9222, perfil: '/p', largura: 1100, altura: 900 };
  const janela = argumentosDoNavegador({ ...base, comJanela: true, guardado: true });
  assert.ok(!janela.some((a) => a.startsWith('--headless')), 'com janela, nada de modo escondido');
  assert.ok(janela.includes('--user-data-dir=/p'));
  const escondido = argumentosDoNavegador({ ...base, guardado: true });
  assert.ok(escondido.includes('--headless=new'));
  // a janela e a leitura escondida precisam da mesma chave para o login de uma valer na outra
  const chave = (lista) => lista.filter((a) => a === '--use-mock-keychain' || a === '--password-store=basic');
  assert.deepEqual(chave(janela), chave(escondido));
  if (EH_MAC) assert.deepEqual(chave(janela), ['--use-mock-keychain']);
  else if (!EH_WINDOWS) assert.deepEqual(chave(janela), ['--password-store=basic']);
  const temporario = argumentosDoNavegador(base);
  assert.deepEqual(chave(temporario), [], 'o navegador de sempre continua igual');
});

function rodarEstudio(args, env) {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const linhas = r.stdout.trim().split('\n');
  return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
}

// Pastas temporárias no lugar da pasta de dados e da .ferramentas: nada encosta no login de verdade.
function ambiente(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const env = { ESTUDIO_DADOS: path.join(base, 'dados'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') };
  return { base, env, lugar: lugarPadrao(env) };
}

const recusa = (codigo) => (e) => e instanceof KitErro && e.codigo === codigo;

test('lugar do login: na pasta de dados do usuário, um por pasta de estúdio, fora da pasta do estúdio', () => {
  const casa = path.join(os.tmpdir(), 'casa-de-teste');
  const dados = pastaDeDados({ HOME: casa, LOCALAPPDATA: path.join(casa, 'Local'), XDG_DATA_HOME: '' });
  if (EH_MAC) assert.equal(dados, path.join(casa, 'Library', 'Application Support', 'site-estudio'));
  else if (EH_WINDOWS) assert.equal(dados, path.join(casa, 'Local', 'site-estudio'));
  else assert.equal(dados, path.join(casa, '.local', 'share', 'site-estudio'));
  if (!EH_MAC && !EH_WINDOWS) assert.equal(pastaDeDados({ HOME: casa, XDG_DATA_HOME: '/xdg' }), path.join('/xdg', 'site-estudio'));
  assert.equal(idDoEstudio(RAIZ), idDoEstudio(RAIZ), 'estável');
  assert.notEqual(idDoEstudio(RAIZ), idDoEstudio(path.join(RAIZ, 'outro')), 'outra pasta de estúdio, outro login');
  assert.equal(idDoEstudio(RAIZ).length, 12);
  const lugar = lugarPadrao({ ESTUDIO_DADOS: '/d', ESTUDIO_FERRAMENTAS: '/f' });
  assert.equal(lugar.perfil, path.join(path.resolve('/d'), 'instagram', idDoEstudio(RAIZ), 'perfil'));
  assert.equal(lugar.antigo, path.join(path.resolve('/f'), 'instagram', 'perfil'));
  assert.ok(!lugarPadrao({}).perfil.startsWith(RAIZ), 'o login não mora dentro da pasta do estúdio');
});

test('perfil antigo (.ferramentas/instagram/perfil) muda de lugar uma vez; com o novo já existindo, fica', (t) => {
  const { lugar } = ambiente(t);
  fs.mkdirSync(path.join(lugar.antigo, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(lugar.antigo, 'Default', 'Cookies'), 'login antigo');
  assert.equal(migrarPerfilAntigo(lugar), true);
  assert.equal(fs.readFileSync(path.join(lugar.perfil, 'Default', 'Cookies'), 'utf8'), 'login antigo');
  assert.equal(fs.existsSync(lugar.antigo), false);
  fs.mkdirSync(lugar.antigo, { recursive: true });
  assert.equal(migrarPerfilAntigo(lugar), false, 'o novo já existe: não sobrescreve');
  assert.equal(fs.existsSync(lugar.antigo), true);
});

test('sair apaga o perfil guardado inteiro e confirma; sem login guardado, diz que não havia', (t) => {
  const { env, lugar } = ambiente(t);
  fs.mkdirSync(path.join(lugar.perfil, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(lugar.perfil, 'Default', 'Cookies'), 'cookies do perfil');
  const r = rodarEstudio(['instagram', 'sair'], env);
  assert.deepEqual([r.codigo, r.json.ok, r.json.codigo, r.json.dados.tinha_login], [0, true, 'INSTAGRAM_SAIU', true]);
  assert.equal(r.json.resumo, MENSAGENS.INSTAGRAM_SAIU.texto);
  assert.equal(fs.existsSync(lugar.perfil), false);
  assert.equal(fs.existsSync(lugar.conta), true, 'só o perfil sai');
  const deNovo = rodarEstudio(['instagram', 'sair'], env);
  assert.deepEqual([deNovo.codigo, deNovo.json.codigo, deNovo.json.dados.tinha_login], [0, 'INSTAGRAM_SAIU', false]);
  // o perfil que ainda estava no lugar antigo também sai (muda e é apagado)
  fs.mkdirSync(lugar.antigo, { recursive: true });
  const antigo = rodarEstudio(['instagram', 'sair'], env);
  assert.deepEqual([antigo.json.codigo, antigo.json.dados.tinha_login], ['INSTAGRAM_SAIU', true]);
  assert.equal(fs.existsSync(lugar.antigo), false);
});

const SEM_ATALHO = EH_WINDOWS ? 'atalho de pasta pede permissão no Windows' : false;

test('atalho no lugar do perfil, ou num pedaço do caminho acima dele: recusa e não apaga nada do outro lado', { skip: SEM_ATALHO }, (t) => {
  const { base, lugar } = ambiente(t);
  const fora = path.join(base, 'fora');
  fs.mkdirSync(fora);
  fs.writeFileSync(path.join(fora, 'importante.txt'), 'fica');
  // o próprio perfil é atalho
  fs.mkdirSync(lugar.conta, { recursive: true });
  fs.symlinkSync(fora, lugar.perfil, 'dir');
  assert.throws(() => sairDaConta(lugar), recusa('INSTAGRAM_CAMINHO_ESTRANHO'));
  assert.throws(() => criarPerfil(lugar), recusa('INSTAGRAM_CAMINHO_ESTRANHO'));
  assert.equal(fs.readFileSync(path.join(fora, 'importante.txt'), 'utf8'), 'fica');
  // a pasta da conta (pai do perfil) é atalho para outro lugar que tem um "perfil"
  fs.rmSync(path.join(lugar.dados, 'instagram'), { recursive: true });
  fs.mkdirSync(path.join(fora, 'perfil'));
  fs.writeFileSync(path.join(fora, 'perfil', 'importante.txt'), 'fica');
  fs.mkdirSync(path.join(lugar.dados, 'instagram'), { recursive: true });
  fs.symlinkSync(fora, lugar.conta, 'dir');
  assert.throws(() => sairDaConta(lugar), recusa('INSTAGRAM_CAMINHO_ESTRANHO'));
  assert.throws(() => criarPerfil(lugar), recusa('INSTAGRAM_CAMINHO_ESTRANHO'));
  assert.throws(() => gravarPausa(lugar, 'verificacao', '2026-11-24'), recusa('INSTAGRAM_CAMINHO_ESTRANHO'));
  assert.equal(fs.readFileSync(path.join(fora, 'perfil', 'importante.txt'), 'utf8'), 'fica');
  // pelo atalho, o comando também recusa
  const r = rodarEstudio(['instagram', 'sair'], { ESTUDIO_DADOS: lugar.dados, ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') });
  assert.deepEqual([r.codigo, r.json.codigo], [1, 'INSTAGRAM_CAMINHO_ESTRANHO']);
});

test('perfil em uso: só consulta; trava de um Chrome vivo vale, trava velha não, e nada é apagado', (t) => {
  const { base } = ambiente(t);
  const perfil = path.join(base, 'perfil');
  fs.mkdirSync(perfil);
  assert.equal(perfilEmUso(perfil), false, 'sem trava');
  // trava do Windows sem Chrome segurando: livre, e o arquivo continua lá
  fs.writeFileSync(path.join(perfil, 'lockfile'), '');
  assert.equal(perfilEmUso(perfil), false);
  assert.equal(fs.existsSync(path.join(perfil, 'lockfile')), true, 'consultar não apaga');
  if (EH_WINDOWS) return;
  const trava = path.join(perfil, 'SingletonLock');
  fs.symlinkSync(`computador-de-teste-${process.pid}`, trava);
  assert.equal(perfilEmUso(perfil), true, 'o processo existe');
  fs.unlinkSync(trava);
  fs.symlinkSync('computador-de-teste-2147483646', trava);
  assert.equal(perfilEmUso(perfil), false, 'processo que não existe mais');
  assert.equal(fs.lstatSync(trava).isSymbolicLink(), true, 'consultar não apaga');
});

test('verificação grava a pausa do dia: nesse dia, nada de login (leitura nem janela); no dia seguinte, volta', async (t) => {
  const { env, lugar } = ambiente(t);
  fs.mkdirSync(lugar.perfil, { recursive: true });
  assert.equal(registrarParada([{ codigo: 'LER_OK' }], lugar, '2026-11-24'), false);
  assert.equal(registrarParada([{ codigo: 'LER_INSTAGRAM_PEDIU_VERIFICACAO', dados: { motivo: 'verificacao', lidas: 3 } }], lugar, '2026-11-24'), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(lugar.pausa, 'utf8')), { motivo: 'verificacao', data: '2026-11-24' });
  assert.equal(pausadoHoje(lugar, '2026-11-24'), true);
  assert.equal(pausadoHoje(lugar, '2026-11-25'), false);
  // nem abre o Chrome: devolve antes
  assert.deepEqual(await abrirLeitorComLogin({ lugar, data: '2026-11-24', navegador: { caminho: '/nao/existe' } }), { motivo: 'pausado' });
  if (acharNavegadorComJanela()) {
    gravarPausa(lugar, 'login');
    const r = rodarEstudio(['instagram', 'entrar', '--confirmar'], env);
    assert.deepEqual([r.codigo, r.json.codigo], [1, 'INSTAGRAM_PAUSADO_HOJE']);
  }
  // sair não tira a pausa: entrar de novo no mesmo dia continua parado
  sairDaConta(lugar);
  assert.equal(fs.existsSync(lugar.pausa), true);
});

test('entrar sem --confirmar só devolve o aviso: não abre o Chrome nem olha o login guardado', { skip: acharNavegadorComJanela() ? false : 'sem Chrome instalado' }, (t) => {
  const { env, lugar } = ambiente(t);
  const r = rodarEstudio(['instagram', 'entrar'], env);
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.entrou], [0, 'INSTAGRAM_ANTES_DE_ENTRAR', false]);
  assert.equal(fs.existsSync(lugar.dados), false, 'nada criado');
});

test('instagram sem o que fazer, ou com uma ação que não existe, explica o que falta', (t) => {
  const { env } = ambiente(t);
  const sem = rodarEstudio(['instagram'], env);
  assert.deepEqual([sem.codigo, sem.json.codigo], [1, 'ARGUMENTO_FALTANDO']);
  const ruim = rodarEstudio(['instagram', 'senha'], env);
  assert.deepEqual([ruim.codigo, ruim.json.codigo, ruim.json.dados.opcoes], [1, 'ARGUMENTO_INVALIDO', ['entrar', 'sair']]);
});

test('com login, nunca mais de 40 publicações; sem login, o pedido ou 24', () => {
  assert.equal(limiteDePosts(0, true), 40);
  assert.equal(limiteDePosts(60, true), 40);
  assert.equal(limiteDePosts(10, true), 10);
  assert.equal(limiteDePosts(0, false), 24);
  assert.equal(limiteDePosts(60, false), 60);
});

test('o erro que sai na leitura não traz o endereço do DevTools nem segredo', () => {
  const longo = 'a'.repeat(40);
  const d = detalheDoErro(new Error(`falhou ws://127.0.0.1:9333/devtools/browser/1234-abcd e http://127.0.0.1:9333/json\nchave ${longo} fim`));
  assert.ok(!d.includes('ws://') && !d.includes('9333') && !d.includes('devtools'), d);
  assert.ok(!d.includes(longo), d);
  assert.ok(d.includes('falhou') && d.includes('fim'), d);
  assert.ok(detalheDoErro('x'.repeat(1000)).length <= 300);
});

// Leitor de mentira: a grade com os links, o JSON da página, e cada publicação aberta pela etiqueta.
function leitorFalso({ links, jsonsDePosts = [], caiEm = [] }) {
  let atual = '';
  const visitas = [];
  return {
    visitas,
    ir: async (url) => {
      visitas.push(url);
      if (caiEm.some((c) => url.includes(c))) throw new Error('a página caiu');
      atual = url;
    },
    endereco: async () => atual,
    avaliar: async (fn) => (fn.name === 'lerPerfilNaPagina' ? { links, jsons: [], jsonsDePosts, descricao: '' } : true),
    esperarAte: async (fn) => (fn.name === 'contarLinks' ? links.length : { jsons: [], datas: ['2026-11-01T12:00:00Z'], descricao: 'x: "legenda lida"', foto: 'https://exemplo.invalid/f.jpg' }),
    escutarRespostas: () => ({ textos: async () => [], parar: () => {} }),
  };
}

const BASE_FALSA = 'https://instagram.exemplo.invalid';
const linksDoDesafio = (n) => Array.from({ length: n }, (_, i) => `${BASE_FALSA}/${USUARIO_DESAFIO}/p/${codigoDesafio(i + 1)}/`);

test('com login: uma publicação que falha não derruba as outras', async () => {
  const leitor = leitorFalso({ links: linksDoDesafio(5), caiEm: [codigoDesafio(2)] });
  const r = await lerInstagramComLogin(leitor, USUARIO_DESAFIO, { base: BASE_FALSA, pausa: 0 });
  assert.deepEqual(r.posts.map((p) => p.codigo), [1, 3, 4, 5].map(codigoDesafio));
  assert.deepEqual(r.falhas, [codigoDesafio(2)]);
  assert.equal(r.prazo, false);
  assert.ok(r.posts.every((p) => p.legenda === 'legenda lida'));
});

test('com login: o prazo acaba, a leitura para e devolve o que já tinha, sem abrir mais páginas', async () => {
  const itens = [1, 2].map((n) => itemLogado(n, BASE_FALSA, { usuario: USUARIO_DESAFIO, codigo: codigoDesafio(n) }));
  const leitor = leitorFalso({ links: linksDoDesafio(5), jsonsDePosts: [JSON.stringify({ items: itens })] });
  const r = await lerInstagramComLogin(leitor, USUARIO_DESAFIO, { base: BASE_FALSA, pausa: 0, prazoMs: 0 });
  assert.equal(r.prazo, true);
  assert.deepEqual(r.posts.map((p) => p.codigo), [codigoDesafio(1), codigoDesafio(2)]);
  assert.deepEqual(leitor.visitas, [`${BASE_FALSA}/${USUARIO_DESAFIO}/`], 'só a grade');
});

const NOVOS = Object.freeze([
  'INSTAGRAM_ANTES_DE_ENTRAR', 'INSTAGRAM_JA_ENTROU', 'INSTAGRAM_ENTROU', 'INSTAGRAM_JANELA_FECHADA', 'INSTAGRAM_PRAZO_ACABOU',
  'INSTAGRAM_ENTRAR_FALHOU', 'INSTAGRAM_PAUSADO_HOJE', 'INSTAGRAM_SEM_CHROME', 'INSTAGRAM_LOGIN_EM_USO', 'INSTAGRAM_CAMINHO_ESTRANHO',
  'INSTAGRAM_SAIU', 'INSTAGRAM_SAIR_FALHOU', 'LER_INSTAGRAM_PEDIU_VERIFICACAO', 'LER_INSTAGRAM_LOGIN_INDISPONIVEL',
  'LER_INSTAGRAM_PARCIAL', 'LER_INSTAGRAM_POUCOS', 'LER_INSTAGRAM_FALHOU',
]);

test('com login, prazo acabado: o ler guarda o que leu e avisa que parou no meio', async (t) => {
  const { base } = ambiente(t);
  const itens = [1, 2].map((n) => itemLogado(n, BASE_FALSA, { usuario: USUARIO_DESAFIO, codigo: codigoDesafio(n) }));
  const leitor = leitorFalso({ links: linksDoDesafio(5), jsonsDePosts: [JSON.stringify({ items: itens })] });
  const coleta = path.join(base, 'coleta');
  const r = await lerFontes({ instagram: USUARIO_DESAFIO, posts: 40 }, { pasta: coleta, fatos: path.join(base, 'fatos.md'), leitor, leitorInstagram: leitor, bases: { instagram: BASE_FALSA }, pausa: 0, prazoComLoginMs: 0, data: '2026-11-24' });
  assert.deepEqual(r.avisos.find((a) => a.codigo === 'LER_INSTAGRAM_PARCIAL').dados, { lidas: 2 });
  assert.equal(JSON.parse(fs.readFileSync(path.join(coleta, 'instagram', 'posts.json'), 'utf8')).length, 2);
});

test('mensagens do login: existem, sem jargão, e o aviso antes de entrar diz o que a pessoa precisa saber', () => {
  const proibidas = ['pasta', 'comando', 'zip', 'json', 'nota', 'rodada', 'preflight', 'cookie', 'sessionid'];
  for (const codigo of NOVOS) {
    const m = MENSAGENS[codigo];
    assert.ok(m, `${codigo} falta em mensagens.json`);
    for (const campo of ['texto', 'acao']) {
      const texto = m[campo].toLowerCase();
      for (const p of proibidas) assert.ok(!texto.includes(p), `${codigo}.${campo} tem "${p}"`);
    }
  }
  const antes = MENSAGENS.INSTAGRAM_ANTES_DE_ENTRAR.texto;
  for (const trecho of ['alguém entrou na sua conta', 'estúdio', 'janela que você abriu', 'senha', 'direto no Instagram']) assert.ok(antes.includes(trecho), trecho);
  assert.ok(MENSAGENS.INSTAGRAM_ANTES_DE_ENTRAR.acao.includes('--confirmar'), 'a janela só abre com o sim');
  // toda saída da leitura sem conseguir oferece a reserva
  for (const codigo of ['LER_INSTAGRAM_PEDIU_VERIFICACAO', 'LER_INSTAGRAM_POUCOS', 'LER_INSTAGRAM_FALHOU', 'LER_INSTAGRAM_LOGIN_INDISPONIVEL']) {
    assert.ok(MENSAGENS[codigo].acao.includes('extensão do Claude no Chrome'), codigo);
  }
  assert.ok(MENSAGENS.LER_INSTAGRAM_PEDIU_VERIFICACAO.texto.includes('até amanhã'), 'depois da verificação, não insiste');
  assert.ok(MENSAGENS.INSTAGRAM_ANTES_DE_ENTRAR.acao.includes('Vou abrir'), 'diz antes de abrir, não depois');
  assert.ok(MENSAGENS.INSTAGRAM_JA_ENTROU.texto.includes('já está guardado aqui no estúdio'));
  assert.ok(MENSAGENS.INSTAGRAM_PRAZO_ACABOU.texto.includes('quase 9 minutos'));
  assert.ok(!MENSAGENS.INSTAGRAM_LOGIN_EM_USO.texto.includes('Feche'), 'pode estar rodando sem janela');
  assert.ok(MENSAGENS.INSTAGRAM_SAIR_FALHOU.texto.includes('feche o Chrome') || MENSAGENS.INSTAGRAM_SAIR_FALHOU.texto.includes('Feche o Chrome'));
});
