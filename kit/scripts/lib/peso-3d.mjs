// Limite de peso do 3D de um site (regra do repertório, kit/repertorio/como-usar.md, "3D: só com
// prova e com limite"). Todo o código do 3D mora em site/assets/3d/; modelo é arquivo de forma
// pronta (.glb, .gltf, .obj...) em qualquer lugar do site.
// - JavaScript do 3D (soma de assets/3d/, como viaja comprimido): até 200 KB. Cabe o three.js
//   inteiro (three.module.min.js 0.170.0: 171 KB comprimido, medido em 2026-11-24) e pouco mais;
//   as demos do estúdio, em WebGL puro, ficam muito abaixo disso.
// - Cada modelo: até 1,5 MB. Acima disso, no 4G do celular, a peça demora mais que a página toda.
// O checar reprova acima do limite (3d-pesado).
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { listarArquivos } from './caminhos.mjs';

export const LIMITE_3D = Object.freeze({ js_kb_comprimido: 200, modelo_kb: 1536 });
const EXTENSOES_DE_CODIGO = Object.freeze(['.js', '.mjs', '.wasm']);
export const EXTENSOES_DE_MODELO = Object.freeze(['.glb', '.gltf', '.bin', '.obj', '.fbx', '.usdz', '.ply', '.stl', '.drc', '.ktx2']);

const kb = (bytes) => Math.round(bytes / 102.4) / 10;
const termina = (nome, lista) => lista.some((e) => nome.toLowerCase().endsWith(e));

export function conferir3d(pastaSite) {
  const codigo = listarArquivos(path.join(pastaSite, 'assets', '3d')).filter((r) => termina(r, EXTENSOES_DE_CODIGO));
  let comprimido = 0;
  for (const rel of codigo) comprimido += gzipSync(fs.readFileSync(path.join(pastaSite, 'assets', '3d', ...rel.split('/'))), { level: 9 }).length;
  const modelos = listarArquivos(pastaSite)
    .filter((r) => termina(r, EXTENSOES_DE_MODELO))
    .map((rel) => ({ arquivo: rel, kb: kb(fs.statSync(path.join(pastaSite, ...rel.split('/'))).size) }));
  return {
    codigo: codigo.map((r) => `assets/3d/${r}`),
    js_kb_comprimido: kb(comprimido),
    modelos,
    limite: LIMITE_3D,
    acima: [
      ...(kb(comprimido) > LIMITE_3D.js_kb_comprimido ? [{ arquivo: 'assets/3d', kb: kb(comprimido), limite_kb: LIMITE_3D.js_kb_comprimido }] : []),
      ...modelos.filter((m) => m.kb > LIMITE_3D.modelo_kb).map((m) => ({ ...m, limite_kb: LIMITE_3D.modelo_kb })),
    ],
  };
}

// Para o checar: RED 3d-pesado para cada coisa acima do limite.
export function anotar3d(pastaSite, red) {
  const r = conferir3d(pastaSite);
  for (const a of r.acima) {
    const oque = a.arquivo === 'assets/3d' ? 'o código do 3D (soma de assets/3d, comprimido)' : `o modelo ${a.arquivo}`;
    red.push({ pagina: '-', tipo: '3d-pesado', detalhe: `${oque} tem ${a.kb} KB; o limite é ${a.limite_kb} KB` });
  }
  return r;
}
