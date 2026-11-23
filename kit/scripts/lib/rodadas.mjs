// Rodadas de revisão: lê o que cada rodada decidiu (revisao/rodada-N.json), monta o contexto que
// os revisores da rodada seguinte recebem (régua + aceitos e recusados) e mede a trajetória das
// notas (meta e oscilação de cada lente entre rodadas).
//
// revisao/rodada-N.json (escrito pela skill revisar, junto do rodada-N.md):
// { "rodada": N,
//   "notas": { "arte": 7.8, "geral": 8.0, "fatos": 8.5, "qa": 9.0 },
//   "visitante": { "oferta": "…", "proximo_passo": "…", "sem_ajuda": true },
//   "bloqueios": ["…"],
//   "aceitos": [{ "lente": "arte", "pagina": "index.html", "problema": "…", "conserto": "…" }],
//   "recusados": [{ "lente": "fatos", "problema": "…", "porque": "…" }] }
import fs from 'node:fs';
import path from 'node:path';
import { lerTexto } from './json.mjs';

export const LENTES = Object.freeze(['arte', 'geral', 'fatos', 'qa']);
export const NOME_DA_LENTE = Object.freeze({ arte: 'Diretor de arte', geral: 'Diretor geral', fatos: 'Revisor de fatos', qa: 'QA' });
export const META = Object.freeze({ media: 8.5, minima: 7.5, ruido_lente: 0.3, ruido_media: 0.1 });

const ehTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const umaCasa = (v) => Math.round(v * 10) / 10;

// Lista os problemas de um rodada-N.json; vazia = válido.
export function validarRodada(obj, n) {
  const erros = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['não é um objeto'];
  if (obj.rodada !== n) erros.push(`"rodada" deveria ser ${n}`);
  const notas = obj.notas && typeof obj.notas === 'object' ? obj.notas : null;
  if (!notas) erros.push('falta "notas"');
  for (const l of LENTES) {
    const v = notas ? notas[l] : undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 10) erros.push(`nota "${l}" precisa ser um número de 0 a 10`);
  }
  for (const campo of ['aceitos', 'recusados']) {
    if (!Array.isArray(obj[campo])) {
      erros.push(`"${campo}" precisa ser uma lista`);
      continue;
    }
    obj[campo].forEach((item, i) => {
      if (!item || !ehTexto(item.problema)) erros.push(`${campo}[${i}] sem "problema"`);
    });
  }
  if (obj.bloqueios !== undefined && !Array.isArray(obj.bloqueios)) erros.push('"bloqueios" precisa ser uma lista');
  return erros;
}

// Lê todas as rodadas anteriores a "ate" (exclusive). Devolve { rodadas, ilegiveis }.
export function lerRodadas(pastaRevisao, ate) {
  const rodadas = [];
  const ilegiveis = [];
  for (let n = 1; n < ate; n += 1) {
    const arquivo = path.join(pastaRevisao, `rodada-${n}.json`);
    if (!fs.existsSync(arquivo)) {
      if (fs.existsSync(path.join(pastaRevisao, `rodada-${n}.md`))) ilegiveis.push({ arquivo, erro: 'falta o rodada-N.json' });
      continue;
    }
    let obj;
    try {
      obj = JSON.parse(lerTexto(arquivo));
    } catch (e) {
      ilegiveis.push({ arquivo, erro: String(e.message).slice(0, 160) });
      continue;
    }
    const erros = validarRodada(obj, n);
    if (erros.length) ilegiveis.push({ arquivo, erro: erros.join('; ') });
    else rodadas.push(obj);
  }
  return { rodadas, ilegiveis };
}

// Nota de cada rodada, se passou, e a maior oscilação de cada lente entre rodadas seguidas.
export function trajetoria(rodadas) {
  const notas = rodadas.map((r) => {
    const valores = LENTES.map((l) => r.notas[l]);
    const media = umaCasa(valores.reduce((a, b) => a + b, 0) / valores.length);
    const bloqueios = Array.isArray(r.bloqueios) ? r.bloqueios.length : 0;
    const passou = media >= META.media && Math.min(...valores) >= META.minima && bloqueios === 0;
    return { rodada: r.rodada, ...Object.fromEntries(LENTES.map((l) => [l, r.notas[l]])), media, bloqueios, passou };
  });
  const oscilacao = {};
  for (const l of [...LENTES, 'media']) {
    let maior = 0;
    for (let i = 1; i < notas.length; i += 1) {
      if (notas[i].rodada !== notas[i - 1].rodada + 1) continue;
      maior = Math.max(maior, Math.abs(notas[i][l] - notas[i - 1][l]));
    }
    oscilacao[l] = umaCasa(maior);
  }
  const primeira = notas.find((n) => n.passou);
  return { notas, oscilacao, passou_na_rodada: primeira ? primeira.rodada : null };
}

function linhaDeItem(item, chaveFinal) {
  const lente = NOME_DA_LENTE[item.lente] || (ehTexto(item.lente) ? item.lente : 'revisor');
  const onde = ehTexto(item.pagina) ? ` (${item.pagina})` : '';
  const fim = ehTexto(item[chaveFinal]) ? `: ${item[chaveFinal].trim()}` : '';
  return `- ${lente}${onde}. ${item.problema.trim()}${fim}`;
}

// O texto que cada revisor da rodada n lê antes de avaliar.
export function montarContexto(n, regua, rodadas) {
  const partes = [
    `# Contexto da rodada ${n}`,
    '',
    'Leia este arquivo inteiro antes de avaliar. Ele traz a régua das notas e o que já foi decidido nas rodadas anteriores.',
    '',
    regua.trim(),
    '',
    '## O que já foi decidido',
    '',
  ];
  if (!rodadas.length) {
    partes.push('Esta é a primeira rodada: nada foi decidido ainda.', '');
    return `${partes.join('\n')}\n`;
  }
  partes.push(
    'Aceitos: o autor já corrigiu. Confira se a correção pegou; não peça o contrário do que foi corrigido.',
    'Recusados: a decisão está tomada pelo motivo escrito. Não reabra sem fato novo; se reabrir, diga qual é o fato novo.',
    '',
  );
  for (const r of [...rodadas].reverse()) {
    const media = umaCasa(LENTES.reduce((a, l) => a + r.notas[l], 0) / LENTES.length);
    partes.push(`### Rodada ${r.rodada} (média ${String(media).split('.').join(',')})`, '');
    partes.push('Aceitos:', ...(r.aceitos.length ? r.aceitos.map((i) => linhaDeItem(i, 'conserto')) : ['- nenhum']), '');
    partes.push('Recusados:', ...(r.recusados.length ? r.recusados.map((i) => linhaDeItem(i, 'porque')) : ['- nenhum']), '');
  }
  return `${partes.join('\n')}\n`;
}
