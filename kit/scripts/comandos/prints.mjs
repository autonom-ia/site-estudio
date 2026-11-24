// Fotografa cada página em 390, 768, 1440 e 1920 px: a página inteira (captureBeyondViewport, não
// só o topo) e cada seção separada, sempre com o movimento assentado (nada no meio de um fade).
// Vai para revisao/prints-rN/ (N = rodada). Avisa quando uma foto sai quase toda de uma cor só.
// Parte presa (cabeçalho, barra, coluna "sticky") fica onde a pessoa a vê ao abrir a página, e não
// no meio das outras partes (pagina-fotos.mjs).
// Uma pasta de fotos, um "prints" por vez. Causa do DESCONHECIDO do piloto (falhava uma vez e
// passava ao repetir): dois "prints" na mesma pasta ao mesmo tempo; um apagava as fotos que o outro
// estava gravando (ENOENT no rmSync) e as fotos se misturavam. Agora o segundo recebe
// PRINTS_EM_ANDAMENTO e a limpeza não quebra com foto que já sumiu.
// Partes em 3D (palco com data-3d): a foto espera a cena abrir e confere o palco. Cena que não
// abriu (sem "reduzir movimento") dá CENA_3D_NAO_ABRIU; cena aberta mas lisa dá CENA_3D_VAZIA.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite, inteiro } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, escolherTamanhos, rodadaAtual } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { secoes } from '../lib/pagina.mjs';
import { prenderParaFoto, esperarCenas3d, cenas3d } from '../lib/pagina-fotos.mjs';
import { pegarTrava, soltarTrava } from '../lib/trava.mjs';
import { decodePng, frameStats } from '../lib/png.mjs';
import { progresso } from '../lib/executar.mjs';
import { aviso, falha } from '../lib/saida.mjs';
import { relativoARaiz } from '../lib/caminhos.mjs';

const ALTURA_MAXIMA = 16000; // px: acima disso o navegador não fotografa de uma vez
const LIMITE_LISA = 0.985;
const AMOSTRA = 0.1;
const AMOSTRA_3D = 0.25; // o palco 3D é menor que a página: amostra mais fina, para não perder raio fino
const TETO_3D_MS = 15000; // tempo máximo para as cenas 3D abrirem (o desenhista por software é lento)

async function fotografar(tab, recorte, qualidade) {
  const r = await tab.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: qualidade,
    captureBeyondViewport: true,
    fromSurface: true,
    clip: { ...recorte, scale: 1 },
  });
  return Buffer.from(r.data, 'base64');
}

// A mesma foto das conferências, em PNG (para ler os pixels) e numa escala menor.
export async function fotografarPng(tab, recorte, escala = AMOSTRA) {
  const r = await tab.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
    clip: { ...recorte, scale: escala },
  });
  return decodePng(Buffer.from(r.data, 'base64'));
}

async function lisa(tab, recorte, escala = AMOSTRA) {
  return frameStats(await fotografarPng(tab, recorte, escala));
}

const doisDigitos = (n) => String(n).padStart(2, '0');

function limparNome(texto) {
  let s = '';
  for (const ch of String(texto).toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) s += ch;
    else if (!s.endsWith('-')) s += '-';
  }
  while (s.endsWith('-')) s = s.slice(0, -1);
  while (s.startsWith('-')) s = s.slice(1);
  return s.slice(0, 40) || 'secao';
}

// Confere cada palco 3D da página já pronta para a foto. Sem "reduzir movimento", a cena precisa
// ter aberto (pronta) e o palco não pode sair liso. Com ele, a imagem de reserva é o certo.
async function conferirCenas3d(sessao, alturaFoto, reduzido) {
  const saida = [];
  for (const p of await sessao.avaliar(cenas3d)) {
    const dados = { cena: p.cena, estado: p.estado };
    if (p.estado !== 'pronta') {
      saida.push({ dados, aviso: reduzido ? null : 'CENA_3D_NAO_ABRIU' });
      continue;
    }
    const altura = Math.min(p.altura, alturaFoto - p.y);
    if (p.largura < 8 || altura < 8) {
      saida.push({ dados, aviso: null });
      continue;
    }
    const est = await lisa(sessao.tab, { x: p.x, y: p.y, width: p.largura, height: altura }, AMOSTRA_3D);
    dados.uniforme = Math.round(est.uniforme * 1000) / 1000;
    saida.push({ dados, aviso: est.uniforme >= LIMITE_LISA ? 'CENA_3D_VAZIA' : null });
  }
  return saida;
}

