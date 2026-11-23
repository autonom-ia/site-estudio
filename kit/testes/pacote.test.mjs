// lib/pacote.mjs (montarPacote) e o comando pacote que a usa: a saída JSON do comando é a mesma de
// antes da extração, e o SHA-256 bate entre o zip gravado, o arquivo .sha256 e o que a lib devolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { montarPacote } from '../scripts/lib/pacote.mjs';
import { montarZip, lerZip } from '../scripts/lib/zip.mjs';
import { KitErro } from '../scripts/lib/saida.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
// Data fixa nos arquivos: o zip guarda a data de cada um, e o fuso do processo filho fica em UTC.
const DATA = new Date('2024-03-15T12:34:56Z');
const SITE = Object.freeze({
  'index.html': '<link rel="stylesheet" href="assets/site.css"><a href="sobre/">Sobre</a><img src="assets/img/foto.svg">',
  'sobre/index.html': '<link rel="stylesheet" href="../assets/site.css"><p>Sobre nós</p>',
  'assets/site.css': 'body{margin:0;background:url(img/fundo.svg)}',
  'assets/img/foto.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
  'assets/img/fundo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"></svg>',
  'assets/img/solto.png': 'nao-citado',
  'assets/anotacao.md': 'interno',
  'robots.txt': 'User-agent: *\n',
  '.nojekyll': '',
});
// Última linha do comando pacote, capturada com o código de antes da extração (mesmo site, mesma data).
const SAIDA_DE_ANTES = Object.freeze({
  ok: true,
  comando: 'pacote',
  codigo: 'PACOTE_PRONTO',
  resumo: 'O site está empacotado num .zip pronto para hospedar.',
  arquivos: { zip: '<base>/sites/igual/igual-site.zip', sha256: '<base>/sites/igual/igual-site.zip.sha256' },
  avisos: [{ codigo: 'ARQUIVO_NAO_USADO', dados: { arquivos: ['site/assets/img/solto.png'] } }],
  dados: { arquivos: 8, paginas: 2, fora_do_pacote: ['site/assets/anotacao.md'], tamanho_kb: 1.2, conteudo_kb: 0.4 },
});
const NO_ZIP = Object.freeze(['.nojekyll', 'assets/img/foto.svg', 'assets/img/fundo.svg', 'assets/img/solto.png', 'assets/site.css', 'index.html', 'robots.txt', 'sobre/index.html']);

function criarSite() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-pacote-'));
  const site = path.join(base, 'sites', 'igual', 'site');
  for (const [rel, texto] of Object.entries(SITE)) {
    const abs = path.join(site, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, texto);
    fs.utimesSync(abs, DATA, DATA);
  }
  return { base, site, pasta: path.join(base, 'sites', 'igual') };
}

function rodarPacote(base, env = {}) {
  const r = spawnSync(process.execPath, [DESPACHANTE, 'pacote', 'igual'], {
    encoding: 'utf8',
    env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ESTUDIO_SITES: path.join(base, 'sites'), ...env },
  });
  const linhas = r.stdout.trim().split('\n');
  return { codigo: r.status, ultima: linhas[linhas.length - 1], stdout: r.stdout, stderr: r.stderr };
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

test('pacote: a saída JSON é a mesma de antes da extração para lib/pacote.mjs', () => {
  const { base } = criarSite();
  try {
    const r = rodarPacote(base, { TZ: 'Etc/UTC' });
    assert.equal(r.codigo, 0, r.stdout + r.stderr);
    const baseComBarra = base.split(path.sep).join('/');
    const json = JSON.parse(r.ultima.split(baseComBarra).join('<base>'));
    assert.deepEqual(json, SAIDA_DE_ANTES);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('pacote: SHA-256 igual no zip gravado, no .sha256, na lib e no zip montado do jeito de antes', () => {
  const { base, site, pasta } = criarSite();
  try {
    const r = rodarPacote(base);
    assert.equal(r.codigo, 0, r.stdout + r.stderr);
    const gravado = fs.readFileSync(path.join(pasta, 'igual-site.zip'));
    const linhaSha = fs.readFileSync(path.join(pasta, 'igual-site.zip.sha256'), 'utf8');
    assert.equal(linhaSha, `${sha256(gravado)}  igual-site.zip\n`);
    const p = montarPacote(site);
    assert.equal(p.sha256, sha256(gravado));
    assert.ok(p.zip.equals(gravado), 'a lib monta exatamente o zip que o comando grava');
    // Do jeito de antes: as mesmas entradas, na ordem de listarArquivos, direto no montarZip.
    const antes = montarZip(NO_ZIP.map((rel) => ({ nome: rel, dados: fs.readFileSync(path.join(site, ...rel.split('/'))), data: DATA })));
    assert.equal(sha256(antes), p.sha256);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('montarPacote: devolve contagem, páginas, o que ficou fora e o que ninguém cita, sem gravar nada', () => {
  const { base, site, pasta } = criarSite();
  try {
    const p = montarPacote(site);
    assert.equal(p.arquivos, NO_ZIP.length);
    assert.equal(p.paginas, 2);
    assert.deepEqual(p.foraDoPacote, ['assets/anotacao.md']);
    assert.deepEqual(p.naoCitados, ['assets/img/solto.png']);
    const esperado = NO_ZIP.reduce((s, rel) => s + Buffer.byteLength(SITE[rel]), 0);
    assert.equal(p.conteudoBytes, esperado);
    assert.equal(p.sha256.length, 64);
    assert.deepEqual(lerZip(p.zip).map((e) => e.nome), [...NO_ZIP]);
    assert.ok(lerZip(p.zip).every((e) => e.crcOk));
    assert.deepEqual(fs.readdirSync(pasta), ['site'], 'montarPacote não grava zip nem .sha256');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('montarPacote: recusa arquivo privado com PACOTE_ARQUIVO_PRIVADO (saída 2), igual ao comando', () => {
  const { base, site } = criarSite();
  try {
    fs.writeFileSync(path.join(site, '.env'), 'SEGREDO=1');
    fs.mkdirSync(path.join(site, 'backup'));
    fs.writeFileSync(path.join(site, 'backup', 'velho.html'), 'x');
    assert.throws(() => montarPacote(site), (e) => {
      assert.ok(e instanceof KitErro);
      assert.equal(e.codigo, 'PACOTE_ARQUIVO_PRIVADO');
      assert.equal(e.sair, 2);
      assert.deepEqual(e.dados, { arquivos: ['site/.env', 'site/backup/'] });
      return true;
    });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
