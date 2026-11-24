// Rodadas de revisão: lê o que cada rodada decidiu (revisao/rodada-N.json), monta o contexto que
// os revisores da rodada seguinte recebem (régua + aceitos e recusados, sem nota nenhuma: nota
// anterior ancora o revisor novo) e mede as duas metas em separado:
// - passar (média >= 8,5, nenhuma lente < 7,5, nenhum bloqueio) em até 2 rodadas;
// - estabilidade: a mesma lente, no mesmo estado do site, avaliada por dois revisores novos
//   (notas e reavaliacao.notas, sem conserto no meio), varia no máximo 0,3. Entre rodadas há
//   conserto, então a diferença ali é progresso, não ruído, e não entra nessa medida.
//   A reavaliação pode ser parcial: só as lentes reavaliadas (por exemplo, só a de arte) entram na
//   conta; a lente que não foi reavaliada fica null, e a média só sai com as 4. A meta das 4 lentes
//   (metas.estabilidade) só vira true com as 4 medidas; a de uma lente se lê no campo dela.
//
// revisao/rodada-N.json (escrito pela skill revisar, junto do rodada-N.md):
// { "rodada": N,
//   "notas": { "arte": 7.8, "geral": 8.0, "fatos": 8.5, "qa": 9.0 },
//   "visitante": { "oferta": "…", "proximo_passo": "…", "sem_ajuda": true, "bate_com_brief": true },
//   "bloqueios": ["…"],
//   "aceitos": [{ "lente": "arte", "pagina": "index.html", "problema": "…", "conserto": "…" }],
//   "recusados": [{ "lente": "fatos", "problema": "…", "porque": "…" }],
//   "reavaliacao": { "notas": { "arte": 7.9, "geral": 8.1, "fatos": 8.5, "qa": 8.8 } } }  ← opcional
//   (parcial vale: { "notas": { "arte": 7.9 } } reavalia só a lente de arte)
import fs from 'node:fs';
import path from 'node:path';
import { lerTexto } from './json.mjs';

export const LENTES = Object.freeze(['arte', 'geral', 'fatos', 'qa']);
export const NOME_DA_LENTE = Object.freeze({ arte: 'Diretor de arte', geral: 'Diretor geral', fatos: 'Revisor de fatos', qa: 'QA' });
export const META = Object.freeze({ media: 8.5, minima: 7.5, rodadas: 2, estabilidade_lente: 0.3, teto_geral_visitante: 7 });

const ehTexto = (v) => typeof v === 'string' && v.trim().length > 0;
const umaCasa = (v) => Math.round(v * 10) / 10;
const ehNota = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10;
// Soma em centésimos: a comparação com 8,5 não depende do arredondamento de ponto flutuante.
const centesimos = (v) => Math.round(v * 100);
const mediaExata = (notas) => LENTES.reduce((a, l) => a + notas[l], 0) / LENTES.length;
const atingeMedia = (notas) => LENTES.reduce((a, l) => a + centesimos(notas[l]), 0) >= centesimos(META.media) * LENTES.length;

function errosDeNotas(notas, prefixo) {
  return LENTES.filter((l) => !ehNota(notas ? notas[l] : undefined)).map((l) => `${prefixo} "${l}" precisa ser um número de 0 a 10`);
}

// A reavaliação traz uma ou mais lentes (todas, ou só a que se quer medir), cada uma com nota válida.
function errosDaReavaliacao(reavaliacao) {
  const notas = reavaliacao && typeof reavaliacao === 'object' ? reavaliacao.notas : null;
  if (!notas || typeof notas !== 'object' || Array.isArray(notas)) return ['falta "reavaliacao.notas"'];
  const chaves = Object.keys(notas);
  if (!chaves.length) return ['"reavaliacao.notas" precisa de pelo menos uma lente (arte, geral, fatos ou qa)'];
  return chaves.map((l) => {
    if (!LENTES.includes(l)) return `reavaliacao: "${l}" não é uma lente (arte, geral, fatos ou qa)`;
    return ehNota(notas[l]) ? null : `reavaliacao: nota "${l}" precisa ser um número de 0 a 10`;
  }).filter(Boolean);
}

function errosDoVisitante(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['falta "visitante" (o teste do visitante do diretor geral)'];
  const erros = [];
  for (const campo of ['oferta', 'proximo_passo']) if (!ehTexto(v[campo])) erros.push(`"visitante.${campo}" precisa ser a resposta do visitante`);
  if (typeof v.sem_ajuda !== 'boolean') erros.push('"visitante.sem_ajuda" precisa ser true ou false');
  if (v.bate_com_brief !== undefined && typeof v.bate_com_brief !== 'boolean') erros.push('"visitante.bate_com_brief" precisa ser true ou false');
  return erros;
}

