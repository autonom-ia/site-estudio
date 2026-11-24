// Consertos da leitura trazidos do View Estúdio 1.2 (autonom-ia/view-estudio#5), com leitor falso
// (sem navegador): contato e JSON-LD de terceiro (rodapé "site feito por") viram aviso, nunca fato;
// JSON-LD só vale se for do próprio negócio; página que sai do site fica de fora; --site de rede
// social não é lido e endereço sem "https://" é completado; marca quebrada não estraga fatos.md, que é
// guardado em coleta/ antes; BOM e fim de linha (CRLF, LF, misturado) ficam como estavam; a leitura
// inteira tem teto de tempo, contado do início do comando, que cobre fotos e DNS; foto só de endereço
// público e com teto de tamanho; e a regra única de pular teste de navegador (no CI, falha).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { opcoesDoNavegador, exigirNavegador } from './fixtures/navegador.mjs';
import { fatosDoJsonLd, lerSite } from '../scripts/lib/ler-site.mjs';
import { celula, secaoLida, juntarNoFatos, MARCA_INICIO, MARCA_FIM } from '../scripts/lib/registros.mjs';
import { lerFontes, semEnderecosLocais, TETO_DA_LEITURA_MS } from '../scripts/lib/ler.mjs';
import { dimensoes, baixar, ehEnderecoInterno } from '../scripts/lib/baixar.mjs';
import { acharObjetos, hoje, TempoEsgotado } from '../scripts/lib/leitor.mjs';
import { baixarFotos, lerInstagram } from '../scripts/lib/ler-instagram.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = '2026-11-24';

test('célula de tabela, tamanho da foto pelo cabeçalho, endereço local escondido, acharObjetos e hoje', () => {
  assert.equal(celula('a | b\n\nc\t d'), 'a / b c d');
  assert.equal(celula('x'.repeat(10), 5), 'xxxx…');
  assert.equal(celula('abc😀😀😀', 5), 'abc😀…', 'corta por caractere inteiro, nunca no meio do emoji');
  assert.ok(!celula('😀'.repeat(500)).includes('\uFFFD'));
  for (const ch of Array.from(celula('😀'.repeat(500)))) assert.ok(ch === '😀' || ch === '…');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x05, 0x46, 0x04, 0x38, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(dimensoes(jpeg), { largura: 1080, altura: 1350 });
  assert.deepEqual(dimensoes(Buffer.from('texto qualquer')), { largura: 0, altura: 0 });
  assert.equal(semEnderecosLocais('falhou ws://127.0.0.1:9222/devtools/x aqui'), 'falhou <endereço local> aqui');
  const compartilhado = { alvo: 1 };
  assert.equal(acharObjetos({ a: [compartilhado, { b: compartilhado }] }, (o) => 'alvo' in o).length, 1);
  assert.equal(hoje(new Date(2026, 0, 5)), '2026-01-05');
});

// --- proteções da leitura, com leitor falso (sem navegador) ---

// Leitor falso de um site: cada endereço pedido abre a página do mapa (com o endereço final dela).
// esperaMs: quanto cada página demora para abrir.
function leitorDeSite(mapa, { esperaMs = 0 } = {}) {
  const visitas = [];
  let atual = null;
  return {
    visitas,
    ir: async (url) => {
      visitas.push(url);
      if (esperaMs) await new Promise((r) => setTimeout(r, esperaMs));
      atual = typeof mapa === 'function' ? mapa(url) : mapa[url];
      if (!atual) throw new Error('não abriu');
    },
    avaliar: async (fn) => (fn.name === 'lerPaginaDoSite' ? { titulo: '', descricao: '', titulos: [], texto: 'texto', links: [], imagens: [], jsonld: [], ...atual } : true),
  };
}

function comPasta(fn) {
  return async () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ler-prot-'));
    try {
      await fn(pasta);
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  };
}

