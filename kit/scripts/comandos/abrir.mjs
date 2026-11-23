// Sobe um servidor local na pasta site/ e abre no navegador a prévia lado a lado: o site no
// tamanho de celular e no de computador, na mesma tela, sem a pessoa mexer na janela.
// O servidor fica de pé em segundo plano e desliga sozinho depois de 3 horas parado
// (lib/servidor-local.mjs). dados.endereco é o site sozinho; dados.previa, a prévia.
// --sem-navegador: só sobe o servidor e devolve os endereços.
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { abrir as abrirNoSistema } from '../lib/abrir.mjs';
import { FERR } from '../lib/caminhos.mjs';
import { servidorDaPasta, ROTA_DA_PREVIA } from '../lib/servidor-local.mjs';

export default async function abrir(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const porta = await servidorDaPasta(c.site, path.join(FERR, 'servidores', `${nome}.json`));
  const endereco = `http://127.0.0.1:${porta}/`;
  const previa = `http://127.0.0.1:${porta}${ROTA_DA_PREVIA}`;
  const semNavegador = args.opcoes['sem-navegador'] === true;
  if (!semNavegador) abrirNoSistema(previa);
  return {
    ok: true,
    codigo: semNavegador ? 'SERVIDOR_NO_AR' : 'SITE_ABERTO',
    arquivos: { site: c.rel('site') },
    dados: { endereco, previa, porta },
  };
}
