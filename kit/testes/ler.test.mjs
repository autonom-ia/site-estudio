// Peças da leitura sem login, sem navegador: @ e código de publicação, JSON embutido do Instagram,
// horário e nota do Google, links e JSON-LD do site, registros em fatos.md e o comando sem endereço.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { usuarioDoInstagram, codigoDoPost, dadosDoPost, dadosDoPerfil, melhorFoto, legendaDaDescricao } from '../scripts/lib/ler-instagram.mjs';
import { horarioDoLugar, notaDoLugar, dadosDoLugar, enderecoDaBusca, ehDiaDaSemana } from '../scripts/lib/ler-google.mjs';
import { linksDoMesmoSite, contatosDosLinks, fatosDoJsonLd } from '../scripts/lib/ler-site.mjs';
import { celula, secaoLida, juntarNoFatos, registrosDoGoogle, MARCA_INICIO } from '../scripts/lib/registros.mjs';
import { ehSiteDoNegocio } from '../scripts/lib/ler.mjs';
import { dimensoes } from '../scripts/lib/baixar.mjs';
import { acharObjetos, hoje } from '../scripts/lib/leitor.mjs';
import { lerTabelaDeFatos, montarLastro, conferirTexto } from '../scripts/lib/fatos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');

test('@ do Instagram: com arroba, sem arroba e endereço do perfil dão no mesmo', () => {
  for (const e of ['@casa.exemplo', 'casa.exemplo', 'https://www.instagram.com/casa.exemplo/?hl=pt', 'instagram.com/Casa.Exemplo', '  @@casa.exemplo ']) {
    assert.equal(usuarioDoInstagram(e), 'casa.exemplo', e);
  }
  assert.equal(usuarioDoInstagram(''), '');
});

test('código da publicação: /p/ e /reel/, com ou sem o perfil antes', () => {
  assert.equal(codigoDoPost('https://www.instagram.com/casa/p/AbC1/'), 'AbC1');
  assert.equal(codigoDoPost('https://www.instagram.com/reel/XyZ2/?img_index=1'), 'XyZ2');
  assert.equal(codigoDoPost('https://www.instagram.com/casa/'), '');
  assert.equal(codigoDoPost('não é endereço'), '');
});

test('publicação pelo JSON embutido: pega o item do código certo, a legenda, a data e a maior foto', () => {
  const item = (code, w) => ({ code, taken_at: 1793000000, caption: { text: `de ${code}` }, image_versions2: { candidates: [{ url: `u-${w}`, width: w }, { url: 'u-big', width: 1440 }] } });
  const lido = { jsons: ['{quebrado', JSON.stringify({ a: [{ items: [item('Outro', 320)] }, { items: [item('Meu1', 640)] }] })] };
  const p = dadosDoPost(lido, 'Meu1', 'https://x.example/p/Meu1/');
  assert.equal(p.legenda, 'de Meu1');
  assert.equal(p.data, '2026-10-26');
  assert.deepEqual(p.fotos, [{ url: 'u-big', largura: 1440 }]);
  assert.equal(p.de, 'json');
});

test('foto sem largura na lista: fica a primeira (a página lista da maior para a menor)', () => {
  assert.deepEqual(melhorFoto({ original_width: 1080, image_versions2: { candidates: [{ url: 'a' }, { url: 'b' }] } }), { url: 'a', largura: 1080 });
  assert.equal(melhorFoto({}), null);
});

test('publicação sem JSON: legenda do og:description, data do <time>, foto do og:image', () => {
  const lido = { jsons: [], datas: ['2026-11-03T12:00:00.000Z'], descricao: '5 curtidas - casa em 3 de novembro: "Freio: de "disco"". ', foto: 'https://x.example/f.jpg' };
  const p = dadosDoPost(lido, 'Ab', 'u');
  assert.equal(p.legenda, 'Freio: de "disco"');
  assert.equal(p.data, '2026-11-03');
  assert.equal(p.de, 'etiquetas');
  assert.equal(legendaDaDescricao('sem legenda'), '');
});