const rodapeDeAgencia = 'https://wa.me/5599999990000';
const ldDoNegocio = JSON.stringify({ '@type': 'BicycleStore', name: 'Casa Exemplo', telephone: '(00) 0000-1234' });
const ldDaAgencia = JSON.stringify({ '@type': 'Organization', name: 'Agência Inventada', url: 'https://agencia.example/', telephone: '(99) 9999-0000', email: 'oi@agencia.example' });
const SITE_COM_AGENCIA = {
  'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa Exemplo', links: ['https://casa.example/contato', 'tel:+5500000001234', rodapeDeAgencia], jsonld: [ldDoNegocio, ldDaAgencia] },
  'https://casa.example/contato': { url: 'https://casa.example/contato', titulo: 'Contato', links: ['mailto:ola@casa.example', rodapeDeAgencia, 'https://wa.me/5500000001234'] },
};

test('site com rodapé de agência: contato e JSON-LD de terceiro viram aviso, nunca fato do negócio', comPasta(async (pasta) => {
  const fatos = path.join(pasta, 'fatos.md');
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos, leitor: leitorDeSite(SITE_COM_AGENCIA), data: DATA });
  const lidos = r.registros.map((x) => x.fato);
  assert.ok(lidos.includes('Telefone declarado pelo site atual: (00) 0000-1234'), lidos.join('\n'));
  assert.ok(lidos.includes('E-mail no site atual: ola@casa.example'));
  assert.ok(lidos.includes('WhatsApp no site atual: 5500000001234'), 'repetido em toda página, mas é o telefone do próprio negócio');
  const md = fs.readFileSync(fatos, 'utf8');
  for (const deOutro of ['5599999990000', '9999-0000', 'agencia.example']) assert.ok(!md.includes(deOutro) && !lidos.join(' ').includes(deOutro), deOutro);
  const a = r.avisos.find((x) => x.codigo === 'LER_SITE_CONTATO_DE_TERCEIRO');
  assert.ok(a, r.avisos.map((x) => x.codigo).join(', '));
  const duvidosos = a.dados.contatos.map((c) => `${c.motivo}|${c.valor}`);
  assert.ok(duvidosos.includes('em-todas-as-paginas|5599999990000'), duvidosos.join(', '));
  assert.ok(duvidosos.includes('dados-de-outro|(99) 9999-0000') && duvidosos.includes('dados-de-outro|oi@agencia.example'), duvidosos.join(', '));
}));

test('JSON-LD só vale como fato se for de negócio (Organization, LocalBusiness ou subtipo) e do próprio site', () => {
  const ref = { host: 'casa.example', nomes: ['Casa Exemplo'] };
  const caso = (o) => fatosDoJsonLd([JSON.stringify(o)], ref);
  assert.equal(caso({ '@type': 'Restaurant', name: 'Casa Exemplo', telephone: '1' }).fatos.length, 1);
  assert.equal(caso({ '@type': 'Organization', url: 'https://www.casa.example/', name: 'Outro nome', telephone: '1' }).fatos.length, 1, 'url do site');
  assert.equal(caso({ '@type': ['Thing', 'https://schema.org/HairSalon'], name: 'casa exemplo', telephone: '1' }).fatos.length, 1);
  assert.equal(caso({ '@type': 'LocalBusiness', name: 'CasaExemplo', telephone: '1' }).fatos.length, 1, 'nome colado igual ao nome do negócio');
  assert.equal(fatosDoJsonLd([JSON.stringify({ '@type': 'LocalBusiness', name: 'Doce Lar', telephone: '1' })], { host: 'www.docelar.com.br', nomes: [] }).fatos.length, 1, 'nome colado igual ao do endereço');
  for (const o of [
    { '@type': 'Person', name: 'Casa Exemplo', telephone: '1' },
    { '@type': 'WebSite', name: 'Casa Exemplo', telephone: '1' },
    { name: 'Casa Exemplo', telephone: '1' },
    { '@type': 'Organization', name: 'Agência Inventada', telephone: '1' },
    { '@type': 'LocalBusiness', name: 'Casa Exemplo', url: 'https://agencia.example/', telephone: '1' },
    { '@type': 'Organization', name: 'Casa Exemplo Agência Digital', telephone: '1' },
    { '@type': 'Organization', name: 'Exemplos Web', telephone: '1' },
    { '@type': 'LocalBusiness', name: '', telephone: '1' },
  ]) {
    const r = caso(o);
    assert.equal(r.fatos.length, 0, JSON.stringify(o));
    assert.equal(r.outros.length, 1, JSON.stringify(o));
  }
  const comPonto = caso({ '@type': 'Store', name: 'Casa Exemplo', address: { '@type': 'PostalAddress', streetAddress: 'Rua A' }, contactPoint: { '@type': 'ContactPoint', telephone: '2' } });
  assert.deepEqual(comPonto.fatos.map((f) => `${f.tipo}:${f.valor}`), ['Telefone:2', 'Endereço:Rua A']);
  assert.equal(comPonto.outros.length, 0, 'endereço e contactPoint do negócio não viram "de outro"');
});

