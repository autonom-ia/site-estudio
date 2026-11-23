// Leitura sem login, de ponta a ponta no navegador, contra páginas SINTÉTICAS servidas aqui mesmo
// (fixtures/fontes-sinteticas.mjs): só com o @ e o nome do negócio, os fatos saem com fonte e data,
// o horário vem do painel do lugar no Google (não do trecho de busca), as avaliações saem sem o nome
// de quem escreveu e o Instagram dá pelo menos 12 publicações com legenda e data. Pula sem navegador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { abrirLeitor } from '../scripts/lib/leitor.mjs';
import { lerFontes } from '../scripts/lib/ler.mjs';
import { lerTabelaDeFatos } from '../scripts/lib/fatos.mjs';
import { MARCA_INICIO } from '../scripts/lib/registros.mjs';
import { servirFontes, USUARIO, NEGOCIO, AUTORES, TOTAL_DE_POSTS } from './fixtures/fontes-sinteticas.mjs';

const SEM_NAVEGADOR = !acharNavegador();
const opcoes = { skip: SEM_NAVEGADOR ? 'sem Chrome, Edge ou Chromium nesta máquina' : false, timeout: 240000 };
const DATA = '2026-11-23';

let srv;
let leitor;
let pasta;
let fatos;
let r;

before(async () => {
  if (SEM_NAVEGADOR) return;
  srv = await servirFontes();
  leitor = await abrirLeitor();
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ler-'));
  fatos = path.join(pasta, 'fatos.md');
  fs.writeFileSync(fatos, '# Fatos do site\n\n| Fato | Fonte | Data |\n|---|---|---|\n| Fundada em 2015 | a dona, por mensagem | 2026-11-20 |\n');
  const bases = { instagram: srv.origem, google: srv.origem };
  r = await lerFontes({ instagram: `@${USUARIO}`, negocio: NEGOCIO, posts: 24 }, { pasta: path.join(pasta, 'coleta'), fatos, leitor, bases, pausa: 50, data: DATA });
});

after(async () => {
  leitor?.fechar();
  await srv?.fechar();
  if (pasta) fs.rmSync(pasta, { recursive: true, force: true });
});

const codigos = () => r.avisos.map((a) => a.codigo);

test('Instagram sem login: 14 publicações com legenda e data, foto na maior resolução pública', opcoes, () => {
  assert.equal(r.dados.instagram.posts_com_legenda_e_data, TOTAL_DE_POSTS);
  assert.ok(r.dados.instagram.posts_com_legenda_e_data >= 12);
  const posts = JSON.parse(fs.readFileSync(path.join(pasta, 'coleta', 'instagram', 'posts.json'), 'utf8'));
  for (const p of posts) {
    assert.ok(p.legenda.startsWith('Legenda '), p.codigo);
    assert.equal(p.data.length, 10, p.codigo);
    assert.ok(p.url.includes(p.codigo));
  }
  const doJson = posts.find((p) => p.codigo === 'Cex01');
  assert.equal(doJson.de, 'json');
  assert.equal(doJson.fotos[0].largura, 1080, 'a maior das fotos públicas, não a de 640');
  assert.equal(posts.find((p) => p.codigo === 'Cex03').fotos.length, 2, 'carrossel: uma foto por item');
  assert.equal(posts.find((p) => p.codigo === 'Cex02').de, 'etiquetas');
  assert.ok(fs.existsSync(path.join(pasta, 'coleta', 'instagram', 'fotos', 'Cex01-1.jpg')));
  assert.ok(!codigos().includes('LER_INSTAGRAM_POUCOS'));
  assert.ok(!codigos().includes('LER_FOTOS_PEQUENAS'));
  const md = fs.readFileSync(path.join(pasta, 'coleta', 'instagram', 'posts.md'), 'utf8');
  assert.ok(md.includes('Legenda 1 / com barra segunda linha'), 'barra e quebra não desmontam a tabela');
});

