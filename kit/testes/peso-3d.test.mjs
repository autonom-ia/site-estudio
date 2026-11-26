// Limite de peso do 3D: o código de site/assets/3d (comprimido) até 200 KB e cada modelo até 1,5 MB.
// A conta reprova acima do limite, e o checar reprova o site (3d-pesado).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesDoNavegador } from './fixtures/navegador.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conferir3d, anotar3d, LIMITE_3D } from '../scripts/lib/peso-3d.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const KB = 1024;

let base;
before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-peso3d-'));
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

// Bytes que não comprimem (o pior caso: o comprimido fica do tamanho do arquivo).
const escrever = (arquivo, bytes) => {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, crypto.randomBytes(bytes));
};

test('o limite declarado: 200 KB de código 3D comprimido e 1,5 MB por modelo', () => {
  assert.deepEqual({ ...LIMITE_3D }, { js_kb_comprimido: 200, modelo_kb: 1536 });
});

test('a conta do 3D passa abaixo do limite e reprova acima, no código e em cada modelo', () => {
  const site = path.join(base, 'leve');
  fs.mkdirSync(path.join(site, 'assets', '3d'), { recursive: true });
  // texto repetido comprime muito: 400 KB no disco viram poucos KB, e é o comprimido que conta
  fs.writeFileSync(path.join(site, 'assets', '3d', 'cena.js'), 'var a = 1;\n'.repeat(40000));
  escrever(path.join(site, 'assets', 'modelos', 'peca.glb'), 1400 * KB);
  const leve = conferir3d(site);
  assert.deepEqual(leve.acima, []);
  assert.deepEqual(leve.codigo, ['assets/3d/cena.js']);
  assert.ok(leve.js_kb_comprimido < 10, `${leve.js_kb_comprimido} KB`);
  assert.equal(leve.modelos.length, 1);

  const pesado = path.join(base, 'pesado');
  escrever(path.join(pesado, 'assets', '3d', 'biblioteca.js'), 150 * KB);
  escrever(path.join(pesado, 'assets', '3d', 'motor.wasm'), 60 * KB);
  escrever(path.join(pesado, 'assets', '3d', 'peca.gltf'), 10 * KB);
  escrever(path.join(pesado, 'img', 'carro.glb'), 1600 * KB);
  const r = conferir3d(pesado);
  assert.deepEqual(r.acima.map((a) => a.arquivo).sort(), ['codigo-3d', 'img/carro.glb']);
  const red = [];
  anotar3d(pesado, red);
  assert.deepEqual(red.map((v) => v.tipo), ['3d-pesado', '3d-pesado']);
  assert.ok(red.every((v) => v.detalhe.includes('limite')), JSON.stringify(red));
});

test('conta toda biblioteca que fala com o WebGL, em qualquer pasta, e soma o .gltf com os .bin e texturas dele', () => {
  const site = path.join(base, 'vendor');
  // biblioteca 3D copiada para vendor: o texto dela cita webgl, então conta mesmo fora de assets/3d
  const biblioteca = Buffer.concat([Buffer.from('/* getContext("webgl2") */'), crypto.randomBytes(205 * KB)]);
  fs.mkdirSync(path.join(site, 'assets', 'vendor', 'tres'), { recursive: true });
  fs.writeFileSync(path.join(site, 'assets', 'vendor', 'tres', 'tres.min.js'), biblioteca);
  // movimento comum (sem WebGL) não conta
  escrever(path.join(site, 'assets', 'vendor', 'gsap', 'gsap.min.js'), 300 * KB);
  const r = conferir3d(site);
  assert.deepEqual(r.codigo, ['assets/vendor/tres/tres.min.js']);
  assert.deepEqual(r.acima.map((a) => a.arquivo), ['codigo-3d']);

  const comModelo = path.join(base, 'gltf');
  fs.mkdirSync(path.join(comModelo, 'modelos'), { recursive: true });
  fs.writeFileSync(path.join(comModelo, 'modelos', 'peca.gltf'), JSON.stringify({ buffers: [{ uri: 'peca.bin' }, { uri: 'data:application/octet-stream;base64,AAAA' }], images: [{ uri: 'tex/cor.png' }] }));
  escrever(path.join(comModelo, 'modelos', 'peca.bin'), 1000 * KB);
  escrever(path.join(comModelo, 'modelos', 'tex', 'cor.png'), 600 * KB);
  escrever(path.join(comModelo, 'modelos', 'solto.bin'), 10 * KB);
  const m = conferir3d(comModelo);
  // o .gltf sozinho é pequeno; com o .bin e a textura passa de 1,5 MB. O .bin citado não conta duas vezes.
  assert.deepEqual(m.modelos.map((x) => x.arquivo).sort(), ['modelos/peca.gltf', 'modelos/solto.bin']);
  assert.deepEqual(m.acima.map((x) => x.arquivo), ['modelos/peca.gltf']);
  const red = [];
  anotar3d(comModelo, red);
  assert.ok(red[0].detalhe.includes('modelos/peca.bin') && red[0].detalhe.includes('modelos/tex/cor.png'), red[0].detalhe);
});

