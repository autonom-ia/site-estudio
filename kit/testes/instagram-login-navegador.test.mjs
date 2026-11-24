// Instagram com login, de ponta a ponta no navegador, contra páginas SINTÉTICAS servidas aqui mesmo
// (fixtures/instagram-logado.mjs), sem conta e sem Instagram de verdade:
// - a leitura logada rola a grade, guarda as respostas que a página pede e traz 40 publicações com a
//   foto de 1440, sem abrir a página de nenhuma;
// - verificação e volta para a página de entrar param a leitura no primeiro sinal;
// - o login guardado no perfil sobrevive a fechar e abrir o navegador (Chrome do sistema, sem janela);
// - de ponta a ponta com o leitor de login de verdade (abrirLeitorComLogin): a página só mostra a
//   grade com o cookie de sessão gravado no perfil; sem ele, vai para a página de entrar.
// Pula sem navegador. A janela VISÍVEL só abre com ESTUDIO_TESTAR_JANELA=1 e fora do CI: ela aparece
// na tela de quem roda o teste.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { acharNavegador, acharNavegadorComJanela } from '../scripts/lib/chrome.mjs';
import { abrirLeitor } from '../scripts/lib/leitor.mjs';
import { launch, conectarNavegador } from '../scripts/lib/cdp.mjs';
import { lerFontes } from '../scripts/lib/ler.mjs';
import { lerInstagramComLogin } from '../scripts/lib/ler-instagram-login.mjs';
import { esperarEntrar, temLoginSalvo, abrirLeitorComLogin, sairDaConta } from '../scripts/lib/instagram-conta.mjs';
import { lugarPadrao } from '../scripts/lib/instagram-lugar.mjs';
import { servirInstagramLogado, USUARIO_LOGADO, USUARIO_DESAFIO, USUARIO_SAIU, LARGURA_MAIOR, codigoDesafio } from './fixtures/instagram-logado.mjs';

const SEM_NAVEGADOR = !acharNavegador();
const opcoes = { skip: SEM_NAVEGADOR ? 'sem Chrome, Edge ou Chromium nesta máquina' : false, timeout: 240000 };
const CHROME = acharNavegadorComJanela();
const opcoesDoSistema = { skip: CHROME ? false : 'sem Chrome, Edge ou Chromium instalado', timeout: 120000 };
const QUER_JANELA = process.env.ESTUDIO_TESTAR_JANELA === '1' && !process.env.CI;
const opcoesDaJanela = { skip: CHROME && QUER_JANELA ? false : 'janela visível só com ESTUDIO_TESTAR_JANELA=1, fora do CI', timeout: 120000 };
const DATA = '2026-11-24';

let srv;
let leitor;
let pasta;

before(async () => {
  if (SEM_NAVEGADOR) return;
  srv = await servirInstagramLogado();
  leitor = await abrirLeitor();
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-logado-'));
});

after(async () => {
  leitor?.fechar();
  await srv?.fechar();
  if (pasta) fs.rmSync(pasta, { recursive: true, force: true });
});

const paginasDePost = () => srv.pedidos.filter((p) => p.includes('/p/'));

test('com login: rola a grade e lê 40 publicações das respostas da página, foto de 1440, sem abrir nenhuma', opcoes, async () => {
  srv.pedidos.length = 0;
  const destino = path.join(pasta, 'logado');
  const r = await lerInstagramComLogin(leitor, USUARIO_LOGADO, { base: srv.origem, pasta: destino, pausa: 50 });
  assert.equal(r.bloqueio, '');
  assert.equal(r.comLogin, true);
  assert.equal(r.posts.length, 40);
  assert.equal(r.perfil.nome, 'Casa Logada', 'nunca o nome da conta de quem entrou, que vem antes na página');
  assert.equal(r.perfil.bio, 'Bio da casa logada.');
  assert.deepEqual(r.perfil.links, []);
  assert.ok(r.posts.every((p) => p.legenda && p.data && p.de === 'json'));
  assert.ok(srv.pedidos.some((p) => p.startsWith('/graphql/query')), 'a grade pediu mais ao rolar');
  assert.deepEqual(paginasDePost(), [], 'tudo veio das respostas: nenhuma página de publicação aberta');
  assert.ok(!r.posts.some((p) => p.codigo === 'Outro99'));
  assert.ok(r.fotos.length >= 40);
  for (const f of r.fotos) assert.equal(f.largura, LARGURA_MAIOR, f.arquivo);
});