test('site de uma página só, com referência própria: contato do corpo é fato; o que está só no rodapé (e difere) vira aviso', comPasta(async (pasta) => {
  const mapa = {
    'https://casa.example/': {
      url: 'https://casa.example/',
      titulo: 'Casa Exemplo',
      links: ['mailto:ola@casa.example', 'https://wa.me/5511988887777', 'mailto:ola@casa.example', rodapeDeAgencia],
      rodape: ['mailto:ola@casa.example', rodapeDeAgencia],
      jsonld: [ldDoNegocio],
    },
  };
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor: leitorDeSite(mapa), data: DATA });
  const fatos = r.registros.map((x) => x.fato);
  assert.ok(fatos.includes('E-mail no site atual: ola@casa.example'), 'no corpo e no rodapé: é do negócio');
  assert.ok(fatos.includes('WhatsApp no site atual: 5511988887777'), 'só no corpo: é do negócio');
  assert.ok(!fatos.join(' ').includes('5599999990000'));
  const a = r.avisos.find((x) => x.codigo === 'LER_SITE_CONTATO_DE_TERCEIRO');
  assert.deepEqual(a.dados.contatos.map((c) => `${c.motivo}|${c.valor}`), ['so-no-rodape|5599999990000']);
}));

test('sem referência própria (nem Google nem contato no JSON-LD do negócio): contato repetido fica fato, com aviso leve', comPasta(async (pasta) => {
  const cabecalho = 'https://wa.me/5511977776666';
  const mapa = {
    'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa Exemplo', links: [cabecalho, 'https://casa.example/sobre'] },
    'https://casa.example/sobre': { url: 'https://casa.example/sobre', titulo: 'Sobre', links: [cabecalho, 'mailto:ola@casa.example'] },
  };
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor: leitorDeSite(mapa), data: DATA });
  const fatos = r.registros.map((x) => x.fato);
  assert.ok(fatos.includes('WhatsApp no site atual: 5511977776666'), fatos.join('\n'));
  assert.ok(fatos.includes('E-mail no site atual: ola@casa.example'));
  assert.ok(fs.readFileSync(path.join(pasta, 'fatos.md'), 'utf8').includes('5511977776666'));
  assert.ok(!r.avisos.some((a) => a.codigo === 'LER_SITE_CONTATO_DE_TERCEIRO'));
  const leve = r.avisos.find((a) => a.codigo === 'LER_SITE_CONTATO_A_CONFERIR');
  assert.ok(leve, r.avisos.map((a) => a.codigo).join(', '));
  assert.deepEqual(leve.dados.contatos.map((c) => `${c.motivo}|${c.valor}`), ['em-todas-as-paginas|5511977776666']);
}));

test('página seguinte que redireciona para outro endereço fica de fora; só a primeira para a leitura', comPasta(async (pasta) => {
  const mapa = {
    'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa Exemplo', links: ['https://casa.example/loja', 'https://casa.example/sobre', 'tel:+5500000001234'] },
    'https://casa.example/loja': { url: 'https://www.ifood.com.br/delivery/outra', links: ['tel:+5588888880000', 'https://www.ifood.com.br/x'] },
    'https://casa.example/sobre': { url: 'https://www.casa.example/sobre', links: [] },
  };
  const s = await lerSite(leitorDeSite(mapa), 'https://casa.example/');
  assert.deepEqual(s.paginas.map((p) => p.url), ['https://casa.example/', 'https://www.casa.example/sobre']);
  assert.deepEqual(s.foraDoSite, [{ pedida: 'https://casa.example/loja', abriu: 'https://www.ifood.com.br/delivery/outra' }]);
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor: leitorDeSite(mapa), data: DATA });
  assert.ok(!JSON.stringify(r.registros).includes('8888880000'));
  assert.ok(!r.registros.some((x) => x.fonte.includes('ifood')));
  assert.equal(r.dados.site.fora_do_site, 1);
}));

