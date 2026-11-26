// Limite de peso do 3D de um site (regra do repertório, kit/repertorio/como-usar.md, "3D: só com
// prova e com limite").
//
// O que conta como código do 3D (comprimido, como viaja pela rede):
// - todo .js, .mjs e .wasm de site/assets/3d/ (onde o estúdio guarda o 3D);
// - todo .js e .mjs de qualquer outra pasta do site que fale com o WebGL (o texto do arquivo cita
//   "webgl"): biblioteca 3D copiada para assets/vendor/ conta, GSAP e Lenis não;
// - todo .wasm do site (decodificador de modelo e afins).
// Limite: 200 KB. Cabe o three.js inteiro (three.module.min.js 0.170.0: 171 KB comprimido, medido
// em 2026-11-24) e pouco mais; as demos do estúdio, em WebGL puro, ficam muito abaixo disso.
//
// O que conta como modelo: cada arquivo de forma pronta (.glb, .obj, .fbx, .usdz, .ply, .stl,
// .drc), e o .gltf somado com o que ele cita (os .bin de buffers e as imagens de textura). Um .bin
// que nenhum .gltf cita conta sozinho. Limite: 1,5 MB por modelo; acima disso, no 4G do
// celular, a peça demora mais que a página toda.
// O checar reprova acima do limite (3d-pesado).
// Um .gltf acima do teto do painel (TETO_DO_GLTF, 16 MB) não é lido: conta só pelo tamanho, que já
// passa do limite do modelo.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { listarArquivos } from './caminhos.mjs';
import { TETO_DO_GLTF } from './regras-do-painel.mjs';

export const LIMITE_3D = Object.freeze({ js_kb_comprimido: 200, modelo_kb: 1536 });
const EXTENSOES_DE_CODIGO = Object.freeze(['.js', '.mjs', '.wasm']);
export const EXTENSOES_DE_MODELO = Object.freeze(['.glb', '.gltf', '.bin', '.obj', '.fbx', '.usdz', '.ply', '.stl', '.drc']);

const kb = (bytes) => Math.round(bytes / 102.4) / 10;
const termina = (nome, lista) => lista.some((e) => nome.toLowerCase().endsWith(e));
const ehDo3d = (rel) => rel.startsWith('assets/3d/');

// O arquivo de código conta como 3D? (ver o começo deste arquivo)
function codigoDo3d(pastaSite, rel) {
  if (!termina(rel, EXTENSOES_DE_CODIGO)) return false;
  if (ehDo3d(rel) || rel.toLowerCase().endsWith('.wasm')) return true;
  return fs.readFileSync(path.join(pastaSite, ...rel.split('/')), 'utf8').toLowerCase().includes('webgl');
}

// Os arquivos que um .gltf cita (buffers e imagens), relativos ao site; endereço data: fica dentro.
function citadosPeloGltf(pastaSite, rel) {
  const abs = path.join(pastaSite, ...rel.split('/'));
  if (fs.statSync(abs).size > TETO_DO_GLTF) return [];
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return [];
  }
  const pasta = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
  return [...(dados.buffers || []), ...(dados.images || [])]
    .map((b) => (b && typeof b.uri === 'string' ? b.uri : ''))
    .filter((uri) => uri && !uri.startsWith('data:'))
    .map((uri) => path.posix.normalize(pasta + decodeURIComponent(uri)));
}

export function conferir3d(pastaSite) {
  const todos = listarArquivos(pastaSite);
  const codigo = todos.filter((r) => codigoDo3d(pastaSite, r));
  let comprimido = 0;
  for (const rel of codigo) comprimido += gzipSync(fs.readFileSync(path.join(pastaSite, ...rel.split('/'))), { level: 9 }).length;
  const tamanho = (rel) => {
    try {
      return fs.statSync(path.join(pastaSite, ...rel.split('/'))).size;
    } catch {
      return 0;
    }
  };
  const gltfs = todos.filter((r) => r.toLowerCase().endsWith('.gltf')).map((r) => ({ arquivo: r, citados: citadosPeloGltf(pastaSite, r) }));
  const citados = new Set(gltfs.flatMap((g) => g.citados));
  const modelos = [
    ...gltfs.map((g) => ({ arquivo: g.arquivo, kb: kb(tamanho(g.arquivo) + g.citados.reduce((t, c) => t + tamanho(c), 0)), junto: g.citados })),
    ...todos.filter((r) => termina(r, EXTENSOES_DE_MODELO) && !r.toLowerCase().endsWith('.gltf') && !citados.has(r)).map((r) => ({ arquivo: r, kb: kb(tamanho(r)) })),
  ];
  return {
    codigo,
    js_kb_comprimido: kb(comprimido),
    modelos,
    limite: LIMITE_3D,
    acima: [
      ...(kb(comprimido) > LIMITE_3D.js_kb_comprimido ? [{ arquivo: 'codigo-3d', kb: kb(comprimido), limite_kb: LIMITE_3D.js_kb_comprimido }] : []),
      ...modelos.filter((m) => m.kb > LIMITE_3D.modelo_kb).map((m) => ({ ...m, limite_kb: LIMITE_3D.modelo_kb })),
    ],
  };
}

// Para o checar: RED 3d-pesado para cada coisa acima do limite.
export function anotar3d(pastaSite, red) {
  const r = conferir3d(pastaSite);
  for (const a of r.acima) {
    const oque = a.arquivo === 'codigo-3d' ? `o código do 3D (comprimido: ${r.codigo.join(', ')})` : `o modelo ${a.arquivo}${a.junto && a.junto.length ? ` com ${a.junto.join(', ')}` : ''}`;
    red.push({ pagina: '-', tipo: '3d-pesado', detalhe: `${oque} tem ${a.kb} KB; o limite é ${a.limite_kb} KB` });
  }
  return r;
}
