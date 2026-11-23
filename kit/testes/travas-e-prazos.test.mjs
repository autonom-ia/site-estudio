// Travas com pid (atualizar e abrir), prazos do DevTools, redirecionamento com caractere especial,
// cópia que não segue link e a pasta de skills que a versão nova deixou de trazer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pegarTrava, soltarTrava, pidVivo } from '../scripts/lib/trava.mjs';
import { aplicarVersao, atualizarEstudio, NOME_TRAVA } from '../scripts/lib/atualizacao.mjs';
import { copiarPasta } from '../scripts/lib/caminhos.mjs';
import { servir } from '../scripts/lib/servidor.mjs';
import { openTab } from '../scripts/lib/cdp.mjs';

const temporaria = (prefixo) => fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
const escrever = (arq, texto) => {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto);
};
// pid de um processo que já terminou
const pidMorto = () => spawnSync(process.execPath, ['-e', '']).pid;
const envelhecer = (arq) => {
  const velho = new Date(Date.now() - 60000);
  fs.utimesSync(arq, velho, velho);
};

function montarEstudio(raiz, versao, extra = {}) {
  escrever(path.join(raiz, 'VERSAO'), `${versao}\n`);
  escrever(path.join(raiz, 'kit', 'scripts', 'a.mjs'), `// ${versao}\n`);
  escrever(path.join(raiz, 'package.json'), '{"name":"x"}\n');
  for (const [arq, texto] of Object.entries(extra)) escrever(path.join(raiz, ...arq.split('/')), texto);
}

function criarZip(pasta, zip) {
  const tar = spawnSync('tar', ['-a', '-cf', zip, '-C', path.dirname(pasta), path.basename(pasta)]);
  if (tar.status === 0 && fs.existsSync(zip) && fs.readFileSync(zip).subarray(0, 2).toString('latin1') === 'PK') return true;
  fs.rmSync(zip, { force: true });
  const z = spawnSync('zip', ['-qr', zip, path.basename(pasta)], { cwd: path.dirname(pasta) });
  return z.status === 0 && fs.existsSync(zip);
}

