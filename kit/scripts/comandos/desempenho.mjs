// Peso e velocidade de cada página: no celular com rede 4G emulada, no notebook sem limite de rede.
// Só relatório (decisão: sem teto de peso). Mede bytes transferidos, número de pedidos, os arquivos
// mais pesados, LCP, CLS, FCP e tempos de carregamento. Nunca reprova.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, TAMANHOS } from '../lib/site.mjs';
import { abrirSessao } from '../lib/sessao.mjs';
import { pronta, metricas } from '../lib/pagina.mjs';
import { progresso } from '../lib/executar.mjs';
import { aviso } from '../lib/saida.mjs';
import { esperar } from '../lib/cdp.mjs';

// 4G lento (o mesmo perfil que as ferramentas de medição usam para celular)
export const REDE_4G = Object.freeze({ offline: false, latency: 150, downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8), uploadThroughput: Math.round((750 * 1024) / 8) });
const SEM_LIMITE = Object.freeze({ offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const ARQUIVO_PESADO = 500 * 1024; // só para o aviso: um arquivo acima disso merece um olhar

const kb = (b) => Math.round(b / 102.4) / 10;

export default async function desempenho(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const paginas = paginasDoSite(c);
  const cenarios = [
    { tamanho: TAMANHOS.find((t) => t.nome === 'celular'), rede: '4g', condicoes: REDE_4G },
    { tamanho: TAMANHOS.find((t) => t.nome === 'notebook'), rede: 'sem-limite', condicoes: SEM_LIMITE },
  ];
  const medidas = [];
  const avisos = [];
  const pesados = new Set();
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      for (const cen of cenarios) {
        progresso(`Medindo o carregamento de ${pagina.rel} (${cen.tamanho.largura} px, rede ${cen.rede})...`);
        await sessao.tamanho(cen.tamanho);
        await sessao.tab.send('Network.emulateNetworkConditions', cen.condicoes);
        sessao.zerar();
        const inicio = Date.now();
        await sessao.ir(sessao.url(pagina.url));
        await sessao.avaliar(pronta);
        await esperar(800);
        const m = await sessao.avaliar(metricas);
        const rede = sessao.rede();
        const bytes = rede.arquivos.reduce((s, a) => s + a.bytes, 0);
        const maiores = [...rede.arquivos].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((a) => ({ url: a.url, kb: kb(a.bytes) }));
        for (const a of rede.arquivos) {
          if (a.bytes > ARQUIVO_PESADO && !pesados.has(a.url)) {
            pesados.add(a.url);
            avisos.push(aviso('ARQUIVO_PESADO', { url: a.url, kb: kb(a.bytes) }));
          }
        }
        medidas.push({
          pagina: pagina.rel,
          largura: cen.tamanho.largura,
          rede: cen.rede,
          peso_kb: kb(bytes),
          pedidos: rede.arquivos.length,
          ...m,
          parede_ms: Date.now() - inicio,
          maiores,
        });
      }
    }
    await sessao.tab.send('Network.emulateNetworkConditions', SEM_LIMITE);
  } finally {
    await sessao.fechar();
  }
  return {
    ok: true,
    codigo: 'DESEMPENHO_MEDIDO',
    avisos,
    arquivos: { site: c.rel('site') },
    dados: { medidas, rede_4g: { latencia_ms: REDE_4G.latency, download_kbps: 1600, upload_kbps: 750 } },
  };
}
