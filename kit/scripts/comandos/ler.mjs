// ./estudio ler <nome> --instagram @perfil --negocio "Nome do negócio, cidade" [--google <endereço>]
//   [--site <endereço>] [--posts 24]
// Lê sozinho, sem login, as páginas públicas do negócio: o Instagram (legenda, data e foto de cada
// publicação), o perfil do Google (endereço, telefone, horário, nota e avaliações sem o nome de quem
// escreveu) e o site atual inteiro. Salva tudo em sites/<nome>/coleta/ e põe cada fato, com a fonte e
// a data, numa parte própria de fatos.md. Basta o @ e o nome: o site atual vem do Google ou da bio.
import path from 'node:path';
import { nomeDoSite, inteiro } from '../lib/args.mjs';
import { abrirPastaDoSite } from '../lib/site.mjs';
import { abrirLeitor } from '../lib/leitor.mjs';
import { lerFontes } from '../lib/ler.mjs';
import { falha } from '../lib/saida.mjs';
import { progresso } from '../lib/executar.mjs';

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

export default async function ler(args) {
  const nome = nomeDoSite(args);
  const c = abrirPastaDoSite(nome);
  const o = args.opcoes;
  const pedido = {
    instagram: texto(o.instagram),
    negocio: texto(o.negocio),
    google: texto(o.google),
    site: texto(o.site),
    posts: inteiro(o, 'posts', 24, 1, 60),
  };
  if (!pedido.instagram && !pedido.negocio && !pedido.google && !pedido.site) falha('LER_SEM_ENDERECO', { opcoes: ['--instagram', '--negocio', '--google', '--site'] });
  const pasta = path.join(c.pasta, 'coleta');
  progresso('Lendo as páginas públicas do negócio (sem entrar em conta nenhuma)...');
  const leitor = await abrirLeitor();
  let r;
  try {
    r = await lerFontes(pedido, { pasta, fatos: c.fatos, leitor, aoAvancar: progresso });
  } finally {
    leitor.fechar();
  }
  const leu = Boolean(r.dados.instagram || r.dados.google || r.dados.site);
  if (!leu) return { ok: false, codigo: 'LER_NADA', avisos: r.avisos, dados: r.dados, sair: 1 };
  return {
    ok: true,
    codigo: r.avisos.length ? 'LER_COM_AVISOS' : 'LER_OK',
    avisos: r.avisos,
    arquivos: { coleta: c.rel('coleta'), fatos: c.rel('fatos.md') },
    dados: r.dados,
  };
}