test('--site de rede social ou página de links não é lido: aviso para a pessoa confirmar; sem "https://" ele completa', comPasta(async (pasta) => {
  for (const site of ['https://www.instagram.com/casa', 'linktr.ee/casa', 'https://wa.me/5511']) {
    const leitor = leitorDeSite({});
    const r = await lerFontes({ site }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor, data: DATA });
    assert.equal(leitor.visitas.length, 0, site);
    assert.deepEqual(r.avisos.map((a) => a.codigo), ['LER_SITE_OUTRO_ENDERECO'], site);
    assert.equal(r.avisos[0].dados.endereco, site);
  }
  const leitor = leitorDeSite({ 'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa', links: [] } });
  await lerFontes({ site: 'casa.example' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor, data: DATA });
  assert.deepEqual(leitor.visitas, ['https://casa.example/']);
}));

test('marca da parte lida quebrada: fatos.md não muda e nada se perde; fatos.md certo é guardado em coleta/ antes', comPasta(async (pasta) => {
  const secao = secaoLida([{ fato: 'A', fonte: 'f', data: DATA }], DATA);
  const quebrados = [
    `# Fatos\n${MARCA_INICIO}\ntexto da pessoa que não pode sumir\n`,
    `# Fatos\ntexto da pessoa\n${MARCA_FIM}\n`,
    `# Fatos\n${MARCA_INICIO}\nx\n${MARCA_FIM}\nmeio da pessoa\n${MARCA_INICIO}\ny\n${MARCA_FIM}\n`,
    `# Fatos\n${MARCA_FIM}\nmeio da pessoa\n${MARCA_INICIO}\n`,
    `# Fatos\n${MARCA_INICIO}\n${MARCA_INICIO}\nmeio\n${MARCA_FIM}\n`,
  ];
  const leitor = () => leitorDeSite({ 'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa', links: ['mailto:ola@casa.example'] } });
  for (const [i, md] of quebrados.entries()) {
    assert.equal(juntarNoFatos(md, secao), null, `caso ${i}`);
    const dir = path.join(pasta, `q${i}`);
    fs.mkdirSync(dir);
    const arquivo = path.join(dir, 'fatos.md');
    fs.writeFileSync(arquivo, md);
    const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(dir, 'coleta'), fatos: arquivo, leitor: leitor(), data: DATA });
    assert.equal(fs.readFileSync(arquivo, 'utf8'), md, `caso ${i}: fatos.md ficou igual`);
    assert.ok(r.avisos.some((a) => a.codigo === 'LER_FATOS_MARCADOR_QUEBRADO'), `caso ${i}`);
    assert.equal(r.dados.fatos_no_arquivo, false);
    assert.ok(fs.readFileSync(path.join(dir, 'coleta', 'fatos-lidos.json'), 'utf8').includes('ola@casa.example'), 'o lido fica em coleta/');
  }
  const dir = path.join(pasta, 'certo');
  fs.mkdirSync(dir);
  const arquivo = path.join(dir, 'fatos.md');
  fs.writeFileSync(arquivo, '# Fatos\nminha nota\n');
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(dir, 'coleta'), fatos: arquivo, leitor: leitor(), data: DATA });
  assert.equal(r.dados.fatos_no_arquivo, true);
  assert.equal(fs.readFileSync(path.join(dir, 'coleta', 'fatos-antes-da-leitura.md'), 'utf8'), '# Fatos\nminha nota\n');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['coleta', 'fatos.md'], 'nenhuma cópia solta ao lado de fatos.md');
}));