// No computador lento de quem usa, a resposta da grade demora a chegar depois de rolar. A leitura
// espera a página terminar de pedir (sem conversa em andamento), e não desiste pelo relógio.
test('com login, grade lenta: cada resposta demora 1,5 s e mesmo assim saem as 40 publicações', opcoes, async (t) => {
  const lento = await servirInstagramLogado({ atrasoMs: 1500 });
  t.after(() => lento.fechar());
  const r = await lerInstagramComLogin(leitor, USUARIO_LOGADO, { base: lento.origem, pausa: 50 });
  assert.equal(r.bloqueio, '');
  assert.equal(r.posts.length, 40);
  assert.ok(r.posts.every((p) => p.de === 'json'));
  assert.deepEqual(lento.pedidos.filter((p) => p.includes('/p/')), [], 'nenhuma página de publicação aberta');
});

test('verificação no meio: para na primeira página que pede, sem abrir as outras, e guarda o que já leu', opcoes, async () => {
  srv.pedidos.length = 0;
  const destino = path.join(pasta, 'desafio');
  const fatos = path.join(destino, 'fatos.md');
  fs.mkdirSync(destino, { recursive: true });
  const r = await lerFontes({ instagram: USUARIO_DESAFIO, posts: 40 }, { pasta: path.join(destino, 'coleta'), fatos, leitor, leitorInstagram: leitor, bases: { instagram: srv.origem }, pausa: 20, data: DATA });
  assert.deepEqual(paginasDePost(), [`/${USUARIO_DESAFIO}/p/${codigoDesafio(3)}/`], 'uma tentativa só');
  const a = r.avisos.find((x) => x.codigo === 'LER_INSTAGRAM_PEDIU_VERIFICACAO');
  assert.deepEqual(a.dados, { motivo: 'verificacao', lidas: 2 });
  assert.ok(!r.avisos.some((x) => x.codigo === 'LER_INSTAGRAM_POUCOS'), 'com login, pouco não é falta de login');
  assert.equal(r.dados.instagram.com_login, true);
  const posts = JSON.parse(fs.readFileSync(path.join(destino, 'coleta', 'instagram', 'posts.json'), 'utf8'));
  assert.deepEqual(posts.map((p) => p.codigo), [codigoDesafio(1), codigoDesafio(2)]);
});

test('login vencido: o perfil manda para a página de entrar e a leitura para sem nada', opcoes, async () => {
  srv.pedidos.length = 0;
  const destino = path.join(pasta, 'saiu');
  fs.mkdirSync(destino, { recursive: true });
  const r = await lerFontes({ instagram: USUARIO_SAIU, posts: 40 }, { pasta: path.join(destino, 'coleta'), fatos: path.join(destino, 'fatos.md'), leitor, leitorInstagram: leitor, bases: { instagram: srv.origem }, pausa: 20, data: DATA });
  const a = r.avisos.find((x) => x.codigo === 'LER_INSTAGRAM_PEDIU_VERIFICACAO');
  assert.deepEqual(a.dados, { motivo: 'login', lidas: 0 });
  assert.equal(r.dados.instagram, undefined);
  assert.equal(fs.existsSync(path.join(destino, 'coleta', 'instagram', 'posts.json')), false);
  assert.deepEqual(paginasDePost(), []);
});

// Página local que grava um cookie "sessionid" que dura uma hora: faz o papel do Instagram depois
// que a pessoa entra.
function servirEntrada(atrasoMs) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const corpo = `<!doctype html><title>Entrar</title><p>entrar</p><script>setTimeout(function () { document.cookie = 'sessionid=valor-de-teste; max-age=3600; path=/'; }, ${atrasoMs});</script>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(corpo);
    });
    const fechar = () => new Promise((r) => {
      s.close(() => r());
      s.closeAllConnections();
    });
    s.listen(0, '127.0.0.1', () => resolve({ origem: `http://127.0.0.1:${s.address().port}`, fechar }));
  });
}

