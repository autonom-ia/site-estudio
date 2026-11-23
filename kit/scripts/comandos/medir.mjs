// Mede cada página em cada tamanho de tela, com o movimento assentado:
// RED: página que rola para o lado, texto sobreposto (rolando até o par), texto cortado por um
// recorte, contraste computado abaixo de 4,5:1 (3:1 para texto grande) e, no celular, alvo de toque
// menor que 44 px. WARN: texto menor que 16 px no celular, contraste que não deu para medir
// (texto sobre foto ou degradê: confira no print) e texto que ficou invisível depois de assentar.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, escolherTamanhos } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { medir as medirNaPagina } from '../lib/pagina.mjs';
import { progresso } from '../lib/executar.mjs';

export const LIMITES = Object.freeze({
  sobreposicao: 6, // px nos dois eixos para contar como colisão
  vazamento: 4, // px de texto escondido por um recorte
  alvo_minimo: 44, // px de lado de um alvo de toque no celular
  texto_minimo_celular: 16, // px de texto no celular (aviso)
  maximo: 25, // achados por página e tamanho
});

export default async function medir(args) {
  const nome = nomeDoSite(args);
  const tamanhos = escolherTamanhos(args.opcoes);
  const reduzido = args.opcoes.reduzido === true;
  const c = abrirSite(nome);
  const paginas = paginasDoSite(c);
  const red = [];
  const warn = [];
  const resumo = [];
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      for (const t of tamanhos) {
        progresso(`Medindo ${pagina.rel} em ${t.largura} px...`);
        await visitar(sessao, pagina, t, { reduzido });
        const m = await sessao.avaliar(medirNaPagina, { ...LIMITES, movel: t.movel });
        for (const r of m.red) red.push({ pagina: pagina.rel, largura: t.largura, ...r });
        for (const w of m.warn) warn.push({ pagina: pagina.rel, largura: t.largura, ...w });
        resumo.push({ pagina: pagina.rel, largura: t.largura, textos: m.textos, contraste_medido: m.contraste_medido, contraste_sem_medir: m.contraste_sem_medir, red: m.red.length });
      }
    }
  } finally {
    await sessao.fechar();
  }
  const aprovado = red.length === 0;
  return {
    ok: aprovado,
    codigo: aprovado ? (warn.length ? 'MEDIDAS_COM_AVISOS' : 'MEDIDAS_OK') : 'MEDIDAS_REPROVADAS',
    sair: aprovado ? 0 : 2,
    avisos: warn.length ? [{ codigo: 'MEDIDAS_COM_AVISOS', dados: { total: warn.length } }] : [],
    arquivos: { site: c.rel('site') },
    dados: {
      tamanhos: tamanhos.map((t) => t.largura),
      movimento: reduzido ? 'reduzido' : 'assentado',
      red: red.length,
      warn: warn.length,
      vermelhos: red,
      amarelos: warn,
      por_pagina: resumo,
      limites: LIMITES,
    },
  };
}
