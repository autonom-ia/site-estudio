// Empacota a pasta site/ num .zip pronto para hospedar (GitHub Pages, Netlify, Cloudflare Pages ou
// qualquer servidor de arquivos). A montagem (recusas, o que fica fora, arquivos não citados) mora
// em lib/pacote.mjs; aqui só se grava o zip e o SHA-256 e se descreve o resultado.
// O zip fica em sites/<nome>/<nome>-site.zip, com o SHA-256 ao lado.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { montarPacote } from '../lib/pacote.mjs';
import { escreverTexto } from '../lib/json.mjs';
import { aviso } from '../lib/saida.mjs';

export { FORA_DO_PACOTE, foraDoPacote, nomePrivado, arquivosPrivados, arquivosNaoCitados } from '../lib/pacote.mjs';

export default async function pacote(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const p = montarPacote(c.site);
  const tmp = `${c.pacote}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, p.zip);
  fs.renameSync(tmp, c.pacote);
  escreverTexto(`${c.pacote}.sha256`, `${p.sha256}  ${path.basename(c.pacote)}\n`);
  const avisos = p.naoCitados.length ? [aviso('ARQUIVO_NAO_USADO', { arquivos: p.naoCitados.map((r) => `site/${r}`) })] : [];
  return {
    ok: true,
    codigo: 'PACOTE_PRONTO',
    avisos,
    arquivos: { zip: c.rel(path.basename(c.pacote)), sha256: c.rel(`${path.basename(c.pacote)}.sha256`) },
    dados: {
      arquivos: p.arquivos,
      paginas: p.paginas,
      fora_do_pacote: p.foraDoPacote.map((r) => `site/${r}`),
      tamanho_kb: Math.round(p.zip.length / 102.4) / 10,
      conteudo_kb: Math.round(p.conteudoBytes / 102.4) / 10,
    },
  };
}