// Lugar do login numa pasta temporária: nunca o login de verdade.
function lugarTemporario(t, nome) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `estudio-ig-${nome}-`));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return lugarPadrao({ ESTUDIO_DADOS: path.join(base, 'dados'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') });
}

// Grava no perfil guardado o cookie que o endereço devolve, como a janela faria, e fecha com calma.
async function gravarLogin(lugar, endereco) {
  fs.mkdirSync(lugar.perfil, { recursive: true });
  const nav = await launch({ perfil: lugar.perfil, navegador: CHROME, endereco, largura: 800, altura: 600 });
  const conexao = await conectarNavegador(nav.porta);
  const fim = Date.now() + 10000;
  let cookies = [];
  while (Date.now() < fim && !cookies.some((c) => c.name === 'sessionid')) {
    cookies = (await conexao.send('Storage.getCookies', {})).cookies;
    await new Promise((r) => setTimeout(r, 200));
  }
  conexao.close();
  await nav.fecharComCalma();
}

test('login guardado: sobrevive a fechar e abrir o navegador sem janela; sair apaga', opcoesDoSistema, async (t) => {
  const lugar = lugarTemporario(t, 'perfil');
  const entrada = await servirEntrada(0);
  t.after(() => entrada.fechar());
  const dominio = '127.0.0.1';
  const enderecos = [`${entrada.origem}/`];
  assert.equal(await temLoginSalvo({ lugar, navegador: CHROME, dominio, enderecos }), false, 'sem perfil');
  await gravarLogin(lugar, `${entrada.origem}/`);
  assert.equal(await temLoginSalvo({ lugar, navegador: CHROME, dominio, enderecos }), true, 'o login voltou no navegador seguinte');
  const comLogin = await abrirLeitorComLogin({ lugar, navegador: CHROME, dominio, enderecos });
  assert.ok(comLogin.leitor, comLogin.motivo);
  await comLogin.leitor.fecharComCalma();
  assert.equal(sairDaConta(lugar), true);
  assert.deepEqual(await abrirLeitorComLogin({ lugar, navegador: CHROME, dominio, enderecos }), { motivo: 'sem-login' });
});

test('com login de verdade: o leitor do perfil guardado vê a grade que só aparece com o cookie', opcoesDoSistema, async (t) => {
  const lugar = lugarTemporario(t, 'leitor');
  const site = await servirInstagramLogado({ exigirLogin: true });
  t.after(() => site.fechar());
  const dominio = '127.0.0.1';
  const enderecos = [`${site.origem}/`];
  // sem login guardado no perfil, a leitura cai na página de entrar e para
  fs.mkdirSync(lugar.perfil, { recursive: true });
  assert.deepEqual(await abrirLeitorComLogin({ lugar, navegador: CHROME, dominio, enderecos }), { motivo: 'vencido' });
  await gravarLogin(lugar, `${site.origem}/entrar`);
  const comLogin = await abrirLeitorComLogin({ lugar, navegador: CHROME, dominio, enderecos });
  assert.ok(comLogin.leitor, comLogin.motivo);
  let r;
  try {
    r = await lerInstagramComLogin(comLogin.leitor, USUARIO_LOGADO, { base: site.origem, pausa: 50 });
  } finally {
    await comLogin.leitor.fecharComCalma();
  }
  assert.equal(r.bloqueio, '');
  assert.equal(r.posts.length, 40);
  assert.ok(r.posts.every((p) => p.de === 'json' && p.fotos.every((f) => f.largura === LARGURA_MAIOR)));
  assert.ok(!site.pedidos.some((p) => p.startsWith('/accounts/login/')), 'nunca mandou para a página de entrar');
  // o mesmo endereço, sem o perfil guardado: vai para a página de entrar e a leitura para
  const semLogin = await lerInstagramComLogin(leitor, USUARIO_LOGADO, { base: site.origem, pausa: 50 });
  assert.equal(semLogin.bloqueio, 'login');
  assert.deepEqual(semLogin.posts, []);
});

test('janela visível: abre, percebe a entrada sozinha, fecha, e a leitura sem janela já tem o login', opcoesDaJanela, async (t) => {
  const lugar = lugarTemporario(t, 'janela');
  const outro = lugarTemporario(t, 'prazo');
  const entrada = await servirEntrada(1500);
  t.after(() => entrada.fechar());
  const dominio = '127.0.0.1';
  const r = await esperarEntrar({ lugar, navegador: CHROME, endereco: `${entrada.origem}/`, dominio, prazoMs: 30000, pausaDepoisMs: 200 });
  assert.deepEqual(r, { estado: 'entrou' });
  assert.equal(await temLoginSalvo({ lugar, navegador: CHROME, dominio, enderecos: [`${entrada.origem}/`] }), true, 'janela e modo escondido usam a mesma chave');
  const prazo = await esperarEntrar({ lugar: outro, navegador: CHROME, endereco: 'about:blank', dominio, prazoMs: 2000 });
  assert.deepEqual(prazo, { estado: 'prazo' });
});
