// Mostra a versão do estúdio e das peças fixas.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../lib/caminhos.mjs';
import { lerVersao } from '../lib/atualizacao.mjs';
import { versaoDoAxe } from './acessibilidade.mjs';

export const VERSAO_GSAP = '3.13.0';
export const VERSAO_LENIS = '1.3.11';

export default async function versao() {
  let pacote = {};
  try {
    pacote = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  } catch {}
  const v = lerVersao(RAIZ);
  return {
    ok: true,
    codigo: 'VERSAO',
    resumo: `Site Estúdio ${v || '(sem VERSAO)'}`,
    dados: {
      versao: v,
      pacote: pacote.version || null,
      axe: versaoDoAxe(),
      gsap: VERSAO_GSAP,
      lenis: VERSAO_LENIS,
      node: process.versions.node,
      plataforma: `${process.platform}-${process.arch}`,
    },
  };
}
