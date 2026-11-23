// Mostra o antes e o depois lado a lado, com as mudanças numeradas, no navegador.
// Uso: ./estudio comparar <nome> [--sem-navegador]. Precisa do "antes" rodado antes da mudança e
// de revisao/antes-depois/mudancas.json com {"pedido": "...", "mudancas": [{"titulo", "porque"}]}.
// Reprova (saída 2) com menos de 2 mudanças ou com o site igual ao de antes; avisa com mais de 3.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { copiarPasta, ehPasta, FERR } from '../lib/caminhos.mjs';
import { lerJson, escreverTexto } from '../lib/json.mjs';
import { falha, reprovado, aviso } from '../lib/saida.mjs';
import { abrir as abrirNoSistema } from '../lib/abrir.mjs';
import { servidorDaPasta } from '../lib/servidor-local.mjs';
import { paginaDeComparacao } from '../lib/comparacao.mjs';
import { caminhosDoAntesDepois, lerMudancas, pastasIguais, MINIMO_DE_MUDANCAS, MAXIMO_DE_MUDANCAS } from '../lib/antes-depois.mjs';

export default async function comparar(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  if (!ehPasta(ad.antes)) falha('ANTES_NAO_GUARDADO', { nome });
  const { pedido, mudancas, ignoradas } = lerMudancas(lerJson(ad.mudancas));
  if (mudancas.length < MINIMO_DE_MUDANCAS) {
    reprovado('POUCAS_MUDANCAS', { tem: mudancas.length, precisa: MINIMO_DE_MUDANCAS, arquivo: c.rel('revisao', 'antes-depois', 'mudancas.json') });
  }
  if (pastasIguais(ad.antes, c.site)) reprovado('NADA_MUDOU', { nome });
  const avisos = [];
  if (mudancas.length > MAXIMO_DE_MUDANCAS) avisos.push(aviso('MUDANCAS_DEMAIS', { tem: mudancas.length, maximo: MAXIMO_DE_MUDANCAS }));
  if (ignoradas) avisos.push(aviso('MUDANCA_SEM_TITULO', { ignoradas }));

  fs.rmSync(ad.depois, { recursive: true, force: true });
  copiarPasta(c.site, ad.depois);
  escreverTexto(ad.pagina, paginaDeComparacao({ pedido, mudancas }));
  const porta = await servidorDaPasta(ad.pasta, path.join(FERR, 'servidores', 'comparar', `${nome}.json`));
  const endereco = `http://127.0.0.1:${porta}/`;
  if (args.opcoes['sem-navegador'] !== true) abrirNoSistema(endereco);
  return {
    ok: true,
    codigo: 'COMPARACAO_PRONTA',
    avisos,
    arquivos: { pagina: c.rel('revisao', 'antes-depois', 'index.html') },
    dados: { endereco, porta, pedido, mudancas: mudancas.map((m) => m.titulo) },
  };
}
