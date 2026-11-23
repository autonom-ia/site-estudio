// A marca que vai para dentro de um site: só o que a página usa. tokens.css, as fontes (com a
// licença de cada uma) e o logo. O resto de minha-marca/ (marca.md com tom e notas internas,
// arquivos-fonte do logo, rascunhos) fica fora de site/, porque tudo em site/ vai para o ar.
import fs from 'node:fs';
import path from 'node:path';

export const ARQUIVOS_DA_MARCA = Object.freeze(['tokens.css', 'logo.svg', 'logo.png', 'logo.webp']);
export const EXTENSOES_DE_FONTE = Object.freeze(['.woff2', '.woff', '.ttf']);

// Licença de fonte: OFL-Fraunces.txt, OFL.txt, LICENSE.txt, LICENCA.txt.
export function ehLicencaDeFonte(nome) {
  const baixo = nome.toLowerCase();
  if (!baixo.endsWith('.txt')) return false;
  return baixo.startsWith('ofl') || baixo.startsWith('licen');
}

export function ehArquivoDeFonte(nome) {
  const baixo = nome.toLowerCase();
  return EXTENSOES_DE_FONTE.some((ext) => baixo.endsWith(ext)) || ehLicencaDeFonte(nome);
}

// Copia a marca de origem para destino (site/assets/marca/). Devolve o que copiou e o que deixou fora.
export function copiarMarca(origem, destino) {
  const copiados = [];
  const deixados = [];
  fs.mkdirSync(destino, { recursive: true });
  for (const nome of fs.readdirSync(origem).sort()) {
    const de = path.join(origem, nome);
    const info = fs.statSync(de);
    if (info.isDirectory()) {
      if (nome !== 'fontes') {
        deixados.push(`${nome}/`);
        continue;
      }
      for (const fonte of fs.readdirSync(de).sort()) {
        const arq = path.join(de, fonte);
        if (fs.statSync(arq).isFile() && ehArquivoDeFonte(fonte)) {
          fs.mkdirSync(path.join(destino, 'fontes'), { recursive: true });
          fs.copyFileSync(arq, path.join(destino, 'fontes', fonte));
          copiados.push(`fontes/${fonte}`);
        } else deixados.push(`fontes/${fonte}`);
      }
      continue;
    }
    if (ARQUIVOS_DA_MARCA.includes(nome)) {
      fs.copyFileSync(de, path.join(destino, nome));
      copiados.push(nome);
    } else deixados.push(nome);
  }
  return { copiados, deixados };
}