test('fatos.md salvo com BOM (Bloco de Notas antigo) continua com ele, e o texto da pessoa fica', comPasta(async (pasta) => {
  const arquivo = path.join(pasta, 'fatos.md');
  fs.writeFileSync(arquivo, '\uFEFF# Fatos\r\nminha frase\r\n');
  const leitor = leitorDeSite({ 'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa', links: ['mailto:ola@casa.example', 'https://casa.example/b'] }, 'https://casa.example/b': { url: 'https://casa.example/b', links: [] } });
  await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: arquivo, leitor, data: DATA });
  const md = fs.readFileSync(arquivo, 'utf8');
  assert.ok(md.startsWith('\uFEFF# Fatos\r\nminha frase\r\n'), JSON.stringify(md.slice(0, 40)));
  assert.ok(md.includes('ola@casa.example') && !md.split('\r\n').join('').includes('\n'));
}));

test('fatos.md com fim de linha misturado: cada linha que já existia fica com o fim dela', () => {
  const md = '# Fatos\r\nlinha LF\nlinha CRLF\r\n\r\n| Fato | Fonte | Data |\n|---|---|---|\r\n| X | Y | Z |\n';
  const um = juntarNoFatos(md, secaoLida([{ fato: 'A', fonte: 'f', data: DATA }], DATA));
  assert.ok(um.startsWith(md), JSON.stringify(um.slice(0, 120)));
  assert.ok(um.includes(`\r\n${MARCA_INICIO}\r\n`), 'linha nova usa o fim mais usado (CRLF)');
  const comNota = `${um}nota da pessoa\n`;
  const dois = juntarNoFatos(comNota, secaoLida([{ fato: 'B', fonte: 'f', data: DATA }], DATA));
  assert.equal(dois.slice(0, dois.indexOf(MARCA_INICIO)), comNota.slice(0, comNota.indexOf(MARCA_INICIO)));
  assert.equal(dois.slice(dois.indexOf(MARCA_FIM)), comNota.slice(comNota.indexOf(MARCA_FIM)));
  assert.ok(dois.includes('| B | f |') && !dois.includes('| A | f |') && dois.endsWith('nota da pessoa\n'));
});

test('fatos.md com fim de linha do Windows (CRLF) continua todo em CRLF depois da leitura', () => {
  const md = '# Fatos\r\n\r\n| Fato | Fonte | Data |\r\n|---|---|---|\r\n| X | Y | Z |\r\n';
  const um = juntarNoFatos(md, secaoLida([{ fato: 'A', fonte: 'f', data: DATA }], DATA));
  assert.ok(um.includes(MARCA_INICIO) && um.includes('| A | f |') && um.endsWith(`${MARCA_FIM}\r\n`));
  assert.equal(um.split('\r\n').join('').includes('\n'), false, 'nenhuma quebra sozinha');
  const dois = juntarNoFatos(um, secaoLida([{ fato: 'B', fonte: 'f', data: DATA }], DATA));
  assert.equal(dois.split('\r\n').join('').includes('\n'), false);
  assert.ok(dois.includes('| B | f |') && !dois.includes('| A | f |') && dois.endsWith(`${MARCA_FIM}\r\n`));
  assert.equal(juntarNoFatos('# Fatos\n', secaoLida([], DATA)).includes('\r'), false, 'arquivo com LF fica em LF');
});

test('teto de tempo: a leitura para no teto, grava o que já leu e avisa', comPasta(async (pasta) => {
  // Site sem fim: cada página leva 50 ms e aponta para a próxima. Margens largas: a máquina do
  // teste pode estar ocupada; o que importa é parar perto do teto, e não ler para sempre.
  const mapa = (url) => {
    const n = Number(new URL(url).pathname.split('/').pop() || 0);
    return { url, titulo: 'Casa', links: [`https://casa.example/p/${n + 1}`, `mailto:p${n}@casa.example`] };
  };
  const fatos = path.join(pasta, 'fatos.md');
  const inicio = Date.now();
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos, leitor: leitorDeSite(mapa, { esperaMs: 50 }), data: DATA, tetoMs: 1000 });
  assert.ok(Date.now() - inicio < 6000, `parou em ${Date.now() - inicio} ms`);
  assert.ok(r.avisos.some((a) => a.codigo === 'LER_TEMPO_ESGOTADO'), r.avisos.map((a) => a.codigo).join(', '));
  assert.ok(r.dados.site.paginas >= 1 && r.dados.site.paginas < 30, String(r.dados.site.paginas));
  assert.ok(fs.readFileSync(fatos, 'utf8').includes('p0@casa.example'), 'o que já leu foi para fatos.md');
  // Google que nunca responde: para no teto também, e o site nem começa.
  const parado = { ir: () => new Promise(() => {}), avaliar: async () => null, esperarAte: async () => null };
  const inicio2 = Date.now();
  const r2 = await lerFontes({ negocio: 'Casa, Cidade', site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta2'), fatos: path.join(pasta, 'f2.md'), leitor: parado, data: DATA, tetoMs: 200 });
  assert.ok(Date.now() - inicio2 < 5000, `parou em ${Date.now() - inicio2} ms`);
  assert.deepEqual(r2.avisos.map((a) => a.codigo), ['LER_TEMPO_ESGOTADO']);
  assert.equal(fs.existsSync(path.join(pasta, 'f2.md')), false);
}));

