// Instagram com login, de ponta a ponta no navegador, contra páginas SINTÉTICAS servidas aqui mesmo
// (fixtures/instagram-logado.mjs), sem conta e sem Instagram de verdade:
// - a leitura logada rola a grade, guarda as respostas que a página pede e traz 40 publicações com a
//   foto de 1440, sem abrir a página de nenhuma;
// - verificação e volta para a página de entrar param a leitura no primeiro sinal;
// - o login guardado no perfil sobrevive a fechar e abrir o navegador (Chrome do sistema, sem janela);
// - de ponta a ponta com o leitor de login de verdade (abrirLeitorComLogin): a página só mostra a
//   grade com o cookie de sessão gravado no perfil; sem ele, vai para a página de entrar.
// - um Chrome esquecido aberto não segura o processo do estúdio: ele termina e leva o Chrome junto.
// Pula sem navegador. A janela VISÍVEL só abre com ESTUDIO_TESTAR_JANELA=1 e fora do CI: ela aparece
// na tela de quem roda o teste.
// Prazos: cada teste tem o seu, e o arquivo inteiro cabe em TETO_DO_ARQUIVO_MS. Um teste que passa do
// prazo é dado como falho e o arquivo segue; nada fica esperando para sempre (o CI desiste em 30 min).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acharNavegador, acharNavegadorComJanela } from '../scripts/lib/chrome.mjs';
import { abrirLeitor } from '../scripts/lib/leitor.mjs';
import { launch, conectarNavegador, processosVivos, ehEscritor } from '../scripts/lib/cdp.mjs';
import { lerFontes } from '../scripts/lib/ler.mjs';
import { lerInstagramComLogin } from '../scripts/lib/ler-instagram-login.mjs';
import { esperarEntrar, temLoginSalvo, abrirLeitorComLogin, sairDaConta } from '../scripts/lib/instagram-conta.mjs';
import { lugarPadrao } from '../scripts/lib/instagram-lugar.mjs';
import { EH_WINDOWS } from '../scripts/lib/caminhos.mjs';
import { servirInstagramLogado, USUARIO_LOGADO, USUARIO_DESAFIO, USUARIO_SAIU, LARGURA_MAIOR, codigoDesafio } from './fixtures/instagram-logado.mjs';

const SEM_NAVEGADOR = !acharNavegador();
// O arquivo inteiro, no pior caso: bem abaixo dos 30 minutos do CI. Num computador livre leva menos
// de 1 minuto; num Mac do CI carregado com outros navegadores, alguns minutos.
const TETO_DO_ARQUIVO_MS = 12 * 60 * 1000;
// Os testes que usam o leitor já aberto: em segundos, normalmente.
const opcoes = { skip: SEM_NAVEGADOR ? 'sem Chrome, Edge ou Chromium nesta máquina' : false, timeout: 120000 };
const CHROME = acharNavegadorComJanela();
// Cada teste abre e fecha o navegador 3 ou 4 vezes; num computador carregado, cada fechamento leva
// de 10 a 30 s (o Chrome demora a sair com a CPU ocupada).
const opcoesDoSistema = { skip: CHROME ? false : 'sem Chrome, Edge ou Chromium instalado', timeout: 240000 };
const QUER_JANELA = process.env.ESTUDIO_TESTAR_JANELA === '1' && !process.env.CI;
const opcoesDaJanela = { skip: CHROME && QUER_JANELA ? false : 'janela visível só com ESTUDIO_TESTAR_JANELA=1, fora do CI', timeout: 120000 };
const DATA = '2026-11-24';
// O Windows solta os arquivos de um processo encerrado com atraso: apagar repete por alguns segundos
// (como o sairDaConta).
const APAGAR_COM_ESPERA = Object.freeze({ recursive: true, force: true, maxRetries: 10, retryDelay: 500 });

