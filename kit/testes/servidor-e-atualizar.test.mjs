// Servidor local (pasta/ → index.html, nada fora da raiz) e atualização (preserva o usuário, volta atrás).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { servir, enviar, dentroDaBase } from '../scripts/lib/servidor.mjs';
import { abrirSessao } from '../scripts/lib/sessao.mjs';
import {
  aplicarVersao, atualizarEstudio, acharRaizNova, enderecoAceito, baixar, destinoDoRedirecionamento, linksNaArvore,
} from '../scripts/lib/atualizacao.mjs';
import { copiarPasta } from '../scripts/lib/caminhos.mjs';

const temporaria = (prefixo) => fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
// Link simbólico; no Windows sem o modo de desenvolvedor não dá, e o teste pula.
const criarLink = (alvo, link, tipo) => {
  try {
    fs.symlinkSync(alvo, link, tipo);
    return true;
  } catch {
    return false;
  }
};
const escrever = (arq, texto) => {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto);
};

test('servidor: "/pasta/" devolve o index, "/pasta" redireciona, fora da raiz é 403, falta é 404', async () => {
  const raiz = temporaria('estudio-srv-');
  escrever(path.join(raiz, 'index.html'), '<p>raiz</p>');
  escrever(path.join(raiz, 'sub', 'index.html'), '<p>sub</p>');
  escrever(path.join(raiz, 'v.mp4'), '0123456789');
  const srv = await servir(raiz, { virtuais: { '/virtual.html': '<p>v</p>' } });
  try {
    const get = (p, init) => fetch(`${srv.origem}${p}`, { redirect: 'manual', ...init });
    assert.equal(await (await get('/')).text(), '<p>raiz</p>');
    assert.equal(await (await get('/sub/')).text(), '<p>sub</p>');
    const r = await get('/sub');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), '/sub/');
    assert.equal((await get('/nada.html')).status, 404);
    assert.equal((await get('/..%2f..%2fetc%2fhosts')).status, 403);
    assert.equal(await (await get('/virtual.html')).text(), '<p>v</p>');
    const parte = await get('/v.mp4', { headers: { Range: 'bytes=2-4' } });
    assert.equal(parte.status, 206);
    assert.equal(await parte.text(), '234');
    assert.equal((await get('/index.html')).headers.get('content-type'), 'text/html; charset=utf-8');
  } finally {
    await srv.fechar();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('servidor: link que aponta para fora dá 403 (inclusive index.html de pasta); "..x.css" é arquivo normal', async (t) => {
  const base = temporaria('estudio-srv-link-');
  const raiz = path.join(base, 'site');
  escrever(path.join(raiz, 'index.html'), '<p>raiz</p>');
  escrever(path.join(raiz, '..notas.css'), 'body{}');
  escrever(path.join(raiz, 'dentro', 'a.txt'), 'dentro');
  escrever(path.join(base, 'fora', 'segredo.txt'), 'segredo');
  escrever(path.join(base, 'fora', 'pagina', 'index.html'), '<p>fora</p>');
  const links = criarLink(path.join(base, 'fora', 'segredo.txt'), path.join(raiz, 'vaza.txt'), 'file')
    && criarLink(path.join(base, 'fora', 'pagina'), path.join(raiz, 'pagina'), 'junction')
    && criarLink(path.join(raiz, 'dentro', 'a.txt'), path.join(raiz, 'atalho.txt'), 'file');
  if (!links) {
    t.skip('sem permissão para criar link nesta máquina');
    fs.rmSync(base, { recursive: true, force: true });
    return;
  }
  const srv = await servir(raiz);
  try {
    const get = (p) => fetch(`${srv.origem}${p}`, { redirect: 'manual' });
    assert.equal((await get('/vaza.txt')).status, 403);
    assert.equal((await get('/pagina/')).status, 403);
    assert.equal((await get('/pagina/index.html')).status, 403);
    assert.equal(await (await get('/atalho.txt')).text(), 'dentro');
    const notas = await get('/..notas.css');
    assert.equal(notas.status, 200);
    assert.equal(await notas.text(), 'body{}');
    assert.equal(dentroDaBase('..notas.css'), true);
    assert.equal(dentroDaBase('..'), false);
    assert.equal(dentroDaBase(`..${path.sep}x`), false);
  } finally {
    await srv.fechar();
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('servidor: arquivo que não deixa ler vira 500 e o servidor continua de pé', async (t) => {
  if (process.platform === 'win32' || (process.getuid && process.getuid() === 0)) {
    t.skip('sem como negar leitura de arquivo aqui (Windows ou root)');
    return;
  }
  const raiz = temporaria('estudio-srv-erro-');
  escrever(path.join(raiz, 'index.html'), '<p>ok</p>');
  escrever(path.join(raiz, 'travado.css'), 'x');
  fs.chmodSync(path.join(raiz, 'travado.css'), 0o000);
  const srv = await servir(raiz);
  try {
    assert.equal((await fetch(`${srv.origem}/travado.css`)).status, 500);
    assert.equal((await fetch(`${srv.origem}/travado.css`, { headers: { Range: 'bytes=0-0' } })).status, 500);
    assert.equal(await (await fetch(`${srv.origem}/`)).text(), '<p>ok</p>');
  } finally {
    await srv.fechar();
    fs.chmodSync(path.join(raiz, 'travado.css'), 0o644);
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('servidor: erro de leitura depois do cabeçalho corta só aquela resposta', async () => {
  // descritor inválido: a leitura falha depois do 200 já enviado (como arquivo apagado no meio)
  const srv = http.createServer((req, res) => {
    if (req.url === '/quebra') {
      res.writeHead(200, { 'Content-Length': 10 });
      enviar(res, 987654, {});
    } else res.end('vivo');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origem = `http://127.0.0.1:${srv.address().port}`;
  try {
    await assert.rejects((async () => (await fetch(`${origem}/quebra`)).text())());
    assert.equal(await (await fetch(`${origem}/ok`)).text(), 'vivo');
  } finally {
    srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }
});

test('abrirSessao: falha depois de abrir o Chrome fecha aba, Chrome e servidor', async () => {
  for (const ondeFalha of ['launch', 'openTab', 'send']) {
    const fechados = [];
    const deps = {
      servir: async () => ({ origem: 'http://127.0.0.1:1', fechar: async () => fechados.push('servidor') }),
      launch: async () => {
        if (ondeFalha === 'launch') throw new Error('sem chrome');
        return { porta: 1, close: () => fechados.push('chrome') };
      },
      openTab: async () => {
        if (ondeFalha === 'openTab') throw new Error('sem aba');
        return {
          send: async () => {
            throw new Error('aba caiu');
          },
          on: () => {},
          close: () => fechados.push('aba'),
        };
      },
    };
    await assert.rejects(abrirSessao('/nao-importa', {}, deps), ondeFalha);
    const esperado = { launch: ['servidor'], openTab: ['chrome', 'servidor'], send: ['aba', 'chrome', 'servidor'] }[ondeFalha];
    assert.deepEqual(fechados, esperado, ondeFalha);
  }
});

const DESPACHANTE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'estudio.mjs');

function rodarEstudioAssincrono(args, env) {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, [DESPACHANTE, ...args], { env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
    let saida = '';
    filho.stdout.on('data', (d) => {
      saida += d;
    });
    filho.on('close', (codigo) => {
      const linhas = saida.trim().split('\n');
      resolve({ codigo, json: JSON.parse(linhas[linhas.length - 1]) });
    });
  });
}

function matar(pid) {
  try {
    process.kill(pid);
  } catch {}
}

test('abrir: dois ao mesmo tempo usam a mesma porta e um servidor só; porta de outro programa não é reaproveitada', async () => {
  const base = temporaria('estudio-abrir-');
  const env = { ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') };
  escrever(path.join(base, 'sites', 'cafe', 'site', 'index.html'), '<p>cafe</p>');
  const estado = path.join(base, 'ferr', 'servidores', 'cafe.json');
  const pids = [];
  const intruso = await servir(base);
  try {
    // o estado aponta para uma porta ocupada por outro servidor (sem a identidade do estúdio)
    escrever(estado, JSON.stringify({ porta: intruso.porta, pid: 1, pasta: path.join(base, 'sites', 'cafe', 'site') }));
    const [a, b] = await Promise.all([
      rodarEstudioAssincrono(['abrir', 'cafe', '--sem-navegador'], env),
      rodarEstudioAssincrono(['abrir', 'cafe', '--sem-navegador'], env),
    ]);
    assert.equal(a.codigo, 0, JSON.stringify(a.json));
    assert.equal(b.codigo, 0, JSON.stringify(b.json));
    assert.equal(a.json.codigo, 'SERVIDOR_NO_AR');
    assert.equal(a.json.dados.porta, b.json.dados.porta);
    assert.notEqual(a.json.dados.porta, intruso.porta);
    const info = JSON.parse(fs.readFileSync(estado, 'utf8'));
    pids.push(info.pid);
    if (process.platform !== 'win32') {
      // um servidor só para esta pasta (o segundo abrir esperou a trava e reaproveitou)
      const ps = spawnSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' });
      const deste = ps.stdout.split('\n').filter((l) => l.includes('servidor-sozinho.mjs') && l.includes(base));
      for (const l of deste) pids.push(Number(l.trim().split(' ')[0]));
      assert.equal(deste.length, 1, deste.join('\n'));
    }
    assert.equal(info.porta, a.json.dados.porta);
    const id = await (await fetch(`http://127.0.0.1:${info.porta}/__estudio.json`)).json();
    assert.equal(id.pid, info.pid);
    assert.equal(path.resolve(id.pasta), path.resolve(base, 'sites', 'cafe', 'site'));
    assert.equal(await (await fetch(`http://127.0.0.1:${info.porta}/`)).text(), '<p>cafe</p>');
    assert.equal(fs.existsSync(`${estado}.trava`), false);
    // de novo: reaproveita o mesmo servidor
    const c = await rodarEstudioAssincrono(['abrir', 'cafe', '--sem-navegador'], env);
    assert.equal(c.json.dados.porta, info.porta);
    assert.equal(JSON.parse(fs.readFileSync(estado, 'utf8')).pid, info.pid);
    // trava esquecida por um abrir que morreu (pid que não existe mais, mesmo recente) não impede o próximo
    fs.writeFileSync(`${estado}.trava`, String(spawnSync(process.execPath, ['-e', '']).pid));
    const d = await rodarEstudioAssincrono(['abrir', 'cafe', '--sem-navegador'], env);
    assert.equal(d.json.dados.porta, info.porta);
    assert.equal(fs.existsSync(`${estado}.trava`), false);
  } finally {
    await intruso.fechar();
    pids.forEach(matar);
    fs.rmSync(base, { recursive: true, force: true });
  }
});

function montarEstudio(raiz, versao, extra = {}) {
  escrever(path.join(raiz, 'VERSAO'), `${versao}\n`);
  escrever(path.join(raiz, 'kit', 'scripts', 'a.mjs'), `// ${versao}\n`);
  escrever(path.join(raiz, 'package.json'), '{"name":"x"}\n');
  for (const [arq, texto] of Object.entries(extra)) escrever(path.join(raiz, ...arq.split('/')), texto);
}

test('aplicarVersao troca o kit e preserva pastas do usuário e permissões locais', () => {
  const base = temporaria('estudio-upd-');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', {
      'sites/meu/brief.md': 'meu trabalho',
      'minha-marca/tokens.css': 'minha marca',
      '.claude/settings.local.json': '{"local":true}',
      '.claude/settings.json': '{"v":1}',
    });
    montarEstudio(nova, '1.1.0', { '.claude/settings.json': '{"v":2}', 'sites/LEIA-ME.txt': 'nao copiar por cima' });
    const ferr = path.join(raiz, '.ferramentas');
    const { copia } = aplicarVersao(raiz, nova, ferr);
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.1.0');
    assert.equal(fs.readFileSync(path.join(raiz, 'kit', 'scripts', 'a.mjs'), 'utf8'), '// 1.1.0\n');
    assert.equal(fs.readFileSync(path.join(raiz, 'sites', 'meu', 'brief.md'), 'utf8'), 'meu trabalho');
    assert.equal(fs.existsSync(path.join(raiz, 'sites', 'LEIA-ME.txt')), false);
    assert.equal(fs.readFileSync(path.join(raiz, 'minha-marca', 'tokens.css'), 'utf8'), 'minha marca');
    assert.equal(fs.readFileSync(path.join(raiz, '.claude', 'settings.json'), 'utf8'), '{"v":2}');
    assert.equal(fs.readFileSync(path.join(raiz, '.claude', 'settings.local.json'), 'utf8'), '{"local":true}');
    assert.equal(fs.readFileSync(path.join(copia, 'VERSAO'), 'utf8').trim(), '1.0.0');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

const semComoNegarLeitura = () => process.platform === 'win32' || (process.getuid && process.getuid() === 0);

test('aplicarVersao volta tudo como estava se a troca falhar no meio', (t) => {
  if (semComoNegarLeitura()) {
    t.skip('sem como negar leitura de arquivo aqui (Windows ou root)');
    return;
  }
  const base = temporaria('estudio-upd-falha-');
  const travado = path.join(base, 'nova', 'zz-travada', 'x.txt');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', { 'so-no-antigo.txt': 'antigo' });
    montarEstudio(nova, '2.0.0');
    // um arquivo sem permissão de leitura na versão nova faz a cópia falhar no meio
    escrever(travado, 'x');
    fs.chmodSync(travado, 0o000);
    const ferr = path.join(raiz, '.ferramentas');
    assert.throws(() => aplicarVersao(raiz, nova, ferr), (e) => e.codigo === 'ATUALIZACAO_FALHOU');
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.0');
    assert.equal(fs.readFileSync(path.join(raiz, 'kit', 'scripts', 'a.mjs'), 'utf8'), '// 1.0.0\n');
    assert.equal(fs.readFileSync(path.join(raiz, 'so-no-antigo.txt'), 'utf8'), 'antigo');
    assert.equal(fs.existsSync(path.join(raiz, 'zz-travada')), false);
    assert.deepEqual(fs.readdirSync(ferr).filter((n) => n.startsWith('versao-anterior-')), []);
  } finally {
    try { fs.chmodSync(travado, 0o644); } catch {}
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao: devolver as permissões locais faz parte da troca; falhou ali, tudo volta e a VERSAO fica', (t) => {
  if (semComoNegarLeitura()) {
    t.skip('sem como negar leitura de arquivo aqui (Windows ou root)');
    return;
  }
  const base = temporaria('estudio-upd-local-');
  const local = path.join(base, 'estudio', '.claude', 'settings.local.json');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', { '.claude/settings.json': '{"v":1}', '.claude/settings.local.json': '{"local":true}' });
    montarEstudio(nova, '2.0.0', { '.claude/settings.json': '{"v":2}' });
    fs.chmodSync(local, 0o000);
    const ferr = path.join(raiz, '.ferramentas');
    assert.throws(() => aplicarVersao(raiz, nova, ferr), (e) => e.codigo === 'ATUALIZACAO_FALHOU' && e.dados.arquivo === 'pastas de skills');
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.0');
    assert.equal(fs.readFileSync(path.join(raiz, '.claude', 'settings.json'), 'utf8'), '{"v":1}');
    assert.equal(fs.readFileSync(path.join(raiz, 'kit', 'scripts', 'a.mjs'), 'utf8'), '// 1.0.0\n');
    assert.ok(fs.existsSync(local));
  } finally {
    try { fs.chmodSync(local, 0o644); } catch {}
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao guarda na cópia o item de topo que a versão nova apagou', () => {
  const base = temporaria('estudio-upd-sobra-');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', { 'velho.md': 'saiu', 'pasta-velha/a.txt': 'a', '.DS_Store': 'lixo' });
    montarEstudio(nova, '1.1.0');
    const r = aplicarVersao(raiz, nova, path.join(raiz, '.ferramentas'));
    assert.equal(fs.existsSync(path.join(raiz, 'velho.md')), false);
    assert.equal(fs.existsSync(path.join(raiz, 'pasta-velha')), false);
    assert.equal(fs.readFileSync(path.join(r.copia, 'velho.md'), 'utf8'), 'saiu');
    assert.equal(fs.readFileSync(path.join(r.copia, 'pasta-velha', 'a.txt'), 'utf8'), 'a');
    assert.deepEqual(r.removidos.sort(), ['pasta-velha', 'velho.md']);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao mantém as skills que a pessoa pôs em .claude/skills e .agents/skills (inclusive link)', (t) => {
  const base = temporaria('estudio-upd-skills-');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', {
      '.claude/skills/oficial/SKILL.md': 'oficial v1',
      '.claude/skills/minha/SKILL.md': 'minha',
      '.agents/skills/oficial/SKILL.md': 'oficial v1',
      '.agents/skills/hyperframes/SKILL.md': 'de outro instalador',
    });
    // outro instalador costuma pôr a skill como link para a cópia em .agents
    if (!criarLink(path.join('..', '..', '.agents', 'skills', 'hyperframes'), path.join(raiz, '.claude', 'skills', 'hyperframes'), 'dir')) {
      t.skip('sem permissão para criar link nesta máquina');
      return;
    }
    montarEstudio(nova, '1.1.0', { '.claude/skills/oficial/SKILL.md': 'oficial v2', '.agents/skills/oficial/SKILL.md': 'oficial v2' });
    const r = aplicarVersao(raiz, nova, path.join(raiz, '.ferramentas'));
    const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
    assert.equal(ler('.claude', 'skills', 'oficial', 'SKILL.md'), 'oficial v2');
    assert.equal(ler('.claude', 'skills', 'minha', 'SKILL.md'), 'minha');
    assert.equal(ler('.agents', 'skills', 'hyperframes', 'SKILL.md'), 'de outro instalador');
    assert.ok(fs.lstatSync(path.join(raiz, '.claude', 'skills', 'hyperframes')).isSymbolicLink());
    assert.equal(ler('.claude', 'skills', 'hyperframes', 'SKILL.md'), 'de outro instalador');
    assert.deepEqual(r.skillsMantidas.sort(), ['.agents/skills/hyperframes', '.claude/skills/hyperframes', '.claude/skills/minha']);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao recusa zip com pasta preservada escrita de outro jeito (SITES, Minha-Marca)', () => {
  for (const nome of ['SITES', 'Minha-Marca', 'REFERENCIAS', '.Ferramentas', 'Node_Modules']) {
    const base = temporaria('estudio-upd-caixa-');
    try {
      const raiz = path.join(base, 'estudio');
      const nova = path.join(base, 'nova');
      montarEstudio(raiz, '1.0.0', { 'sites/meu/brief.md': 'meu' });
      montarEstudio(nova, '1.1.0', { [`${nome}/LEIA-ME.txt`]: 'por cima' });
      const ferr = path.join(raiz, '.ferramentas');
      assert.throws(() => aplicarVersao(raiz, nova, ferr), (e) => e.codigo === 'ATUALIZACAO_ARQUIVO_DIFERENTE', nome);
      assert.equal(fs.readFileSync(path.join(raiz, 'sites', 'meu', 'brief.md'), 'utf8'), 'meu');
      assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.0');
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test('aplicarVersao recusa versão nova com link simbólico, e copiarPasta não segue link', (t) => {
  const base = temporaria('estudio-upd-link-');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    const fora = path.join(base, 'fora');
    escrever(path.join(fora, 'segredo.txt'), 'nao');
    montarEstudio(raiz, '1.0.0');
    montarEstudio(nova, '1.1.0');
    if (!criarLink(fora, path.join(nova, 'kit', 'atalho'), 'junction')) {
      t.skip('sem permissão para criar link nesta máquina');
      return;
    }
    assert.deepEqual(linksNaArvore(nova), ['kit/atalho']);
    assert.throws(() => aplicarVersao(raiz, nova, path.join(raiz, '.ferramentas')), (e) => e.codigo === 'ATUALIZACAO_ARQUIVO_DIFERENTE');
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.0');
    assert.throws(() => copiarPasta(nova, path.join(base, 'copia')), (e) => e.code === 'LINK_SIMBOLICO');
    assert.equal(fs.existsSync(path.join(base, 'copia', 'kit', 'atalho', 'segredo.txt')), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

function criarZip(pasta, zip) {
  // bsdtar (Mac e Windows) cria zip com -a; sem ele, o zip do sistema
  const tar = spawnSync('tar', ['-a', '-cf', zip, '-C', path.dirname(pasta), path.basename(pasta)]);
  if (tar.status === 0 && fs.existsSync(zip) && fs.readFileSync(zip).subarray(0, 2).toString('latin1') === 'PK') return true;
  fs.rmSync(zip, { force: true });
  const z = spawnSync('zip', ['-qr', zip, path.basename(pasta)], { cwd: path.dirname(pasta) });
  return z.status === 0 && fs.existsSync(zip);
}

test('atualizarEstudio com zip local: confere SHA-256, só sobe de versão e acha a raiz dentro do zip', async (t) => {
  const base = temporaria('estudio-zip-');
  try {
    const raiz = path.join(base, 'estudio');
    montarEstudio(raiz, '1.0.0', { 'sites/x/brief.md': 'fica' });
    const pacote = path.join(base, 'pacote', 'site-estudio');
    montarEstudio(pacote, '1.0.1', { 'package.json': '{"name":"x","dependencies":{"y":"1"}}\n' });
    const zip = path.join(base, 'site-estudio.zip');
    if (!criarZip(pacote, zip)) {
      t.skip('sem ferramenta para criar zip nesta máquina');
      return;
    }
    const ferr = path.join(raiz, '.ferramentas');
    // sem .sha256 ao lado: recusa
    await assert.rejects(atualizarEstudio({ raiz, ferr, origem: zip }), (e) => e.codigo === 'ATUALIZACAO_ARQUIVO_DIFERENTE');
    fs.writeFileSync(`${zip}.sha256`, `${'0'.repeat(64)}  site-estudio.zip\n`);
    await assert.rejects(atualizarEstudio({ raiz, ferr, origem: zip }), (e) => e.codigo === 'ATUALIZACAO_ARQUIVO_DIFERENTE');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    fs.writeFileSync(`${zip}.sha256`, `${hash}  site-estudio.zip\n`);
    const r = await atualizarEstudio({ raiz, ferr, origem: zip });
    assert.equal(r.atualizou, true);
    assert.equal(r.para, '1.0.1');
    assert.equal(r.dependencias, true);
    assert.equal(fs.readFileSync(path.join(raiz, 'sites', 'x', 'brief.md'), 'utf8'), 'fica');
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.1');
    const de_novo = await atualizarEstudio({ raiz, ferr, origem: zip });
    assert.equal(de_novo.atualizou, false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('atualizarEstudio: só versoes.env mudou (Node ou navegador novo) também avisa que as dependências mudaram', async (t) => {
  const base = temporaria('estudio-zip-env-');
  try {
    const raiz = path.join(base, 'estudio');
    montarEstudio(raiz, '1.0.0', { 'instalar/versoes.env': 'NODE_VERSAO=24.1.0\n' });
    const pacote = path.join(base, 'pacote', 'site-estudio');
    montarEstudio(pacote, '1.0.1', { 'instalar/versoes.env': 'NODE_VERSAO=24.2.0\n' });
    const zip = path.join(base, 'site-estudio.zip');
    if (!criarZip(pacote, zip)) {
      t.skip('sem ferramenta para criar zip nesta máquina');
      return;
    }
    fs.writeFileSync(`${zip}.sha256`, `${crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')}  site-estudio.zip\n`);
    const r = await atualizarEstudio({ raiz, ferr: path.join(raiz, '.ferramentas'), origem: zip });
    assert.equal(r.atualizou, true);
    assert.equal(r.dependencias, true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('atualizarEstudio recusa zip que traz link simbólico', async (t) => {
  const base = temporaria('estudio-zip-link-');
  try {
    const raiz = path.join(base, 'estudio');
    montarEstudio(raiz, '1.0.0');
    const pacote = path.join(base, 'pacote', 'site-estudio');
    montarEstudio(pacote, '1.0.1');
    if (!criarLink(path.parse(base).root, path.join(pacote, 'kit', 'raiz-do-disco'), 'junction')) {
      t.skip('sem permissão para criar link nesta máquina');
      return;
    }
    const zip = path.join(base, 'site-estudio.zip');
    // zip -y guarda o link como link (o tar do Windows nem sempre)
    const z = spawnSync('zip', ['-qry', zip, path.basename(pacote)], { cwd: path.dirname(pacote) });
    if (z.status !== 0 || !fs.existsSync(zip)) {
      t.skip('sem o programa zip para montar um zip com link');
      return;
    }
    fs.writeFileSync(`${zip}.sha256`, `${crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')}  site-estudio.zip\n`);
    await assert.rejects(atualizarEstudio({ raiz, ferr: path.join(raiz, '.ferramentas'), origem: zip }), (e) => e.codigo === 'ATUALIZACAO_ARQUIVO_DIFERENTE');
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.0');
    assert.equal(fs.existsSync(path.join(raiz, 'kit', 'raiz-do-disco')), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('atualizarEstudio recusa endereço que não é o oficial', async () => {
  await assert.rejects(
    atualizarEstudio({ raiz: os.tmpdir(), ferr: os.tmpdir(), origem: 'https://example.com/site-estudio.zip' }),
    (e) => e.codigo === 'ATUALIZACAO_ENDERECO_ESTRANHO',
  );
});

test('enderecoAceito: só o release oficial; codificação, pasta acima, usuário, porta e outro host não passam', () => {
  const oficial = 'https://github.com/autonom-ia/site-estudio/releases/';
  assert.equal(enderecoAceito(`${oficial}latest/download/site-estudio.zip`), true);
  assert.equal(enderecoAceito(`${oficial}download/v1.0.1/site-estudio.zip`), true);
  for (const ruim of [
    `${oficial}%2e%2e/%2e%2e/outra-org/x/releases/a.zip`,
    'https://github.com/autonom-ia/site-estudio/%2e%2e/%2e%2e/outra-org/site-estudio/releases/a.zip',
    `${oficial}..%2f..%2f..%2fx.zip`,
    'https://github.com/autonom-ia/site-estudio/releases/../../outra/releases/a.zip',
    'https://github.com/autonom-ia/site-estudio/x/../../../outra-org/site-estudio/releases/a.zip',
    'https://github.com:444/autonom-ia/site-estudio/releases/a.zip',
    'https://eu:senha@github.com/autonom-ia/site-estudio/releases/a.zip',
    'https://github.com.evil.example/autonom-ia/site-estudio/releases/a.zip',
    'https://evil.example/autonom-ia/site-estudio/releases/a.zip',
    'http://github.com/autonom-ia/site-estudio/releases/a.zip',
    'https://github.com/autonom-ia/site-estudio-falso/releases/a.zip',
    'https://github.com/autonom-ia/site-estudio/archive/a.zip',
    `${oficial}a.zip?x=1`,
    `${oficial}a.zip#x`,
    'https://github.com\\autonom-ia/site-estudio/releases/a.zip',
    'file:///autonom-ia/site-estudio/releases/a.zip',
    'nem-endereco',
  ]) assert.equal(enderecoAceito(ruim), false, ruim);
});

// fetch falso: cada endereço responde o que a tabela manda.
function fetchFalso(tabela, visitados) {
  return async (url, opcoes) => {
    visitados.push(url);
    assert.equal(opcoes.redirect, 'manual');
    const r = tabela[url];
    if (!r) return new Response('nao achei', { status: 404 });
    if (r.para) return new Response(null, { status: 302, headers: { location: r.para } });
    return new Response(r.corpo, { status: 200 });
  };
}

test('baixar segue redirecionamento só para os hosts do GitHub, e no máximo 5', async () => {
  const base = temporaria('estudio-baixar-');
  try {
    const destino = path.join(base, 'z');
    const inicio = 'https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip';
    const visitados = [];
    await baixar(inicio, destino, {
      buscar: fetchFalso({
        [inicio]: { para: '/autonom-ia/site-estudio/releases/download/v1.0.1/site-estudio.zip' },
        'https://github.com/autonom-ia/site-estudio/releases/download/v1.0.1/site-estudio.zip': { para: 'https://release-assets.githubusercontent.com/a/b?assinatura=1%2F2' },
        'https://release-assets.githubusercontent.com/a/b?assinatura=1%2F2': { corpo: 'ZIP' },
      }, visitados),
    });
    assert.equal(fs.readFileSync(destino, 'utf8'), 'ZIP');
    assert.equal(visitados.length, 3);

    for (const ruim of ['https://evil.example/x', 'http://objects.githubusercontent.com/x', 'https://objects.githubusercontent.com:8443/x', 'https://a:b@github.com/x']) {
      await assert.rejects(
        baixar(inicio, destino, { buscar: fetchFalso({ [inicio]: { para: ruim } }, []) }),
        (e) => e.codigo === 'ATUALIZACAO_ENDERECO_ESTRANHO',
        ruim,
      );
    }
    // seis redirecionamentos seguidos: para no quinto
    const laco = {};
    for (let k = 0; k < 7; k += 1) laco[`https://github.com/l/${k}`] = { para: `https://github.com/l/${k + 1}` };
    const passos = [];
    await assert.rejects(baixar('https://github.com/l/0', destino, { buscar: fetchFalso(laco, passos) }), (e) => e.codigo === 'ATUALIZACAO_DOWNLOAD_FALHOU');
    assert.equal(passos.length, 6);
    assert.equal(destinoDoRedirecionamento('https://github.com/a', '//objects.githubusercontent.com/b'), 'https://objects.githubusercontent.com/b');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('acharRaizNova acha VERSAO até dois níveis abaixo', () => {
  const base = temporaria('estudio-raiz-');
  try {
    escrever(path.join(base, 'a', 'VERSAO'), '1');
    assert.equal(acharRaizNova(base), path.join(base, 'a'));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('servidor: caractere de controle no caminho dá 400 e o servidor continua de pé', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-controle-'));
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'index.html'), 'oi');
  const srv = await servir(dir);
  const pedir = (caminho) => new Promise((ok) => {
    const q = http.request({ host: '127.0.0.1', port: srv.porta, path: caminho }, (r) => {
      r.resume();
      ok(r.statusCode);
    });
    q.on('error', (e) => ok(`erro ${e.code}`));
    q.end();
  });
  try {
    assert.equal(await pedir('/%0a/..'), 400);
    assert.equal(await pedir('/a%0d%0aX:%201'), 400);
    assert.equal(await pedir('/%00'), 400);
    assert.equal(await pedir('/'), 200);
  } finally {
    await srv.fechar();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
