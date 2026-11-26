// lib/pacote.mjs (montarPacote) e o comando pacote que a usa: a saída JSON do comando é a mesma de
// antes da extração, e o SHA-256 bate entre o zip gravado, o arquivo .sha256 e o que a lib devolve.
// E o checar exige do vendor o que a ordem do site carrega, nunca o que o pacote chama de não usado.
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
import { vendorAusente, vendorExigido, VENDOR_SEMPRE } from '../scripts/comandos/checar.mjs';

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
  resumo: 'O site está pronto para pôr no ar, guardado num arquivo só.',
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

// O checar exige do vendor o que a ordem do site manda carregar (a fonte de verdade, a mesma que o
// montar lê), e o pacote avisa o que nenhuma página cita. A direção pode dispensar a rolagem suave
// (lenis: false): a página deixa de carregar o Lenis, o checar deixa de exigir, a pasta pode sair,
// e o pacote avisa enquanto ela ficar. Uma menção em comentário não faz o checar exigir de volta.
test('vendor: o checar exige o que a ordem carrega, nunca o que o pacote chama de não usado', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-vendor-'));
  const env = { ...process.env, ESTUDIO_NAO_ABRIR: '1', ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem-marca') };
  const estudio = (...args) => spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env });
  try {
    assert.equal(estudio('novo', 'calmo').status, 0);
    const site = path.join(base, 'calmo', 'site');
    const gerador = path.join(base, 'calmo', '_gerador');
    const lenis = path.join(site, 'assets', 'vendor', 'lenis');
    // com o Lenis ligado (o padrão do molde), tirar a pasta dele faz falta
    assert.deepEqual(await vendorAusente(site, gerador), []);
    fs.rmSync(lenis, { recursive: true });
    assert.deepEqual(await vendorAusente(site, gerador), ['assets/vendor/lenis/lenis.min.js', 'assets/vendor/lenis/lenis.css']);

    // a direção dispensa a rolagem suave: a página para de carregar o Lenis e ninguém exige mais
    const ordem = path.join(gerador, 'ordem.mjs');
    const texto = fs.readFileSync(ordem, 'utf8');
    assert.ok(texto.includes('  lenis: true,\n'), 'o molde traz a chave lenis');
    fs.writeFileSync(ordem, texto.replace('  lenis: true,\n', '  lenis: false,\n'));
    assert.equal(estudio('montar', 'calmo').status, 0);
    for (const pagina of ['index.html', path.join('a-oficina', 'index.html')]) {
      assert.ok(!fs.readFileSync(path.join(site, pagina), 'utf8').includes('lenis'), `${pagina} ainda carrega o Lenis`);
    }
    assert.deepEqual(await vendorAusente(site, gerador), []);
    // um comentário que cita o arquivo não é uso
    const css = path.join(site, 'assets', 'css', 'site.css');
    fs.appendFileSync(css, '\n/* sem rolagem suave: lenis.min.js e lenis.css ficaram de fora */\n');
    assert.deepEqual(await vendorAusente(site, gerador), []);

    // com a pasta de volta mas sem uso, o pacote avisa e o checar continua sem exigir
    fs.cpSync(path.join(RAIZ, 'kit', 'molde', 'site', 'assets', 'vendor', 'lenis'), lenis, { recursive: true });
    fs.writeFileSync(css, fs.readFileSync(path.join(RAIZ, 'kit', 'molde', 'site', 'assets', 'css', 'site.css')));
    const naoUsados = montarPacote(site).naoCitados;
    assert.ok(naoUsados.includes('assets/vendor/lenis/lenis.min.js'), naoUsados.join(', '));
    assert.deepEqual(await vendorExigido(gerador), [...VENDOR_SEMPRE]);
    assert.deepEqual((await vendorExigido(gerador)).filter((rel) => naoUsados.includes(rel)), []);

    // o que a ordem carrega continua exigido: sem o GSAP, reprova
    fs.rmSync(path.join(site, 'assets', 'vendor', 'gsap', 'gsap.min.js'));
    assert.deepEqual(await vendorAusente(site, gerador), ['assets/vendor/gsap/gsap.min.js']);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// --- 3D: .gltf fundo e .gltf grande (consertos trazidos do View Estúdio) ---

// O teto do painel para o .gltf (view_autonomia, framework/sites/painel/publicacao/pacote.mjs,
// GLTF_MAX_BYTES). Repetido aqui de propósito: o teste confere o número, não a constante do kit.
const TETO_DO_GLTF = 16 * 1024 * 1024;

// Um site mínimo com um .gltf em assets/3d, citado pela página.
function siteCom3d(t) {
  const site = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-3d-'));
  t.after(() => fs.rmSync(site, { recursive: true, force: true }));
  fs.mkdirSync(path.join(site, 'assets', '3d'), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<title>3D</title><script>carregar("assets/3d/cena.gltf")</script>');
  return { site, gltf: path.join(site, 'assets', '3d', 'cena.gltf') };
}

test('montarPacote: .gltf com o JSON aninhado muito fundo não derruba o pacote, e o nome lá no fundo ainda cita o .bin', (t) => {
  const { site, gltf } = siteCom3d(t);
  const fundura = 100000;
  fs.writeFileSync(gltf, `${'['.repeat(fundura)}"peca%20a.bin"${']'.repeat(fundura)}`);
  fs.writeFileSync(path.join(site, 'assets', '3d', 'peca a.bin'), 'x');
  let pacote;
  assert.doesNotThrow(() => {
    pacote = montarPacote(site);
  });
  assert.deepEqual(pacote.naoCitados, [], 'o nome decodificado no fundo do JSON cita o .bin');
});

test('montarPacote: .gltf acima do teto do painel (16 MB) reprova com PUBLICAR_3D_GRANDE sem ler o arquivo; no teto, passa', (t) => {
  const { site, gltf } = siteCom3d(t);
  fs.writeFileSync(gltf, '');
  fs.truncateSync(gltf, TETO_DO_GLTF + 1);
  const lidos = [];
  const ler = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (arquivo, ...resto) => {
    lidos.push(String(arquivo));
    return ler(arquivo, ...resto);
  });
  let erro;
  try {
    montarPacote(site);
  } catch (e) {
    erro = e;
  }
  assert.deepEqual([erro?.codigo, erro?.sair, erro?.dados?.arquivo], ['PUBLICAR_3D_GRANDE', 2, 'site/assets/3d/cena.gltf'], String(erro));
  assert.deepEqual(lidos.filter((a) => a.endsWith('cena.gltf')), [], 'o .gltf acima do teto não é lido');
  fs.truncateSync(gltf, TETO_DO_GLTF);
  assert.doesNotThrow(() => montarPacote(site));
});