// O teto do painel para o .gltf (view_autonomia, framework/sites/painel/publicacao/pacote.mjs,
// GLTF_MAX_BYTES). Repetido aqui de propósito: o teste confere o número, não a constante do kit.
const TETO_DO_GLTF = 16 * 1024 * 1024;

test('.gltf acima do teto do painel (16 MB) não é lido: conta pelo tamanho e reprova como modelo', (t) => {
  const site = path.join(base, 'gltf-grande');
  fs.mkdirSync(path.join(site, 'modelos'), { recursive: true });
  const gltf = path.join(site, 'modelos', 'cena.gltf');
  fs.writeFileSync(gltf, '');
  fs.truncateSync(gltf, TETO_DO_GLTF + 1);
  const lidos = [];
  const ler = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (arquivo, ...resto) => {
    lidos.push(String(arquivo));
    return ler(arquivo, ...resto);
  });
  const r = conferir3d(site);
  assert.deepEqual(lidos.filter((a) => a.endsWith('cena.gltf')), [], 'o .gltf acima do teto não é lido');
  assert.deepEqual(r.acima.map((a) => a.arquivo), ['modelos/cena.gltf']);
});

test('o checar reprova o site com 3D acima do limite (3d-pesado)', opcoesDoNavegador(200000), () => {
  const env = { ...process.env, ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_MARCA: path.join(base, 'sem-marca'), ESTUDIO_NAO_ABRIR: '1' };
  const estudio = (...args) => {
    const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env, timeout: 180000 });
    const linhas = (r.stdout || '').trim().split('\n');
    return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
  };
  assert.equal(estudio('novo', 'pesado').codigo, 0);
  const tipos = () => estudio('checar', 'pesado').json.dados.vermelhos.map((v) => v.tipo);
  assert.equal(tipos().includes('3d-pesado'), false);
  escrever(path.join(base, 'sites', 'pesado', 'site', 'assets', '3d', 'biblioteca.js'), 210 * KB);
  assert.ok(tipos().includes('3d-pesado'));
});

test('uri do .gltf com "%" solto não derruba a conta: vale o nome como está escrito', () => {
  const site = path.join(base, 'uri-solta');
  fs.mkdirSync(path.join(site, 'assets', 'modelos'), { recursive: true });
  fs.writeFileSync(path.join(site, 'assets', 'modelos', 'peca.gltf'), JSON.stringify({ buffers: [{ uri: 'peca 100%.bin' }] }));
  escrever(path.join(site, 'assets', 'modelos', 'peca 100%.bin'), 20 * KB);
  const r = conferir3d(site);
  assert.deepEqual(r.modelos.map((m) => [m.arquivo, m.junto]), [['assets/modelos/peca.gltf', ['assets/modelos/peca 100%.bin']]]);
  assert.ok(r.modelos[0].kb >= 20, `${r.modelos[0].kb} KB`);
});