test('teto de tempo: conta do início do comando (navegador incluído) e cobre o laço das fotos', comPasta(async (pasta) => {
  const leitor = leitorDeSite({ 'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa', links: [] } });
  const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'f.md'), leitor, data: DATA, inicio: Date.now() - TETO_DA_LEITURA_MS });
  assert.equal(leitor.visitas.length, 0, 'o tempo já tinha acabado ao abrir o navegador');
  assert.deepEqual(r.avisos.map((a) => a.codigo), ['LER_TEMPO_ESGOTADO']);
  const comando = fs.readFileSync(path.join(RAIZ, 'kit', 'scripts', 'comandos', 'ler.mjs'), 'utf8');
  const marca = comando.indexOf('const inicio = Date.now()');
  assert.ok(marca !== -1 && marca < comando.indexOf('abrirLeitor()') && comando.includes('inicio })'), 'o comando mede antes de abrir o navegador e passa o instante');
  // Fotos: um download que nunca termina não segura a leitura além do prazo.
  const imagens = [1, 2, 3].map((n) => ({ src: `https://fotos.example/${n}.jpg`, largura: 800, altura: 600, alt: '' }));
  const comFotos = leitorDeSite({ 'https://casa.example/': { url: 'https://casa.example/', titulo: 'Casa', links: [], imagens } });
  const baixarFoto = () => new Promise(() => {});
  const inicio = Date.now();
  const s = await lerSite(comFotos, 'https://casa.example/', { pasta: path.join(pasta, 'site'), prazo: Date.now() + 300, baixarFoto });
  assert.ok(Date.now() - inicio < 3000, `parou em ${Date.now() - inicio} ms`);
  assert.equal(s.esgotou, true);
  assert.equal(s.paginas.length, 1, 'a página lida fica');
}));

test('foto: a consulta do nome tem prazo próprio e respeita o prazo da leitura', comPasta(async (pasta) => {
  const parado = () => new Promise(() => {});
  const inicio = Date.now();
  await assert.rejects(baixar('https://fotos.example/a.jpg', path.join(pasta, 'a.jpg'), { consultarNome: parado, tetoDoNomeMs: 100 }), (e) => !(e instanceof TempoEsgotado) && e.message.includes('não respondeu'));
  await assert.rejects(baixar('https://fotos.example/a.jpg', path.join(pasta, 'a.jpg'), { consultarNome: parado, prazo: Date.now() + 150 }), (e) => e instanceof TempoEsgotado);
  assert.ok(Date.now() - inicio < 3000, `parou em ${Date.now() - inicio} ms`);
  const interno = async () => [{ address: '10.0.0.5', family: 4 }];
  await assert.rejects(baixar('https://fotos.example/a.jpg', path.join(pasta, 'a.jpg'), { consultarNome: interno }), (e) => e.message.includes('endereço interno'));
  assert.equal(fs.existsSync(path.join(pasta, 'a.jpg')), false);
}));

test('o comando ler nunca liga as opções só de teste (teto curto e endereço local)', () => {
  const comando = fs.readFileSync(path.join(RAIZ, 'kit', 'scripts', 'comandos', 'ler.mjs'), 'utf8');
  for (const opcao of ['tetoMs', 'permitirEnderecoLocal']) assert.ok(!comando.includes(opcao), opcao);
});