test('Google: horário de cada dia vem do painel do lugar, com a fonte do lugar e a data', opcoes, () => {
  const linhas = lerTabelaDeFatos(fs.readFileSync(fatos, 'utf8'));
  const horario = linhas.filter((l) => l.fato.startsWith('Horário de '));
  assert.deepEqual(
    horario.map((l) => l.fato),
    ['Horário de segunda-feira: Fechado', 'Horário de terça-feira: 07:00–12:00, 14:00–19:00', 'Horário de quarta-feira: 07:00–19:00', 'Horário de sábado: 08:00–13:00'],
  );
  for (const l of horario) {
    assert.ok(l.comFonte);
    assert.ok(l.fonte.startsWith('Perfil do Google, ') && l.fonte.includes('/maps/place/'), l.fonte);
  }
  assert.ok(!fs.readFileSync(fatos, 'utf8').includes('24 horas'), 'trecho de busca nunca vira fato');
  const fatoDe = (inicio) => linhas.find((l) => l.fato.startsWith(inicio));
  assert.equal(fatoDe('Endereço: ').fato, 'Endereço: Rua Inventada, 100 - Bairro Exemplo, Cidade Exemplo - UF');
  assert.equal(fatoDe('Telefone: ').fato, 'Telefone: (00) 0000-1234');
  assert.equal(fatoDe('Nota no Google').fato, 'Nota no Google: 4,8 (37 avaliações)');
  assert.ok(codigos().includes('LER_GOOGLE_PRIMEIRO_DA_LISTA'), 'dois resultados: pede confirmação');
});

test('avaliações do Google sem o nome de quem escreveu, em nenhum arquivo', opcoes, () => {
  const linhas = lerTabelaDeFatos(fs.readFileSync(fatos, 'utf8'));
  const avaliacoes = linhas.filter((l) => l.fato.startsWith('Avaliação no Google'));
  assert.equal(avaliacoes.length, 2);
  assert.ok(avaliacoes[0].fato.includes('5 estrelas, há 2 semanas'));
  assert.ok(avaliacoes[0].fato.includes('e o atendimento foi ótimo'), 'o "Mais" foi aberto');
  const tudo = [fatos, path.join(pasta, 'coleta', 'google', 'lugar.json'), path.join(pasta, 'coleta', 'fatos-lidos.json')].map((a) => fs.readFileSync(a, 'utf8')).join('\n');
  for (const autor of AUTORES) assert.ok(!tudo.includes(autor), autor);
});

test('site atual achado pelo Google e lido inteiro; arquivo e endereço de fora não são visitados', opcoes, () => {
  assert.equal(r.dados.site.paginas, 2);
  assert.ok(!srv.pedidos.some((p) => p.includes('cardapio.pdf')));
  const linhas = lerTabelaDeFatos(fs.readFileSync(fatos, 'utf8')).map((l) => l.fato);
  assert.ok(linhas.includes('Telefone declarado pelo site atual: (00) 0000-1234'));
  assert.ok(linhas.includes('Horário declarado pelo site atual: Wednesday: 07:00 a 19:00'));
  assert.ok(linhas.includes('E-mail no site atual: ola@casa.example'));
  assert.ok(linhas.includes('WhatsApp na bio do Instagram: 5500900001111'));
  assert.ok(linhas.includes(`Instagram: @${USUARIO}`));
  assert.equal(r.dados.site.fotos, 1, 'só a foto com 600 pontos ou mais');
  assert.ok(fs.readFileSync(path.join(pasta, 'coleta', 'site', 'texto.md'), 'utf8').includes('Fale com a gente.'));
});

test('fatos.md: o que a pessoa escreveu fica; a parte lida entra uma vez, com data em toda linha', opcoes, () => {
  const md = fs.readFileSync(fatos, 'utf8');
  assert.ok(md.includes('| Fundada em 2015 | a dona, por mensagem | 2026-11-20 |'));
  assert.equal(md.split(MARCA_INICIO).length, 2);
  const lidas = md.slice(md.indexOf(MARCA_INICIO)).split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Fato'));
  assert.ok(lidas.length >= 15);
  for (const l of lidas) assert.ok(l.endsWith(`| ${DATA} |`), l);
  assert.equal(r.dados.fatos_registrados, lidas.length);
});
