// Fotografa cada página em 390, 768, 1440 e 1920 px: a página inteira (captureBeyondViewport, não
// só o topo) e cada seção separada, sempre com o movimento assentado (nada no meio de um fade).
// Vai para revisao/prints-rN/ (N = rodada). Avisa quando uma foto sai quase toda de uma cor só.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite, inteiro } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, escolherTamanhos, rodadaAtual } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { secoes } from '../lib/pagina.mjs';
import { decodePng, frameStats } from '../lib/png.mjs';
import { progresso } from '../lib/executar.mjs';
import { aviso } from '../lib/saida.mjs';
import { relativoARaiz } from '../lib/caminhos.mjs';

const ALTURA_MAXIMA = 16000; // px: acima disso o navegador não fotografa de uma vez
const LIMITE_LISA = 0.985;
const AMOSTRA = 0.1;

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

async function lisa(tab, recorte) {
  const r = await tab.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
    clip: { ...recorte, scale: AMOSTRA },
  });
  return frameStats(decodePng(Buffer.from(r.data, 'base64')));
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
  for (const n of fs.readdirSync(pasta)) if (n.toLowerCase().endsWith('.jpg')) fs.rmSync(path.join(pasta, n));

  const paginas = paginasDoSite(c);
  const fotos = [];
  const avisos = [];
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      for (const t of tamanhos) {
        progresso(`Fotografando ${pagina.rel} em ${t.largura} px...`);
        const doc = await visitar(sessao, pagina, t, { reduzido });
        const altura = Math.min(doc.altura, ALTURA_MAXIMA);
        if (doc.altura > ALTURA_MAXIMA) avisos.push(aviso('PAGINA_MUITO_ALTA', { pagina: pagina.rel, largura: t.largura, altura: doc.altura }));
        const inteira = { x: 0, y: 0, width: t.largura, height: altura };
        const arquivo = path.join(pasta, `${pagina.nome}-${t.largura}-inteira.jpg`);
        fs.writeFileSync(arquivo, await fotografar(sessao.tab, inteira, qualidade));
        const est = await lisa(sessao.tab, inteira);
        if (est.uniforme >= LIMITE_LISA) avisos.push(aviso('FOTO_LISA', { arquivo: relativoARaiz(arquivo), cor: est.dom }));
        fotos.push({ pagina: pagina.rel, largura: t.largura, parte: 'inteira', arquivo: relativoARaiz(arquivo) });
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
      fotos,
    },
  };
}
