// Prepara a rodada N de revisão: escreve revisao/contexto-rN.md com a régua das notas
// (kit/regua-revisao.md) e o que as rodadas anteriores aceitaram e recusaram (rodada-K.json).
// Cada revisor lê esse arquivo antes de avaliar: o que já foi decidido não volta a cada rodada.
// Devolve também a trajetória das notas (média, se passou, oscilação de cada lente), que é como
// se mede a meta "8,5 em até 2 rodadas, com cada lente variando no máximo 0,3".
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirPastaDoSite, rodadaAtual } from '../lib/site.mjs';
import { KIT, relativoARaiz } from '../lib/caminhos.mjs';
import { lerTexto, escreverTexto } from '../lib/json.mjs';
import { aviso, falha } from '../lib/saida.mjs';
import { lerRodadas, trajetoria, montarContexto, META } from '../lib/rodadas.mjs';

export const ARQUIVO_REGUA = path.join(KIT, 'regua-revisao.md');

export default async function revisao(args) {
  const nome = nomeDoSite(args);
  const c = abrirPastaDoSite(nome);
  const rodada = rodadaAtual(c, args.opcoes);
  if (!fs.existsSync(ARQUIVO_REGUA)) falha('ARQUIVO_NAO_ACHADO', { arquivo: relativoARaiz(ARQUIVO_REGUA) });
  const { rodadas, ilegiveis } = lerRodadas(c.revisao, rodada);
  const contexto = path.join(c.revisao, `contexto-r${rodada}.md`);
  escreverTexto(contexto, montarContexto(rodada, lerTexto(ARQUIVO_REGUA), rodadas));
  const avisos = ilegiveis.map((i) => aviso('RODADA_ILEGIVEL', { arquivo: relativoARaiz(i.arquivo), erro: i.erro }));
  return {
    ok: true,
    codigo: 'REVISAO_PRONTA',
    avisos,
    arquivos: { contexto: relativoARaiz(contexto), regua: relativoARaiz(ARQUIVO_REGUA) },
    dados: { rodada, rodadas_anteriores: rodadas.map((r) => r.rodada), meta: META, ...trajetoria(rodadas) },
  };
}
