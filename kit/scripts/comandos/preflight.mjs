// Roda checar, medir, acessibilidade e fatos, nesta ordem, e soma tudo num GREEN ou RED.
// Saída 2 se qualquer etapa reprovar. O detalhe de cada etapa vem em dados.etapas.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { progresso } from '../lib/executar.mjs';
import checar from './checar.mjs';
import medir from './medir.mjs';
import acessibilidade from './acessibilidade.mjs';
import fatos from './fatos.mjs';

const ETAPAS = Object.freeze([
  ['checar', checar],
  ['medir', medir],
  ['acessibilidade', acessibilidade],
  ['fatos', fatos],
]);

export default async function preflight(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const etapas = {};
  const vermelhos = [];
  let amarelos = 0;
  for (const [etapa, fn] of ETAPAS) {
    progresso(`Preflight: ${etapa}...`);
    const r = await fn(args);
    const red = Array.isArray(r.dados.vermelhos) ? r.dados.vermelhos : [];
    const warn = Array.isArray(r.dados.amarelos) ? r.dados.amarelos.length : 0;
    etapas[etapa] = { ok: r.ok, codigo: r.codigo, red: red.length, warn };
    for (const v of red) vermelhos.push({ etapa, ...v });
    amarelos += warn;
  }
  const aprovado = vermelhos.length === 0;
  return {
    ok: aprovado,
    codigo: aprovado ? (amarelos ? 'PREFLIGHT_COM_AVISOS' : 'PREFLIGHT_OK') : 'PREFLIGHT_REPROVADO',
    sair: aprovado ? 0 : 2,
    avisos: amarelos ? [{ codigo: 'PREFLIGHT_COM_AVISOS', dados: { total: amarelos } }] : [],
    arquivos: { site: c.rel('site') },
    dados: { etapas, red: vermelhos.length, warn: amarelos, vermelhos },
  };
}