test('Google: o "Mais" das avaliações é clicado uma vez só, mesmo quando o texto demora a aparecer', async () => {
  const chamadas = [];
  let leituras = 0;
  const lido = { url: 'https://g.example/maps/place/Casa', nome: 'Casa', endereco: '', telefone: '', telefoneId: '', site: '', linhas: [], rotulos: [], nota: '' };
  const respostas = {
    estadoDaBusca: () => 'lugar',
    enderecoDoLugar: () => lido.url,
    lerLugarNaPagina: () => lido,
    abrirAvaliacoes: () => true,
    haAvaliacoes: () => true,
    abrirTextosInteiros: () => 1,
    lerAvaliacoesNaPagina: () => {
      leituras += 1;
      return leituras < 3 ? null : [{ estrelas: '5 estrelas', texto: 'bom', quando: '' }];
    },
  };
  const avaliar = async (fn) => {
    chamadas.push(fn.name);
    return respostas[fn.name]();
  };
  const leitor = {
    ir: async () => {},
    avaliar,
    esperarAte: async (fn) => {
      for (let i = 0; i < 10; i += 1) {
        const v = await avaliar(fn);
        if (v) return v;
      }
      return null;
    },
  };
  const { lerGoogle } = await import('../scripts/lib/ler-google.mjs');
  const g = await lerGoogle(leitor, 'Casa');
  assert.equal(g.avaliacoes.length, 1);
  assert.equal(chamadas.filter((n) => n === 'abrirTextosInteiros').length, 1, chamadas.join(', '));
  assert.ok(chamadas.filter((n) => n === 'lerAvaliacoesNaPagina').length >= 3);
});

// Servidor de fotos em 127.0.0.1: grande com tamanho declarado, grande sem tamanho (aos pedaços),
// pequena, e um redirecionamento.
function servirFotos() {
  const pedidos = [];
  const srvFotos = http.createServer((req, res) => {
    pedidos.push(req.url);
    if (req.url === '/grande-com-tamanho') return res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': '5000' }).end(Buffer.alloc(5000));
    if (req.url === '/grande-sem-tamanho') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      for (let i = 0; i < 5; i += 1) res.write(Buffer.alloc(1000));
      return res.end();
    }
    if (req.url === '/pequena') return res.writeHead(200, { 'Content-Type': 'image/png' }).end(Buffer.alloc(100));
    if (req.url === '/desvio') return res.writeHead(302, { Location: '/pequena' }).end();
    return res.writeHead(404).end();
  });
  return new Promise((resolve) => srvFotos.listen(0, '127.0.0.1', () => resolve({ origem: `http://127.0.0.1:${srvFotos.address().port}`, pedidos, fechar: () => new Promise((f) => srvFotos.close(() => f())) })));
}

test('foto: só http/https, nunca endereço interno; teto de tamanho pelo cabeçalho e aos pedaços', comPasta(async (pasta) => {
  for (const h of ['127.0.0.1', '10.0.0.8', '172.16.0.1', '172.31.255.1', '192.168.1.1', '169.254.169.254', '[::1]', 'localhost', 'loja.localhost', '[::ffff:7f00:1]', '[fd00::1]', '0.0.0.0']) assert.ok(ehEnderecoInterno(h), h);
  for (const h of ['8.8.8.8', '172.32.0.1', 'casa.example', '[2001:db8::1]']) assert.ok(!ehEnderecoInterno(h), h);
  const fotos = await servirFotos();
  const destino = path.join(pasta, 'f.png');
  try {
    for (const url of [`${fotos.origem}/pequena`, `http://localhost:${new URL(fotos.origem).port}/pequena`, 'file:///etc/hosts', 'ftp://casa.example/f.png']) {
      await assert.rejects(baixar(url, destino), url);
    }
    assert.equal(fotos.pedidos.length, 0, 'endereço interno nem é pedido');
    const local = { permitirEnderecoLocal: true, tetoBytes: 2000 };
    assert.equal((await baixar(`${fotos.origem}/pequena`, destino, local)).bytes, 100);
    assert.equal((await baixar(`${fotos.origem}/desvio`, destino, local)).bytes, 100, 'segue o redirecionamento, conferindo cada endereço');
    await assert.rejects(baixar(`${fotos.origem}/grande-com-tamanho`, path.join(pasta, 'g1.png'), local), (e) => e.message.includes('grande demais'));
    await assert.rejects(baixar(`${fotos.origem}/grande-sem-tamanho`, path.join(pasta, 'g2.png'), local), (e) => e.message.includes('grande demais'));
    assert.ok(!fs.existsSync(path.join(pasta, 'g1.png')) && !fs.existsSync(path.join(pasta, 'g2.png')), 'nada gravado');
  } finally {
    await fotos.fechar();
  }
}));