export default async function prints(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const tamanhos = escolherTamanhos(args.opcoes);
  const qualidade = inteiro(args.opcoes, 'qualidade', 82, 40, 100);
  const comSecoes = args.opcoes['sem-secoes'] !== true;
  const reduzido = args.opcoes.reduzido === true;
  const rodada = rodadaAtual(c, args.opcoes);
  const pasta = path.join(c.revisao, `prints-r${rodada}`);
  fs.mkdirSync(pasta, { recursive: true });
  const trava = `${pasta}.trava`;
  if (!pegarTrava(trava)) falha('PRINTS_EM_ANDAMENTO', { pasta: relativoARaiz(pasta), rodada });
  try {
    return await fotografarTudo(c, pasta, { tamanhos, qualidade, comSecoes, reduzido, rodada });
  } finally {
    soltarTrava(trava);
  }
}

async function fotografarTudo(c, pasta, { tamanhos, qualidade, comSecoes, reduzido, rodada }) {
  for (const n of fs.readdirSync(pasta)) if (n.toLowerCase().endsWith('.jpg')) fs.rmSync(path.join(pasta, n), { force: true });

  const paginas = paginasDoSite(c);
  const fotos = [];
  const avisos = [];
  const cenas = [];
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      for (const t of tamanhos) {
        progresso(`Fotografando ${pagina.rel} em ${t.largura} px...`);
        const doc = await visitar(sessao, pagina, t, { reduzido });
        if (doc.topo === false) avisos.push(aviso('PAGINA_FORA_DO_TOPO', { pagina: pagina.rel, largura: t.largura }));
        await sessao.avaliar(esperarCenas3d, TETO_3D_MS);
        await sessao.avaliar(prenderParaFoto);
        const altura = Math.min(doc.altura, ALTURA_MAXIMA);
        if (doc.altura > ALTURA_MAXIMA) avisos.push(aviso('PAGINA_MUITO_ALTA', { pagina: pagina.rel, largura: t.largura, altura: doc.altura }));
        const inteira = { x: 0, y: 0, width: t.largura, height: altura };
        const arquivo = path.join(pasta, `${pagina.nome}-${t.largura}-inteira.jpg`);
        fs.writeFileSync(arquivo, await fotografar(sessao.tab, inteira, qualidade));
        const est = await lisa(sessao.tab, inteira);
        if (est.uniforme >= LIMITE_LISA) avisos.push(aviso('FOTO_LISA', { arquivo: relativoARaiz(arquivo), cor: est.dom }));
        fotos.push({ pagina: pagina.rel, largura: t.largura, parte: 'inteira', arquivo: relativoARaiz(arquivo) });
        for (const cena of await conferirCenas3d(sessao, altura, reduzido)) {
          cenas.push({ pagina: pagina.rel, largura: t.largura, ...cena.dados });
          if (cena.aviso) avisos.push(aviso(cena.aviso, { pagina: pagina.rel, largura: t.largura, arquivo: relativoARaiz(arquivo), ...cena.dados }));
        }
        if (!comSecoes) continue;
        for (const s of await sessao.avaliar(secoes)) {
          const alturaSecao = Math.min(s.altura, ALTURA_MAXIMA);
          if (s.y >= ALTURA_MAXIMA || alturaSecao < 2) continue;
          const recorte = { x: 0, y: s.y, width: t.largura, height: alturaSecao };
          const nomeArq = `${pagina.nome}-${t.largura}-s${doisDigitos(s.ordem)}-${limparNome(s.nome)}.jpg`;
          const arqSecao = path.join(pasta, nomeArq);
          fs.writeFileSync(arqSecao, await fotografar(sessao.tab, recorte, qualidade));
          fotos.push({ pagina: pagina.rel, largura: t.largura, parte: s.nome, arquivo: relativoARaiz(arqSecao) });
        }
      }
    }
  } finally {
    await sessao.fechar();
  }
  return {
    ok: true,
    codigo: 'PRINTS_PRONTOS',
    avisos,
    arquivos: { pasta: relativoARaiz(pasta) },
    dados: {
      rodada,
      total: fotos.length,
      tamanhos: tamanhos.map((t) => t.largura),
      movimento: reduzido ? 'reduzido' : 'assentado',
      cenas3d: cenas,
      fotos,
    },
  };
}
