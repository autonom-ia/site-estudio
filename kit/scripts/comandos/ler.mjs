// ./estudio ler <nome> --instagram perfil --negocio "Nome do negócio, cidade" [--google <endereço>]
//   [--site <endereço>] [--posts 24] [--sem-login]
// Lê sozinho as páginas públicas do negócio: o Instagram (legenda, data e foto de cada
// publicação), o perfil do Google (endereço, telefone, horário, nota e avaliações sem o nome de quem
// escreveu) e o site atual inteiro. Salva tudo em sites/<nome>/coleta/ e põe cada fato, com a fonte e
// a data, numa parte própria de fatos.md. Basta o @ e o nome: o site atual vem do Google ou da bio.
// Se a pessoa entrou no Instagram pela janela do estúdio (./estudio instagram entrar), o Instagram é
// lido com esse login (padrão: 40 publicações); o Google e o site, sempre sem login. --sem-login
// ignora o login guardado (depois de o Instagram pedir verificação, para não insistir).
import path from 'node:path';
import { nomeDoSite, inteiro } from '../lib/args.mjs';
import { abrirPastaDoSite } from '../lib/site.mjs';
import { abrirLeitor } from '../lib/leitor.mjs';
import { abrirLeitorComLogin } from '../lib/instagram-conta.mjs';
import { MAXIMO_COM_LOGIN } from '../lib/ler-instagram-login.mjs';
import { lerFontes } from '../lib/ler.mjs';
import { falha, aviso } from '../lib/saida.mjs';
import { progresso } from '../lib/executar.mjs';

// Opção dada sem valor (ou só com espaço) é erro, nunca fonte pulada em silêncio. No PowerShell,
// "@perfil" sem aspas some antes de chegar aqui; por isso a skill escreve o @ sem a arroba.
function texto(opcoes, nome) {
  const v = opcoes[nome];
  if (v === undefined) return '';
  const limpo = typeof v === 'string' ? v.trim() : '';
  if (!limpo) falha('ARGUMENTO_INVALIDO', { argumento: `--${nome}`, valor: String(v) });
  return limpo;
}

const POSTS_SEM_LOGIN = 24;
// Motivos que viram aviso: quem nunca entrou não precisa saber de login.
const MOTIVOS_DE_AVISO = Object.freeze(['vencido', 'nao-abriu', 'janela-aberta']);

// O leitor com login, se a pessoa entrou pela janela do estúdio. Devolve { leitor } ou { avisos }.
async function loginGuardado(pedido, opcoes) {
  if (!pedido.instagram || opcoes['sem-login'] === true) return { avisos: [] };
  const r = await abrirLeitorComLogin();
  if (r.leitor) return { leitor: r.leitor, avisos: [] };
  return { avisos: MOTIVOS_DE_AVISO.includes(r.motivo) ? [aviso('LER_INSTAGRAM_LOGIN_INDISPONIVEL', { motivo: r.motivo })] : [] };
}

export default async function ler(args) {
  const nome = nomeDoSite(args);
  const c = abrirPastaDoSite(nome);
  const o = args.opcoes;
  const fontes = {
    instagram: texto(o, 'instagram'),
    negocio: texto(o, 'negocio'),
    google: texto(o, 'google'),
    site: texto(o, 'site'),
  };
  if (!fontes.instagram && !fontes.negocio && !fontes.google && !fontes.site) falha('LER_SEM_ENDERECO', { opcoes: ['--instagram', '--negocio', '--google', '--site'] });
  // Conferido antes de abrir o navegador do login, para um número errado não deixar nada aberto.
  const postsPedidos = o.posts === undefined ? 0 : inteiro(o, 'posts', 0, 1, 60);
  const pasta = path.join(c.pasta, 'coleta');
  const login = await loginGuardado(fontes, o);
  const pedido = { ...fontes, posts: postsPedidos || (login.leitor ? MAXIMO_COM_LOGIN : POSTS_SEM_LOGIN) };
  progresso(login.leitor ? 'Lendo o Instagram com o seu login, e o resto sem entrar em conta nenhuma...' : 'Lendo as páginas públicas do negócio (sem entrar em conta nenhuma)...');
  let leitor = null;
  let r;
  try {
    leitor = await abrirLeitor();
    r = await lerFontes(pedido, { pasta, fatos: c.fatos, leitor, leitorInstagram: login.leitor, aoAvancar: progresso });
  } finally {
    leitor?.fechar();
    await login.leitor?.fecharComCalma();
  }
  r.avisos.unshift(...login.avisos);
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
