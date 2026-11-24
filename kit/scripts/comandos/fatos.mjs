// Fato com fonte: todo número de 3+ dígitos, número de qualquer tamanho com % ou com mil, milhão ou
// bilhão, palavra com @ e endereço tel:/mailto: que aparece no texto visível de cada página precisa
// estar em fatos.md, numa linha com a fonte preenchida.
// Lê o texto pelo DOM do Chrome (innerText + content: do CSS + href dos links). Sem regex.
// RED (saída 2): achado sem fonte. Logradouro e nome próprio ficam com o revisor de fatos.
// RED fonte-de-exemplo: linha de fatos.md que ainda tem a fonte do molde (negócio fictício); os
// achados da página que só têm lastro nessas linhas saem com motivo fonte-de-exemplo.
import fs from 'node:fs';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, TAMANHOS } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { textoParaFatos } from '../lib/pagina.mjs';
import { lerTabelaDeFatos, tabelaDeFatosIlegivel, montarLastro, conferirTexto } from '../lib/fatos.mjs';
import { lerTexto } from '../lib/json.mjs';
import { progresso } from '../lib/executar.mjs';

export default async function fatos(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const temArquivo = fs.existsSync(c.fatos);
  const md = temArquivo ? lerTexto(c.fatos) : '';
  const linhas = lerTabelaDeFatos(md);
  const lastro = montarLastro(linhas);
  const paginas = paginasDoSite(c);
  const vermelhos = [];
  for (const l of linhas) {
    if (l.exemplo) vermelhos.push({ pagina: 'fatos.md', tipo: 'fonte-de-exemplo', trecho: l.fato, motivo: 'fonte-de-exemplo' });
  }
  let conferidos = 0;
  // o celular mostra o mesmo texto; o notebook basta e é mais rápido
  const notebook = TAMANHOS.find((t) => t.nome === 'notebook');
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      progresso(`Conferindo os fatos de ${pagina.rel}...`);
      await visitar(sessao, pagina, notebook);
      const lido = await sessao.avaliar(textoParaFatos);
      const r = conferirTexto(lido, lastro);
      conferidos += r.conferidos;
      for (const f of r.faltam) vermelhos.push({ pagina: pagina.rel, ...f });
    }
  } finally {
    await sessao.fechar();
  }
  const aprovado = vermelhos.length === 0;
  const avisos = [];
  if (!temArquivo) avisos.push({ codigo: 'FATOS_SEM_ARQUIVO', dados: { arquivo: c.rel('fatos.md') } });
  else if (tabelaDeFatosIlegivel(md)) avisos.push({ codigo: 'FATOS_TABELA_ILEGIVEL', dados: { arquivo: c.rel('fatos.md') } });
  return {
    ok: aprovado,
    codigo: aprovado ? 'FATOS_OK' : 'FATOS_SEM_FONTE',
    sair: aprovado ? 0 : 2,
    avisos,
    arquivos: { fatos: c.rel('fatos.md') },
    dados: {
      conferidos,
      linhas_com_fonte: linhas.filter((l) => l.comFonte).length,
      linhas_sem_fonte: linhas.filter((l) => !l.comFonte && !l.exemplo).length,
      linhas_do_exemplo: linhas.filter((l) => l.exemplo).length,
      red: vermelhos.length,
      vermelhos,
    },
  };
}