test('teste de navegador: sem Chrome é pulado fora do CI; no CI (variável ligada) roda e falha', () => {
  assert.equal(opcoesDoNavegador(1, { tem: false, exige: false }).skip, 'sem Chrome, Edge ou Chromium nesta máquina');
  assert.equal(opcoesDoNavegador(1, { tem: false, exige: true }).skip, false);
  assert.equal(opcoesDoNavegador(1, { tem: true, exige: false }).skip, false);
  assert.throws(() => exigirNavegador(false), (e) => e.message.includes('ESTUDIO_TESTES_EXIGEM_NAVEGADOR'));
  const ci = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'testes.yml'), 'utf8');
  assert.ok(ci.includes("ESTUDIO_TESTES_EXIGEM_NAVEGADOR: '1'"), 'o CI liga a variável');
});

test('teto de tempo também no Instagram: sem tempo, nem abre; fotos que faltam ficam sem arquivo', comPasta(async (pasta) => {
  const leitor = leitorDeSite({});
  const r = await lerFontes({ instagram: 'casa.exemplo', site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos: path.join(pasta, 'fatos.md'), leitor, data: DATA, inicio: Date.now() - TETO_DA_LEITURA_MS });
  assert.equal(leitor.visitas.length, 0, 'o tempo já tinha acabado: o Instagram nem foi aberto');
  assert.deepEqual(r.avisos.map((a) => a.codigo), ['LER_TEMPO_ESGOTADO']);
  const posts = [{ codigo: 'Cex01', fotos: [{ url: 'https://fotos.example/1.jpg' }, { url: 'https://fotos.example/2.jpg' }] }];
  const b = await baixarFotos(posts, path.join(pasta, 'fotos'), { prazo: Date.now() - 1 });
  assert.equal(b.esgotou, true);
  assert.deepEqual(b.fotos, []);
  assert.deepEqual(b.posts[0].fotos.map((f) => f.erro), ['sem-tempo', 'sem-tempo']);
  assert.equal(fs.existsSync(path.join(pasta, 'fotos')), false, 'nenhuma foto pedida');
}));

test('teto de tempo no Instagram é duro: uma página que nunca abre não segura a leitura, e o que já foi lido fica', async () => {
  const lerPerfil = { links: ['https://ig.example/p/AAA/', 'https://ig.example/p/BBB/'], jsons: [], jsonsDePosts: [], descricao: '', foto: '', titulo: 'Casa (@casa)' };
  const leitor = {
    ir: (url) => (url.includes('/p/BBB/') ? new Promise(() => {}) : Promise.resolve()),
    avaliar: async (fn) => (fn.name === 'lerPerfilNaPagina' ? lerPerfil : true),
    esperarAte: async (fn) => (fn.name === 'lerPostNaPagina' ? { jsons: [], descricao: '', datas: ['2026-11-01T10:00:00'], foto: '' } : 2),
  };
  const inicio = Date.now();
  const r = await lerInstagram(leitor, 'casa', { base: 'https://ig.example', maximo: 2, pausa: 0, prazo: Date.now() + 500 });
  assert.ok(Date.now() - inicio < 3000, `parou em ${Date.now() - inicio} ms`);
  assert.equal(r.esgotou, true);
  assert.deepEqual(r.posts.map((p) => p.codigo), ['AAA']);
  const nada = { ...leitor, ir: () => new Promise(() => {}) };
  await assert.rejects(lerInstagram(nada, 'casa', { base: 'https://ig.example', prazo: Date.now() + 200 }), (e) => e instanceof TempoEsgotado);
});
