// Roda o axe-core (versão fixa em kit/vendor/axe/) dentro de cada página, em cada tamanho de tela,
// com o movimento assentado. Regras WCAG 2.0, 2.1 e 2.2 (A e AA) e boas práticas.
// RED: violação "critical" ou "serious". WARN: "moderate" e "minor".
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, escolherTamanhos, TAMANHOS } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { KIT } from '../lib/caminhos.mjs';
import { falha } from '../lib/saida.mjs';
import { progresso } from '../lib/executar.mjs';

export const PASTA_AXE = path.join(KIT, 'vendor', 'axe');
export const ETIQUETAS = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice']);
const GRAVES = new Set(['critical', 'serious']);
const PADRAO = TAMANHOS.filter((t) => t.nome === 'celular' || t.nome === 'notebook');

export function versaoDoAxe() {
  try {
    return fs.readFileSync(path.join(PASTA_AXE, 'VERSAO'), 'utf8').trim();
  } catch {
    return null;
  }
}

// roda dentro da página
async function rodarAxe(etiquetas) {
  const r = await window.axe.run(document, { runOnly: { type: 'tag', values: etiquetas }, resultTypes: ['violations'] });
  return r.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact || 'minor',
    ajuda: v.help,
    nos: v.nodes.slice(0, 4).map((n) => ({ alvo: n.target.join(' '), resumo: String(n.failureSummary || '').split('\n').slice(0, 2).join(' ') })),
    total: v.nodes.length,
  }));
}

export default async function acessibilidade(args) {
  const nome = nomeDoSite(args);
  const tamanhos = escolherTamanhos(args.opcoes, PADRAO);
  const c = abrirSite(nome);
  const arquivoAxe = path.join(PASTA_AXE, 'axe.min.js');
  if (!fs.existsSync(arquivoAxe)) falha('AXE_AUSENTE', { arquivo: 'kit/vendor/axe/axe.min.js' });
  const codigoAxe = fs.readFileSync(arquivoAxe, 'utf8');
  const paginas = paginasDoSite(c);
  const red = [];
  const warn = [];
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      for (const t of tamanhos) {
        progresso(`Conferindo acessibilidade de ${pagina.rel} em ${t.largura} px...`);
        await visitar(sessao, pagina, t);
        await sessao.tab.evaluate(`${codigoAxe}\n;void 0`, 60000);
        const violacoes = await sessao.avaliar(rodarAxe, ETIQUETAS);
        for (const v of violacoes) {
          const item = { pagina: pagina.rel, largura: t.largura, ...v };
          if (GRAVES.has(v.impacto)) red.push(item);
          else warn.push(item);
        }
      }
    }
  } finally {
    await sessao.fechar();
  }
  const aprovado = red.length === 0;
  return {
    ok: aprovado,
    codigo: aprovado ? (warn.length ? 'ACESSIBILIDADE_COM_AVISOS' : 'ACESSIBILIDADE_OK') : 'ACESSIBILIDADE_REPROVADA',
    sair: aprovado ? 0 : 2,
    avisos: warn.length ? [{ codigo: 'ACESSIBILIDADE_COM_AVISOS', dados: { total: warn.length } }] : [],
    arquivos: { site: c.rel('site') },
    dados: { axe: versaoDoAxe(), tamanhos: tamanhos.map((t) => t.largura), red: red.length, warn: warn.length, vermelhos: red, amarelos: warn },
  };
}