test('trava: só o dono vivo segura; pid morto sai do caminho; idade não conta; solta só a própria', () => {
  const base = temporaria('estudio-trava-');
  const trava = path.join(base, 'x.trava');
  try {
    assert.equal(pidVivo(process.pid), true);
    assert.equal(pidVivo(pidMorto()), false);
    // livre: pega e grava o próprio pid
    assert.equal(pegarTrava(trava), true);
    assert.equal(fs.readFileSync(trava, 'utf8'), String(process.pid));
    // já é deste processo (outra chamada ao mesmo tempo): não pega de novo
    assert.equal(pegarTrava(trava), false);
    soltarTrava(trava);
    assert.equal(fs.existsSync(trava), false);
    // dono vivo (outro processo), mesmo com trava velha: continua dele, e soltar não apaga
    fs.writeFileSync(trava, String(process.ppid));
    envelhecer(trava);
    assert.equal(pegarTrava(trava), false);
    soltarTrava(trava);
    assert.equal(fs.readFileSync(trava, 'utf8'), String(process.ppid));
    // dono morto, trava recente: sai do caminho
    fs.writeFileSync(trava, String(pidMorto()));
    assert.equal(pegarTrava(trava), true);
    assert.equal(fs.readFileSync(trava, 'utf8'), String(process.pid));
    soltarTrava(trava);
    // sem pid (dono morreu entre criar e escrever): espera um pouco, depois sai do caminho
    fs.writeFileSync(trava, '');
    assert.equal(pegarTrava(trava), false);
    envelhecer(trava);
    assert.equal(pegarTrava(trava), true);
    soltarTrava(trava);
    assert.deepEqual(fs.readdirSync(base), []);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('atualizarEstudio: duas ao mesmo tempo, uma recebe ATUALIZACAO_EM_ANDAMENTO; trava de processo morto não impede', async (t) => {
  const base = temporaria('estudio-upd-trava-');
  try {
    const raiz = path.join(base, 'estudio');
    montarEstudio(raiz, '1.0.0');
    const pacote = path.join(base, 'pacote', 'site-estudio');
    montarEstudio(pacote, '1.0.1');
    const zip = path.join(base, 'site-estudio.zip');
    if (!criarZip(pacote, zip)) {
      t.skip('sem ferramenta para criar zip nesta máquina');
      return;
    }
    fs.writeFileSync(`${zip}.sha256`, `${crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')}  site-estudio.zip\n`);
    const ferr = path.join(raiz, '.ferramentas');
    const trava = path.join(ferr, NOME_TRAVA);
    const [a, b] = await Promise.allSettled([atualizarEstudio({ raiz, ferr, origem: zip }), atualizarEstudio({ raiz, ferr, origem: zip })]);
    const feitas = [a, b].filter((r) => r.status === 'fulfilled');
    const barradas = [a, b].filter((r) => r.status === 'rejected');
    assert.equal(feitas.length, 1);
    assert.equal(feitas[0].value.atualizou, true);
    assert.equal(barradas.length, 1);
    assert.equal(barradas[0].reason.codigo, 'ATUALIZACAO_EM_ANDAMENTO');
    assert.equal(fs.existsSync(trava), false);
    assert.equal(fs.readFileSync(path.join(raiz, 'VERSAO'), 'utf8').trim(), '1.0.1');
    // outra atualização viva (outro processo) segura a trava
    fs.writeFileSync(trava, String(process.ppid));
    await assert.rejects(atualizarEstudio({ raiz, ferr, origem: zip }), (e) => e.codigo === 'ATUALIZACAO_EM_ANDAMENTO');
    assert.equal(fs.readFileSync(trava, 'utf8'), String(process.ppid));
    // trava esquecida por um processo que morreu: segue (e a VERSAO é lida depois da trava)
    fs.writeFileSync(trava, String(pidMorto()));
    const r = await atualizarEstudio({ raiz, ferr, origem: zip });
    assert.equal(r.atualizou, false);
    assert.equal(r.de, '1.0.1');
    assert.equal(fs.existsSync(trava), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao: duas trocas no mesmo segundo guardam a cópia anterior em pastas diferentes', () => {
  const base = temporaria('estudio-upd-copias-');
  try {
    const raiz = path.join(base, 'estudio');
    montarEstudio(raiz, '1.0.0');
    montarEstudio(path.join(base, 'v1'), '1.1.0');
    montarEstudio(path.join(base, 'v2'), '1.2.0');
    const ferr = path.join(raiz, '.ferramentas');
    const a = aplicarVersao(raiz, path.join(base, 'v1'), ferr);
    const b = aplicarVersao(raiz, path.join(base, 'v2'), ferr);
    assert.notEqual(a.copia, b.copia);
    assert.ok(path.basename(a.copia).startsWith('versao-anterior-'));
    assert.equal(fs.readFileSync(path.join(a.copia, 'VERSAO'), 'utf8').trim(), '1.0.0');
    assert.equal(fs.readFileSync(path.join(b.copia, 'VERSAO'), 'utf8').trim(), '1.1.0');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('aplicarVersao: versão nova sem .agents (ou sem .claude) recria a pasta e devolve as skills da pessoa', () => {
  const base = temporaria('estudio-upd-sem-pasta-');
  try {
    const raiz = path.join(base, 'estudio');
    const nova = path.join(base, 'nova');
    montarEstudio(raiz, '1.0.0', {
      '.claude/skills/minha/SKILL.md': 'minha claude',
      '.claude/settings.local.json': '{"local":true}',
      '.agents/skills/minha/SKILL.md': 'minha codex',
    });
    montarEstudio(nova, '1.1.0');
    const r = aplicarVersao(raiz, nova, path.join(raiz, '.ferramentas'));
    const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');
    assert.equal(ler('.claude', 'skills', 'minha', 'SKILL.md'), 'minha claude');
    assert.equal(ler('.claude', 'settings.local.json'), '{"local":true}');
    assert.equal(ler('.agents', 'skills', 'minha', 'SKILL.md'), 'minha codex');
    assert.deepEqual(r.skillsMantidas.sort(), ['.agents/skills/minha', '.claude/skills/minha']);
    assert.deepEqual(r.removidos, []);
    assert.equal(fs.readFileSync(path.join(r.copia, '.agents', 'skills', 'minha', 'SKILL.md'), 'utf8'), 'minha codex');
    assert.equal(ler('VERSAO').trim(), '1.1.0');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('copiarPasta recusa origem que é link (não copia o que está do outro lado)', (t) => {
  const base = temporaria('estudio-copiar-link-');
  try {
    escrever(path.join(base, 'fora', 'segredo.txt'), 'nao');
    try {
      fs.symlinkSync(path.join(base, 'fora'), path.join(base, 'atalho'), 'junction');
    } catch {
      t.skip('sem permissão para criar link nesta máquina');
      return;
    }
    assert.throws(() => copiarPasta(path.join(base, 'atalho'), path.join(base, 'copia')), (e) => e.code === 'LINK_SIMBOLICO');
    assert.throws(() => copiarPasta(path.join(base, 'atalho'), path.join(base, 'copia'), { links: 'recriar' }), (e) => e.code === 'LINK_SIMBOLICO');
    assert.equal(fs.existsSync(path.join(base, 'copia')), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('servidor: redirecionamento de pasta com # ou ? no nome codifica cada pedaço', async () => {
  const raiz = temporaria('estudio-srv-redir-');
  // "?" não vale em nome de pasta no Windows: lá o caso a?b fica de fora
  const pastas = process.platform === 'win32' ? ['a#b', 'c d'] : ['a#b', 'a?b', 'c d'];
  for (const pasta of pastas) escrever(path.join(raiz, 'x', pasta, 'index.html'), `<p>${pasta}</p>`);
  const srv = await servir(raiz);
  try {
    const casos = [['/x/a%23b', '/x/a%23b/', 'a#b'], ['/x/a%3Fb', '/x/a%3Fb/', 'a?b'], ['/x/c%20d', '/x/c%20d/', 'c d']]
      .filter(([, , pasta]) => pastas.includes(pasta));
    for (const [pedido, destino, texto] of casos) {
      const r = await fetch(`${srv.origem}${pedido}`, { redirect: 'manual' });
      assert.equal(r.status, 301, pedido);
      assert.equal(r.headers.get('location'), destino, pedido);
      assert.equal(await (await fetch(`${srv.origem}${destino}`)).text(), `<p>${texto}</p>`, destino);
    }
  } finally {
    await srv.fechar();
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('openTab: DevTools que não responde ou não abre a conexão vira CHROME_NAO_ABRIU no prazo', async () => {
  // 1) /json/new aceita a conexão e nunca responde
  const mudo = http.createServer(() => {});
  await new Promise((r) => mudo.listen(0, '127.0.0.1', r));
  // 2) /json/new responde, mas o WebSocket da aba nunca completa a abertura
  const sockets = [];
  const preso = net.createServer((s) => {
    const info = { s, fechado: false };
    sockets.push(info);
    s.on('error', () => {});
    s.on('end', () => {
      info.fechado = true;
    });
    s.on('close', () => {
      info.fechado = true;
    });
    s.resume(); // lê o pedido de abertura e nunca responde
  });
  await new Promise((r) => preso.listen(0, '127.0.0.1', r));
  const devtools = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${preso.address().port}/devtools/page/x` }));
  });
  await new Promise((r) => devtools.listen(0, '127.0.0.1', r));
  try {
    let inicio = Date.now();
    await assert.rejects(openTab(mudo.address().port, { prazoMs: 400 }), (e) => e.codigo === 'CHROME_NAO_ABRIU');
    assert.ok(Date.now() - inicio < 3000, `demorou ${Date.now() - inicio} ms`);
    inicio = Date.now();
    await assert.rejects(openTab(devtools.address().port, { prazoMs: 400 }), (e) => e.codigo === 'CHROME_NAO_ABRIU');
    assert.ok(Date.now() - inicio < 3000, `demorou ${Date.now() - inicio} ms`);
    // o socket da aba foi fechado ao vencer o prazo
    assert.ok(sockets.length >= 1);
    for (let k = 0; k < 40 && !sockets.every((i) => i.fechado); k += 1) await new Promise((r) => setTimeout(r, 50));
    assert.ok(sockets.every((i) => i.fechado), 'socket do WebSocket ficou aberto');
  } finally {
    mudo.closeAllConnections();
    devtools.closeAllConnections();
    for (const i of sockets) i.s.destroy();
    await Promise.all([mudo, preso, devtools].map((s) => new Promise((r) => s.close(r))));
  }
});
