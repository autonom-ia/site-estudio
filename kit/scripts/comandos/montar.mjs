// Roda o gerador do site (sites/<nome>/_gerador/montar.mjs) num processo separado e escreve as
// páginas em site/. O gerador é código do site: erro nele vira MONTAR_FALHOU com o detalhe.
import fs from 'node:fs';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirPastaDoSite } from '../lib/site.mjs';
import { rodar, ultimasLinhas } from '../lib/executar.mjs';
import { falha } from '../lib/saida.mjs';

export async function rodarGerador(c) {
  if (!fs.existsSync(c.montar)) falha('GERADOR_AUSENTE', { arquivo: c.rel('_gerador', 'montar.mjs') });
  const r = await rodar(process.execPath, [c.montar], { cwd: c.pasta, timeoutMs: 120000 });
  const linhas = r.saida.trim().split('\n');
  let json = null;
  try {
    json = JSON.parse(linhas[linhas.length - 1]);
  } catch {}
  if (r.codigo !== 0 || !json || !json.ok) {
    falha('MONTAR_FALHOU', {
      detalhe: (json && json.erro) || ultimasLinhas(`${r.erro}\n${r.saida}`, 14) || `saída ${r.codigo}`,
      tempo_esgotado: r.tempoEsgotado,
    });
  }
  return json;
}

export default async function montar(args) {
  const nome = nomeDoSite(args);
  const c = abrirPastaDoSite(nome);
  const r = await rodarGerador(c);
  return {
    ok: true,
    codigo: 'SITE_MONTADO',
    arquivos: { site: c.rel('site') },
    dados: { paginas: r.paginas, removidas: r.removidas || [] },
  };
}