test('perfil: nome, bio e links da bio do JSON embutido', () => {
  const lido = { jsons: [JSON.stringify({ x: { user: { username: 'casa', full_name: 'Casa', biography: 'Bio', bio_links: [{ url: 'https://wa.me/550' }], external_url: 'https://casa.example' } } })] };
  const p = dadosDoPerfil(lido, 'casa');
  assert.deepEqual([p.nome, p.bio, p.links], ['Casa', 'Bio', ['https://wa.me/550', 'https://casa.example']]);
});

test('horário do Google: tabela do painel; sem tabela, os rótulos de cada dia', () => {
  const linhas = [['domingo', 'Fechado'], ['segunda-feira', '07:00–12:00\n14:00–19:00'], ['Nota', '5'], ['segunda-feira', 'repetido']];
  assert.deepEqual(horarioDoLugar({ linhas }), [{ dia: 'domingo', horas: 'Fechado' }, { dia: 'segunda-feira', horas: '07:00–12:00, 14:00–19:00' }]);
  const rotulos = ['terça-feira, 10:00 a 12:00, 14:00 a 20:00, Copiar horário de funcionamento', 'Endereço: Rua, 1', 'Mostrar horário'];
  assert.deepEqual(horarioDoLugar({ linhas: [], rotulos }), [{ dia: 'terça-feira', horas: '10:00 a 12:00, 14:00 a 20:00' }]);
  assert.ok(ehDiaDaSemana('Sábado') && ehDiaDaSemana('monday') && !ehDiaDaSemana('Horário'));
});

test('nota, telefone e endereço do Google; busca pelo nome ou pelo link dado', () => {
  assert.deepEqual(notaDoLugar('4,7\n(112.695)'), { nota: '4,7', total: '112.695' });
  const l = dadosDoLugar({ url: 'https://g.example/maps/place/X/data=1?hl=pt&entry=ttu', nome: ' X ', endereco: 'Endereço: Rua Y, 2 ', telefone: '', telefoneId: 'phone:tel:0000', linhas: [], rotulos: [], nota: '' });
  assert.deepEqual([l.nome, l.endereco, l.telefone, l.fonte], ['X', 'Rua Y, 2', '0000', 'https://g.example/maps/place/X/data=1']);
  assert.equal(enderecoDaBusca('Casa Exemplo, Cidade', 'https://g.example'), 'https://g.example/maps/search/Casa%20Exemplo%2C%20Cidade?hl=pt-BR');
  assert.equal(enderecoDaBusca('https://maps.example/abc'), 'https://maps.example/abc');
});

test('site: só páginas do mesmo endereço, sem arquivo nem âncora; contatos e JSON-LD', () => {
  const links = ['https://www.casa.example/a#x', 'https://casa.example/a', 'https://casa.example/menu.PDF', 'https://fora.example/', 'tel:+5500', 'mailto:oi@casa.example', 'https://wa.me/5511?text=oi', 'https://api.whatsapp.com/send?phone=5522'];
  assert.deepEqual(linksDoMesmoSite(links, 'https://casa.example/'), ['https://casa.example/a']);
  assert.deepEqual(contatosDosLinks([...links, 'tel:+5500']).map((c) => `${c.tipo}:${c.valor}`), ['Telefone:+5500', 'E-mail:oi@casa.example', 'WhatsApp:5511', 'WhatsApp:5522']);
  const ld = JSON.stringify({ '@graph': [{ telephone: '1', address: 'Rua A', openingHours: ['Mo-Fr 08:00-18:00'] }] });
  assert.deepEqual(fatosDoJsonLd([ld, 'quebrado']).map((f) => f.tipo), ['Telefone', 'Endereço', 'Horário']);
});

test('rede social e conversa não contam como site do negócio', () => {
  assert.ok(ehSiteDoNegocio('https://casa.example/'));
  for (const u of ['https://www.instagram.com/casa', 'https://wa.me/55', 'https://m.facebook.com/casa', 'tel:1', 'nada']) assert.ok(!ehSiteDoNegocio(u), u);
});

