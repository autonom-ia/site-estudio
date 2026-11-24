// Cada fato lido vira um registro { fato, fonte, data }: o que é, de onde veio (com o endereço) e
// quando foi lido. Os registros entram em fatos.md numa parte própria, marcada, que a próxima
// leitura troca inteira (o resto de fatos.md, escrito pela pessoa e pelo assistente, fica como está).

export const MARCA_INICIO = '<!-- estudio:lido:inicio -->';
export const MARCA_FIM = '<!-- estudio:lido:fim -->';
const TETO_DA_CELULA = 400;

// Texto que cabe numa célula de tabela: sem barra vertical (ela separa as colunas) e sem quebra.
export function celula(texto, teto = TETO_DA_CELULA) {
  let t = '';
  for (const ch of String(texto || '')) {
    if (ch === '|') t += '/';
    else if (ch === '\n' || ch === '\r' || ch === '\t') t += ' ';
    else t += ch;
  }
  t = t.split(' ').filter(Boolean).join(' ');
  return t.length > teto ? `${t.slice(0, teto - 1)}…` : t;
}

const registro = (fato, fonte, data) => ({ fato: celula(fato), fonte: celula(fonte), data });

export function registrosDoInstagram({ perfil }, data) {
  const fonte = `Perfil público do Instagram, ${perfil.endereco}`;
  const lista = [registro(`Instagram: @${perfil.usuario}`, fonte, data)];
  if (perfil.nome) lista.push(registro(`Nome no Instagram: ${perfil.nome}`, fonte, data));
  if (perfil.bio) lista.push(registro(`Bio do Instagram: ${perfil.bio}`, fonte, data));
  for (const l of perfil.links) lista.push(registro(`Link na bio do Instagram: ${l}`, fonte, data));
  return lista;
}

export function registrosDoGoogle({ lugar, avaliacoes }, data) {
  const fonte = `Perfil do Google, ${lugar.fonte}`;
  const lista = [];
  if (lugar.nome) lista.push(registro(`Nome no Google: ${lugar.nome}`, fonte, data));
  if (lugar.endereco) lista.push(registro(`Endereço: ${lugar.endereco}`, fonte, data));
  if (lugar.telefone) lista.push(registro(`Telefone: ${lugar.telefone}`, fonte, data));
  if (lugar.site) lista.push(registro(`Site: ${lugar.site}`, fonte, data));
  for (const h of lugar.horario) lista.push(registro(`Horário de ${h.dia}: ${h.horas}`, fonte, data));
  if (lugar.nota) lista.push(registro(`Nota no Google: ${lugar.nota}${lugar.total ? ` (${lugar.total} avaliações)` : ''}`, fonte, data));
  for (const a of avaliacoes) {
    if (!a.texto) continue;
    const quando = a.quando ? `, ${a.quando}` : '';
    lista.push(registro(`Avaliação no Google (${a.estrelas} estrelas${quando}): "${a.texto}"`, `${fonte} (sem o nome de quem escreveu)`, data));
  }
  return lista;
}

export function registrosDoSite({ contatos, declarados }, data) {
  return [
    ...contatos.map((c) => registro(`${c.tipo} no site atual: ${c.valor}`, `Site atual, ${c.fonte}`, data)),
    ...declarados.map((f) => registro(`${f.tipo} declarado pelo site atual: ${f.valor}`, `Site atual (dados da página), ${f.fonte}`, data)),
  ];
}

// Sem repetição: o mesmo fato da mesma fonte entra uma vez.
export function semRepetir(registros) {
  const vistos = new Set();
  return registros.filter((r) => {
    const chave = `${r.fato}|${r.fonte}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function secaoLida(registros, data) {
  const linhas = [
    MARCA_INICIO,
    `## Lido pelo estúdio em ${data}`,
    '',
    '> O estúdio leu estas linhas nas páginas públicas abaixo. Confira com a pessoa antes de pôr no site.',
    '> A próxima leitura troca esta parte inteira; fato que você corrigir, copie para a tabela de cima.',
    '',
    '| Fato | Fonte | Data |',
    '|---|---|---|',
    ...registros.map((r) => `| ${r.fato} | ${r.fonte} | ${r.data} |`),
    MARCA_FIM,
  ];
  return linhas.join('\n');
}

// Põe a parte lida no fim de fatos.md, ou troca a que já existe no lugar dela.
export function juntarNoFatos(markdown, secao) {
  const texto = String(markdown || '');
  const ini = texto.indexOf(MARCA_INICIO);
  const fim = texto.indexOf(MARCA_FIM);
  if (ini !== -1 && fim > ini) return `${texto.slice(0, ini)}${secao}${texto.slice(fim + MARCA_FIM.length)}`;
  const base = texto.trimEnd();
  return `${base ? `${base}\n\n` : ''}${secao}\n`;
}

// As publicações do Instagram numa tabela: data, legenda, fotos baixadas e o endereço (a fonte).
export function tabelaDePosts(posts, data) {
  const linhas = [
    '# Publicações do Instagram',
    '',
    `> Lidas em ${data}, sem entrar na conta. A fonte de cada uma é o endereço da última coluna.`,
    '> As fotos estão na pasta fotos/. Só vão para o site com a autorização da pessoa.',
    '',
    '| Data | Legenda | Fotos | Endereço |',
    '|---|---|---|---|',
  ];
  for (const p of posts) {
    const fotos = p.fotos.map((f) => (f.arquivo ? `${f.arquivo} (${f.largura}x${f.altura})` : 'não baixou')).join(', ');
    linhas.push(`| ${p.data} | ${celula(p.legenda, 2000)}${p.video ? ' (vídeo)' : ''} | ${celula(fotos)} | ${p.url} |`);
  }
  return `${linhas.join('\n')}\n`;
}

// O texto de cada página do site atual, com o endereço e a data, para o assistente ler.
export function textoDoSite(paginas, data) {
  const partes = [`# Site atual, lido em ${data}`, ''];
  for (const p of paginas) partes.push(`## ${p.titulo || p.url}`, '', `Fonte: ${p.url}`, '', p.texto.trim(), '');
  return `${partes.join('\n')}\n`;
}
