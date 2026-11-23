// Confere se o estúdio está pronto: Node, navegador (Chrome, Edge, Chromium ou o do instalador)
// e o axe-core da conferência de acessibilidade. Os três são obrigatórios.
// Falta de peça é erro de instalação (saída 1), não reprovação do site (saída 2).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, KIT } from '../lib/caminhos.mjs';
import { acharNavegador } from '../lib/chrome.mjs';
import { lerVersao } from '../lib/atualizacao.mjs';
import { launch } from '../lib/cdp.mjs';
import { falha, aviso } from '../lib/saida.mjs';
import { versaoDoAxe } from './acessibilidade.mjs';

const NODE_MINIMO = 22;

export default async function verificar({ opcoes }) {
  const itens = {};
  const faltando = [];

  const maior = Number(process.versions.node.split('.')[0]);
  itens.node = { ok: maior >= NODE_MINIMO, versao: process.versions.node };
  if (!itens.node.ok) faltando.push('node');

  const nav = acharNavegador();
  itens.navegador = { ok: !!nav, caminho: nav ? nav.caminho : null, tipo: nav ? nav.tipo : null };
  if (!nav) faltando.push('navegador');
  else if (opcoes.rapido !== true) {
    try {
      const n = await launch({ largura: 800, altura: 600 });
      n.close();
      itens.navegador.abriu = true;
    } catch {
      itens.navegador.ok = false;
      itens.navegador.abriu = false;
      faltando.push('navegador');
    }
  }

  const axe = path.join(KIT, 'vendor', 'axe', 'axe.min.js');
  itens.axe = { ok: fs.existsSync(axe), versao: versaoDoAxe() };
  if (!itens.axe.ok) faltando.push('axe');

  itens.versao = lerVersao(RAIZ);
  if (faltando.length) falha('VERIFICACAO_FALHOU', { faltando, itens });
  // sem o navegador de versão fixa, medidas e prints dependem da versão do Chrome desta máquina
  const avisos = nav && nav.tipo === 'sistema' ? [aviso('NAVEGADOR_DO_SISTEMA', { caminho: nav.caminho })] : [];
  return { ok: true, codigo: 'ESTUDIO_PRONTO', avisos, dados: itens };
}
