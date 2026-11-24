// Limite de peso do 3D: o código de site/assets/3d (comprimido) até 200 KB e cada modelo até 1,5 MB.
// A conta reprova acima do limite, e o checar reprova o site (3d-pesado).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conferir3d, anotar3d, LIMITE_3D } from '../scripts/lib/peso-3d.mjs';
import { acharNavegador } from '../scripts/lib/chrome.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const SEM_NAVEGADOR = !acharNavegador();
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
  assert.deepEqual(r.acima.map((a) => a.arquivo).sort(), ['assets/3d', 'img/carro.glb']);
  const red = [];
  anotar3d(pesado, red);
  assert.deepEqual(red.map((v) => v.tipo), ['3d-pesado', '3d-pesado']);
  assert.ok(red.every((v) => v.detalhe.includes('limite')), JSON.stringify(red));
});

test('o checar reprova o site com 3D acima do limite (3d-pesado)', { skip: SEM_NAVEGADOR ? 'sem Chrome, Edge ou Chromium nesta máquina' : false, timeout: 200000 }, () => {
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