// Lista os problemas de um rodada-N.json; vazia = válido.
export function validarRodada(obj, n) {
  const erros = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['não é um objeto'];
  if (obj.rodada !== n) erros.push(`"rodada" deveria ser ${n}`);
  const notas = obj.notas && typeof obj.notas === 'object' ? obj.notas : null;
  if (!notas) erros.push('falta "notas"');
  erros.push(...errosDeNotas(notas, 'nota'));
  erros.push(...errosDoVisitante(obj.visitante));
  if (obj.reavaliacao !== undefined) erros.push(...errosDaReavaliacao(obj.reavaliacao));
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

// O que o código impõe sozinho, sem depender do orquestrador copiar para "bloqueios".
// O teto 7 do diretor geral segue a régua: oferta ou próximo passo que não batem com o brief
// (bate_com_brief: false), ou o passo que não dá para fazer sem ajuda (sem_ajuda: false).
// Só o "sem ajuda" é bloqueio; o "não bate" segura a rodada pela nota do geral.
function alertasDaRodada(r) {
  const alertas = [];
  if (r.visitante.sem_ajuda === false) alertas.push('visitante_sem_ajuda');
  if (r.visitante.bate_com_brief === false) alertas.push('visitante_nao_bate');
  if (alertas.length && r.notas.geral > META.teto_geral_visitante) alertas.push('geral_acima_do_teto');
  return alertas;
}

function resumoDaRodada(r) {
  const valores = LENTES.map((l) => r.notas[l]);
  const alertas = alertasDaRodada(r);
  const bloqueios = (Array.isArray(r.bloqueios) ? r.bloqueios.length : 0) + (alertas.includes('visitante_sem_ajuda') ? 1 : 0);
  const passou = atingeMedia(r.notas) && Math.min(...valores) >= META.minima && bloqueios === 0;
  const lentes = Object.fromEntries(LENTES.map((l) => [l, r.notas[l]]));
  return { rodada: r.rodada, ...lentes, media: umaCasa(mediaExata(r.notas)), bloqueios, alertas, passou };
}

const reavaliou = (r, l) => ehNota(r.reavaliacao.notas[l]);

// Maior diferença de cada lente entre a avaliação e a reavaliação do mesmo estado; null se não houve.
// Lente que nenhuma reavaliação mediu fica null; a média só compara rodadas reavaliadas nas 4 lentes.
function estabilidade(rodadas) {
  const medidas = rodadas.filter((r) => r.reavaliacao && r.reavaliacao.notas);
  if (!medidas.length) return null;
  const maior = (lista, f) => (lista.length ? umaCasa(Math.max(...lista.map(f))) : null);
  const resultado = Object.fromEntries(LENTES.map((l) => [
    l,
    maior(medidas.filter((r) => reavaliou(r, l)), (r) => Math.abs(r.notas[l] - r.reavaliacao.notas[l])),
  ]));
  const completas = medidas.filter((r) => LENTES.every((l) => reavaliou(r, l)));
  resultado.media = maior(completas, (r) => Math.abs(mediaExata(r.notas) - mediaExata(r.reavaliacao.notas)));
  resultado.rodadas = medidas.map((r) => r.rodada);
  resultado.lentes_medidas = LENTES.filter((l) => resultado[l] !== null).length;
  return resultado;
}

// A meta de estabilidade é das 4 lentes: true só com as 4 medidas e nenhuma acima de 0,3; false se
// alguma lente medida já passou de 0,3 (a meta não tem mais como ser cumprida); null enquanto faltar
// lente. A meta de uma lente só (como a da arte) se lê no campo dela em estabilidade.
function metaDeEstabilidade(est) {
  if (!est) return null;
  const dentro = (l) => centesimos(est[l]) <= centesimos(META.estabilidade_lente);
  if (LENTES.some((l) => est[l] !== null && !dentro(l))) return false;
  return est.lentes_medidas === LENTES.length ? true : null;
}

// Nota de cada rodada, se passou, e as duas metas (rodadas e estabilidade) medidas em separado.
export function trajetoria(rodadas) {
  const notas = rodadas.map(resumoDaRodada);
  const primeira = notas.find((n) => n.passou);
  const passouNaRodada = primeira ? primeira.rodada : null;
  const est = estabilidade(rodadas);
  const metas = {
    em_ate_2_rodadas: passouNaRodada !== null && passouNaRodada <= META.rodadas,
    estabilidade: metaDeEstabilidade(est),
  };
  return { notas, passou_na_rodada: passouNaRodada, estabilidade: est, metas };
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
    partes.push(`### Rodada ${r.rodada}`, '');
    partes.push('Aceitos:', ...(r.aceitos.length ? r.aceitos.map((i) => linhaDeItem(i, 'conserto')) : ['- nenhum']), '');
    partes.push('Recusados:', ...(r.recusados.length ? r.recusados.map((i) => linhaDeItem(i, 'porque')) : ['- nenhum']), '');
  }
  return `${partes.join('\n')}\n`;
}