test('registros entram em fatos.md com fonte e data, sem nome de quem avaliou, e o fatos os aceita', () => {
  const g = { lugar: { nome: 'Casa', endereco: 'Rua A, 100', telefone: '(00) 0000-1234', site: '', horario: [{ dia: 'terça-feira', horas: '07:00–19:00' }], nota: '4,8', total: '37', fonte: 'https://g.example/maps/place/Casa' }, avaliacoes: [{ estrelas: '5', texto: 'Ótimo | bom', quando: 'há 1 mês' }, { estrelas: '4', texto: '', quando: '' }] };
  const regs = registrosDoGoogle(g, '2026-11-23');
  assert.equal(regs.length, 6);
  const md = juntarNoFatos('# Fatos\n', secaoLida(regs, '2026-11-23'));
  const linhas = lerTabelaDeFatos(md);
  assert.equal(linhas.length, 6);
  assert.ok(linhas.every((l) => l.comFonte));
  assert.ok(linhas.some((l) => l.fato === 'Avaliação no Google (5 estrelas, há 1 mês): "Ótimo / bom"'));
  const r = conferirTexto({ texto: 'Ligue (00) 0000-1234, Rua A, 100' }, montarLastro(linhas));
  assert.deepEqual(r.faltam, []);
});

test('a parte lida de fatos.md é trocada inteira na próxima leitura, e o resto fica', () => {
  const um = juntarNoFatos('# Fatos\n\nnota minha\n', secaoLida([{ fato: 'A', fonte: 'f', data: 'd' }], 'd'));
  const dois = juntarNoFatos(`${um}\nfim meu\n`, secaoLida([{ fato: 'B', fonte: 'f', data: 'd' }], 'd'));
  assert.equal(dois.split(MARCA_INICIO).length, 2);
  assert.ok(dois.includes('nota minha') && dois.includes('fim meu') && dois.includes('| B |') && !dois.includes('| A |'));
});

test('célula de tabela: sem barra vertical, sem quebra de linha, com teto', () => {
  assert.equal(celula('a | b\n\nc\t d'), 'a / b c d');
  assert.equal(celula('x'.repeat(10), 5), 'xxxx…');
});

test('tamanho da foto pelo cabeçalho: JPEG e PNG; arquivo estranho dá zero', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0x05, 0x46, 0x04, 0x38, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(dimensoes(jpeg), { largura: 1080, altura: 1350 });
  const png = Buffer.alloc(32);
  png.set([0x89, 0x50, 0x4e, 0x47], 0);
  png.writeUInt32BE(700, 16);
  png.writeUInt32BE(4, 20);
  assert.deepEqual(dimensoes(png), { largura: 700, altura: 4 });
  assert.deepEqual(dimensoes(Buffer.from('texto qualquer')), { largura: 0, altura: 0 });
});

test('acharObjetos percorre listas e objetos sem repetir; hoje sai AAAA-MM-DD', () => {
  const compartilhado = { alvo: 1 };
  assert.equal(acharObjetos({ a: [compartilhado, { b: compartilhado }] }, (o) => 'alvo' in o).length, 1);
  assert.equal(hoje(new Date(2026, 0, 5)), '2026-01-05');
});

test('comando ler sem @, nome, Google nem site: LER_SEM_ENDERECO, saída 1, JSON na última linha', () => {
  const sites = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ler-sites-'));
  try {
    fs.mkdirSync(path.join(sites, 'teste-ler'));
    const r = spawnSync(process.execPath, [DESPACHANTE, 'ler', 'teste-ler'], { encoding: 'utf8', env: { ...process.env, ESTUDIO_SITES: sites, ESTUDIO_DADOS: path.join(sites, 'dados'), ESTUDIO_FERRAMENTAS: path.join(sites, 'ferr') } });
    const linhas = r.stdout.trim().split('\n');
    const json = JSON.parse(linhas[linhas.length - 1]);
    assert.equal(r.status, 1);
    assert.equal(json.codigo, 'LER_SEM_ENDERECO');
    assert.ok(json.resumo.length > 0);
  } finally {
    fs.rmSync(sites, { recursive: true, force: true });
  }
});