// Linhas "<número> <linha de comando>" dos processos do Chrome (têm --user-data-dir) cuja linha de
// comando passa pela pasta, escrita como foi dada ou como o sistema a escreve por inteiro.
function processosDoChromeNaPasta(pasta) {
  const jeitos = [pasta, fs.realpathSync.native(pasta)].map((p) => (EH_WINDOWS ? p.toLowerCase() : p));
  const opcoesDoComando = { encoding: 'utf8', windowsHide: true, timeout: 30000 };
  const r = EH_WINDOWS
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process | ForEach-Object { [string]$_.ProcessId + ' ' + $_.CommandLine }"], opcoesDoComando)
    : spawnSync('ps', ['-ww', '-A', '-o', 'pid=,args='], opcoesDoComando);
  return String(r.stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      const texto = EH_WINDOWS ? l.toLowerCase() : l;
      return texto.includes('--user-data-dir') && jeitos.some((j) => texto.includes(j));
    });
}

describe('Instagram com login, no navegador', { timeout: TETO_DO_ARQUIVO_MS }, () => {
  let srv;
  let leitor;
  let pasta;

  before(async () => {
    if (SEM_NAVEGADOR) return;
    srv = await servirInstagramLogado();
    leitor = await abrirLeitor();
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-logado-'));
  }, { timeout: 120000 });

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
    t.after(() => fs.rmSync(base, APAGAR_COM_ESPERA));
    return lugarPadrao({ ESTUDIO_DADOS: path.join(base, 'dados'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') });
  }

  // Grava no perfil guardado o cookie que o endereço devolve, como a janela faria, e fecha com calma.
  async function gravarLogin(lugar, endereco) {
    fs.mkdirSync(lugar.perfil, { recursive: true });
    const nav = await launch({ perfil: lugar.perfil, navegador: CHROME, endereco, largura: 800, altura: 600 });
    try {
      const conexao = await conectarNavegador(nav.porta);
      const fim = Date.now() + 10000;
      let cookies = [];
      while (Date.now() < fim && !cookies.some((c) => c.name === 'sessionid')) {
        cookies = (await conexao.send('Storage.getCookies', {})).cookies;
        await new Promise((r) => setTimeout(r, 200));
      }
      conexao.close();
    } catch (e) {
      nav.close();
      throw e;
    }
    assert.equal(await nav.fecharComCalma(), true, 'o navegador fechou sozinho');
  }

  // Num computador lento, o Chrome leva mais de 5 s para fechar (medido: 11 s num Mac sobrecarregado);
  // matar o principal antes perde o login. Fechar com calma espera o principal sair sozinho e, na volta,
  // não deixa nenhum processo do navegador segurando o perfil.
  test('fechar com calma: o principal sai sozinho e nada do navegador sobra segurando o perfil', opcoesDoSistema, async (t) => {
    const lugar = lugarTemporario(t, 'fechar');
    fs.mkdirSync(lugar.perfil, { recursive: true });
    const nav = await launch({ perfil: lugar.perfil, navegador: CHROME, endereco: 'about:blank', largura: 800, altura: 600 });
    t.after(() => nav.close());
    const conexao = await conectarNavegador(nav.porta);
    const info = (await conexao.send('SystemInfo.getProcessInfo', {})).processInfo;
    conexao.close();
    const pids = info.map((p) => p.id);
    assert.ok(info.some((p) => ehEscritor(p.type)), `serviço de rede na lista: ${info.map((p) => p.type).join(', ')}`);
    // o principal está vivo (um processo de apoio pode já ter saído entre a lista e esta conferência)
    assert.ok(processosVivos(info.filter((p) => p.type === 'browser').map((p) => p.id)).length === 1, 'o principal está aberto');
    assert.equal(await nav.fecharComCalma(), true, 'o principal saiu sozinho, sem ser encerrado à força');
    assert.equal(nav.vivo(), false);
    assert.deepEqual(processosVivos(pids), [], `nenhum processo do navegador sobrou (encerrados depois: ${nav.ultimoFechamento().sobraram.join(', ') || 'nenhum'})`);
  });

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

  // Um caminho que esquece o navegador aberto (um erro no meio, um prazo vencido) não pode deixar o
  // estúdio vivo para sempre: o processo termina sozinho e o Chrome sai junto, com perfil temporário
  // e com perfil guardado. Nenhum processo do Chrome (nem os filhos: páginas, GPU, rede) fica na
  // máquina, e o perfil temporário é apagado.
  test('Chrome esquecido aberto: o processo termina sozinho e leva o Chrome junto', opcoesDoSistema, async (t) => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-esquecido-'));
    t.after(() => fs.rmSync(base, APAGAR_COM_ESPERA));
    const temporaria = path.join(base, 'tmp');
    const guardado = path.join(base, 'perfil');
    fs.mkdirSync(temporaria);
    fs.mkdirSync(guardado);
    // a pasta temporária do processo filho fica aqui dentro: o perfil temporário nasce nela
    const env = { ...process.env, TMPDIR: temporaria, TEMP: temporaria, TMP: temporaria };
    const cdp = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'cdp.mjs')).href;
    for (const perfil of ['', guardado]) {
      const script = [
        `import { launch, conectarNavegador } from ${JSON.stringify(cdp)};`,
        `const nav = await launch({ perfil: ${JSON.stringify(perfil)}, navegador: { caminho: ${JSON.stringify(CHROME.caminho)} } });`,
        'const c = await conectarNavegador(nav.porta);',
        "const { processInfo } = await c.send('SystemInfo.getProcessInfo', {});",
        'c.close();',
        "console.log(JSON.stringify(processInfo.filter((p) => p.type === 'browser').map((p) => p.id)));",
      ].join('\n');
      const inicio = Date.now();
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 60000, env });
      assert.equal(r.error, undefined, `o processo terminou sozinho (${perfil ? 'perfil guardado' : 'perfil temporário'}): ${r.stderr}`);
      assert.equal(r.status, 0, r.stderr);
      assert.ok(Date.now() - inicio < 60000);
      const principal = JSON.parse(r.stdout.trim().split('\n').pop());
      assert.equal(principal.length, 1, r.stdout);
      const fim = Date.now() + 10000;
      while (processosVivos(principal).length && Date.now() < fim) await new Promise((res) => setTimeout(res, 100));
      assert.deepEqual(processosVivos(principal), [], 'o Chrome saiu junto com o processo');
      // os filhos também: um filho vivo seguraria o perfil (no Windows, sem deixar apagar a pasta)
      const pasta = perfil || temporaria;
      let sobraram = processosDoChromeNaPasta(pasta);
      while (sobraram.length && Date.now() < fim + 10000) {
        await new Promise((res) => setTimeout(res, 500));
        sobraram = processosDoChromeNaPasta(pasta);
      }
      assert.deepEqual(sobraram.map((l) => l.slice(0, 160)), [], 'nenhum processo do Chrome sobrou com o perfil');
      // só o perfil do estúdio (o Chrome no Linux também guarda ali uma pasta dele, com.google.Chrome.*)
      if (!perfil) assert.deepEqual(fs.readdirSync(temporaria).filter((nome) => nome.startsWith('estudio-cdp-')), [], 'o perfil temporário foi apagado');
    }
  });

  test('janela visível: abre, percebe a entrada sozinha, fecha, e a leitura sem janela já tem o login', opcoesDaJanela, async (t) => {
    const lugar = lugarTemporario(t, 'janela');
    const outro = lugarTemporario(t, 'prazo');
    const entrada = await servirEntrada(1500);
    t.after(() => entrada.fechar());
    const dominio = '127.0.0.1';
    const r = await esperarEntrar({ lugar, navegador: CHROME, endereco: `${entrada.origem}/`, dominio, enderecos: [`${entrada.origem}/`], prazoMs: 30000, pausaDepoisMs: 200 });
    assert.deepEqual(r, { estado: 'entrou' });
    assert.equal(await temLoginSalvo({ lugar, navegador: CHROME, dominio, enderecos: [`${entrada.origem}/`] }), true, 'janela e modo escondido usam a mesma chave');
    const prazo = await esperarEntrar({ lugar: outro, navegador: CHROME, endereco: 'about:blank', dominio, prazoMs: 2000 });
    assert.deepEqual(prazo, { estado: 'prazo' });
  });
});
