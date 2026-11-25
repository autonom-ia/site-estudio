// Consertos do publicar trazidos do View Estúdio 1.2 (autonom-ia/view-estudio#6), cada um com o caso
// que o reproduzia aqui:
// 1. concluir sem resposta e site mudado depois: a próxima publicação manda o novo, nunca responde
//    PUBLICADO com o que já estava no ar (impressão do conteúdo, não do zip);
// 2. o que o painel recusa (tipo, nome, repetidos, quantidade, index, teto) é conferido antes de enviar,
//    e o molde não leva arquivo sem extensão (a licença do Lenis era LICENSE e o painel recusava);
// 3. .nojekyll vai no pacote para o GitHub Pages, mas fica fora do envio para o painel;
// 4. o endereço só é trocado se o que está no ar foi esta pasta que pôs (outro site, apresentação,
//    cópia, pasta movida pedem --por-cima ou --no-ar); endereço só reservado não conta; envio que caiu
//    no meio libera só a única versão nova que apareceu, nunca uma publicação de outro lugar depois;
// 5. PARTE_EM_ANDAMENTO se reenvia; pedidos de espera do painel têm frase própria;
// 6. aviso de arquivo sem uso compara o nome inteiro ("data.png" não usa "a.png").
// 7. depois de o painel aceitar abrir o envio, o pendente fica mesmo com erro; no-ar.json guarda o
//    nome que a pasta usa, não o que a resposta devolveu (autonom-ia/site-estudio#19).
//    Queda ao abrir o envio desfaz tudo; --voltar registra o pedido antes de mandar, e a resposta
//    perdida não faz a próxima publicação pedir --por-cima.
// Serviço falso só em 127.0.0.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MENSAGENS, RAIZ, rodar, preparar, darChave } from './publicar-apoio.mjs';
import { lerZip } from '../scripts/lib/zip.mjs';
import { listarArquivos } from '../scripts/lib/caminhos.mjs';
import { montarPacote, citaNome, arquivosNaoCitados } from '../scripts/lib/pacote.mjs';
import { conferirParaOPainel, nomeAceito, nomesRepetidos, tipoAceito, MAX_ARQUIVOS, TETO_MB } from '../scripts/lib/regras-do-painel.mjs';
import { KitErro } from '../scripts/lib/saida.mjs';

const NOME = 'meu-site';
const pastaDoSite = (ctx) => path.join(ctx.env.ESTUDIO_SITES, NOME);
const escrever = (ctx, rel, texto) => {
  const abs = path.join(pastaDoSite(ctx), ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, texto);
};
const lerNoAr = (ctx) => JSON.parse(fs.readFileSync(path.join(pastaDoSite(ctx), 'no-ar.json'), 'utf8'));
const nomesDoZip = (zip) => lerZip(zip).map((e) => e.nome).sort();

test('1. concluir sem resposta, site mudado depois: a versão nova sobe (nunca PUBLICADO com a antiga)', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  e.concluirCai = 'sem_publicar';
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_CONCLUSAO_INCERTA');
  ctx.servico.publicarPendentes(); // a versão de antes entrou no ar depois
  escrever(ctx, 'site/index.html', '<title>Meu site</title><h1>Novo</h1><img src="assets/foto.txt">');
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.versao], [0, 'PUBLICADO', 2], r.saida);
  assert.equal(e.aberturas, 2, 'mandou o site novo');
  const index = lerZip(e.publicados[1].zip).find((x) => x.nome === 'index.html');
  assert.ok(index.dados.toString('utf8').includes('Novo'), 'o que está no ar é a versão nova');
});

test('1b. concluir sem resposta e a versão nova no ar é de outro pacote (outro tamanho): é de outro lugar, pede --por-cima', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  e.concluirCai = 'sem_publicar';
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_CONCLUSAO_INCERTA');
  e.pendentes.length = 0; // o nosso não entrou; entrou outra coisa no lugar
  e.publicados.push({ slug: NOME, versao: 1, zip: Buffer.from('outra coisa') });
  e.noAr.set(NOME, 1);
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao_no_ar, e.aberturas], ['PUBLICAR_ENDERECO_JA_EM_USO', 1, 1], r.saida);
  const s = await ctx.publicar('--por-cima');
  assert.deepEqual([s.json.codigo, s.json.dados.versao, e.aberturas], ['PUBLICADO', 2, 2], s.saida);
});

test('1c. impressão do envio é do conteúdo (nomes e bytes), não do zip: só a data mudar não manda de novo', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const site = path.join(pastaDoSite(ctx), 'site');
  const index = path.join(site, 'index.html');
  const antes = montarPacote(site);
  fs.utimesSync(index, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
  const depois = montarPacote(site);
  assert.notEqual(antes.sha256, depois.sha256, 'o zip muda com a data');
  assert.equal(antes.impressao, depois.impressao, 'o conteúdo não mudou');
  const e = ctx.servico.estado;
  e.concluirCai = 'sem_publicar';
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_CONCLUSAO_INCERTA');
  ctx.servico.publicarPendentes();
  fs.utimesSync(index, new Date('2021-01-01T00:00:00Z'), new Date('2021-01-01T00:00:00Z'));
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao, e.aberturas], ['PUBLICADO', 1, 1], 'confirmou sem mandar de novo');
});

test('2. regras do painel: tipo, nome, repetidos, quantidade, index e teto, antes de enviar', () => {
  for (const bom of ['index.html', 'assets/foto.png', '.well-known/x.txt', 'assets/_logo.png', 'a-casa/ação.html']) assert.equal(nomeAceito(bom), true, bom);
  const ruins = ['a\\b.png', 'a:b.png', 'a\u0007.png', 'fo‮to.png', 'assets/.escondido.png', 'assets/.well-known/x.txt',
    `${'a'.repeat(256)}.png`, '../fora.png', 'a//b.png'];
  for (const ruim of ruins) assert.equal(nomeAceito(ruim), false, JSON.stringify(ruim));
  assert.equal(tipoAceito('assets/vendor/lenis/LICENSE'), false);
  assert.equal(tipoAceito('assets/vendor/lenis/LICENSE.txt'), true);
  assert.equal(tipoAceito('assets/3d/cena.glb'), false);
  assert.deepEqual(nomesRepetidos(['index.html', 'assets/Foto.png', 'assets/foto.png']), [['assets/Foto.png', 'assets/foto.png']]);
  assert.deepEqual(nomesRepetidos(['assets', 'assets/x.png']), [['assets/', 'assets']]);
  const codigo = (nomes, bytes = 10) => {
    try {
      conferirParaOPainel({ nomes, zip: { length: bytes }, conteudoBytes: bytes });
      return 'ok';
    } catch (erro) {
      assert.ok(erro instanceof KitErro && erro.sair === 2, String(erro));
      return erro.codigo;
    }
  };
  assert.equal(codigo(['index.html', 'assets/a.png']), 'ok');
  assert.equal(codigo(['a-casa/index.html']), 'SITE_SEM_INDEX');
  assert.equal(codigo(['index.html', 'a:b.png']), 'PUBLICAR_NOME_DE_ARQUIVO_RECUSADO');
  assert.equal(codigo(['index.html', 'assets/vendor/lenis/LICENSE']), 'PUBLICAR_TIPO_NAO_ACEITO');
  assert.equal(codigo(['index.html', 'assets/A.png', 'assets/a.png']), 'PUBLICAR_NOMES_REPETIDOS');
  assert.equal(codigo(['index.html', ...Array.from({ length: MAX_ARQUIVOS }, (_, k) => `assets/${k}.png`)]), 'PUBLICAR_ARQUIVOS_DEMAIS');
  assert.equal(codigo(['index.html'], TETO_MB * 1024 * 1024 + 1), 'PUBLICAR_SITE_GRANDE_DEMAIS');
  for (const novo of ['PUBLICAR_TIPO_NAO_ACEITO', 'PUBLICAR_NOME_DE_ARQUIVO_RECUSADO', 'PUBLICAR_NOMES_REPETIDOS', 'PUBLICAR_ARQUIVOS_DEMAIS',
    'PUBLICAR_ESPERE_UM_POUCO', 'PUBLICAR_ENDERECO_JA_EM_USO', 'PUBLICAR_PASTA_MUDOU']) {
    assert.ok(MENSAGENS[novo] && MENSAGENS[novo].texto && MENSAGENS[novo].acao, novo);
  }
});

test('2b. todo arquivo do molde é de um tipo e de um nome que o painel aceita', () => {
  const molde = path.join(RAIZ, 'kit', 'molde', 'site');
  const arquivos = listarArquivos(molde);
  assert.ok(arquivos.includes('assets/vendor/lenis/LICENSE.txt'), 'a licença do Lenis continua indo junto');
  assert.deepEqual(arquivos.filter((rel) => !tipoAceito(rel) || !nomeAceito(rel)), []);
});

test('2c. arquivo que o painel recusa reprova antes de enviar, com a lista; nada é mandado', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  escrever(ctx, 'site/assets/vendor/lenis/LICENSE', 'MIT');
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.arquivos], [2, 'PUBLICAR_TIPO_NAO_ACEITO', ['site/assets/vendor/lenis/LICENSE']], r.saida);
  assert.equal(ctx.servico.estado.aberturas, 0);
  assert.ok(MENSAGENS.PUBLICAR_TIPO_NAO_ACEITO.acao.includes('LICENSE.txt'));
});

test('3. .nojekyll vai no pacote para outro serviço e fica fora do envio para o painel', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  escrever(ctx, 'site/.nojekyll', '');
  escrever(ctx, 'site/.well-known/security.txt', 'Contact: mailto:x@exemplo.com');
  const p = await rodar(['pacote', NOME], ctx.env);
  assert.equal(p.json.codigo, 'PACOTE_PRONTO', p.saida);
  const doPacote = nomesDoZip(fs.readFileSync(path.join(pastaDoSite(ctx), `${NOME}-site.zip`)));
  assert.ok(doPacote.includes('.nojekyll'), 'o GitHub Pages precisa dele');
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'PUBLICADO'], r.saida);
  const enviados = nomesDoZip(ctx.servico.estado.publicados[0].zip);
  assert.ok(!enviados.includes('.nojekyll'), 'o painel recusa oculto');
  assert.ok(enviados.includes('.well-known/security.txt'));
});

test('4. endereço só reservado por um envio que não publicou (sem versão) não pede --por-cima', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  ctx.servico.estado.sitesVazios.push(NOME);
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'PUBLICADO'], r.saida);
});

test('4b. outra coisa da pessoa no ar no endereço: pergunta antes; --no-ar usa outro; --por-cima troca', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  e.publicados.push({ slug: NOME, versao: 1, zip: Buffer.from('uma apresentação do View') });
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.nome, r.json.dados.versao_no_ar], [2, 'PUBLICAR_ENDERECO_JA_EM_USO', NOME, 1], r.saida);
  assert.equal(e.aberturas, 0, 'nada foi mandado');
  const outro = await ctx.publicar('--no-ar', 'meu-site-novo');
  assert.deepEqual([outro.json.codigo, outro.json.dados.nome], ['PUBLICADO', 'meu-site-novo'], outro.saida);
  assert.equal(lerNoAr(ctx).nome, 'meu-site-novo');
  const deNovo = await ctx.publicar();
  assert.deepEqual([deNovo.json.codigo, deNovo.json.dados.nome, deNovo.json.dados.versao], ['PUBLICADO', 'meu-site-novo', 2], 'o endereço anotado vale da próxima vez');
  const troca = await ctx.publicar('--no-ar', NOME, '--por-cima');
  assert.deepEqual([troca.json.codigo, troca.json.dados.nome, troca.json.dados.versao], ['PUBLICADO', NOME, 2], troca.saida);
});

test('4c. versão no ar que não foi esta pasta que pôs pede --por-cima; --voltar também; --voltar anota', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  assert.equal((await ctx.publicar()).json.dados.versao, 2);
  const volta = await ctx.publicar('--voltar', '1');
  assert.deepEqual([volta.json.codigo, lerNoAr(ctx).versao], ['PUBLICAR_VERSAO_VOLTOU', 1]);
  assert.equal((await ctx.publicar()).json.dados.versao, 3);
  e.publicados.push({ slug: NOME, versao: 4, zip: Buffer.from('de outro computador') });
  e.noAr.set(NOME, 4);
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao_no_ar, r.json.dados.versao_desta], ['PUBLICAR_ENDERECO_JA_EM_USO', 4, 3], r.saida);
  assert.equal((await ctx.publicar('--voltar')).json.codigo, 'PUBLICAR_ENDERECO_JA_EM_USO');
  assert.equal(e.aberturas, 3, 'nada foi mandado');
  assert.equal((await ctx.publicar('--por-cima')).json.dados.versao, 5);
});

test('4f. envio que caiu no meio: a única versão nova é desta pasta; com outra publicação depois, pede --por-cima', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  e.concluirCai = 'sem_publicar';
  escrever(ctx, 'site/index.html', '<title>Meu site</title><h1>Segunda</h1><img src="assets/foto.txt">');
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_CONCLUSAO_INCERTA');
  ctx.servico.publicarPendentes(); // a deste envio entrou no ar (versão 2)
  e.publicados.push({ slug: NOME, versao: 3, zip: Buffer.from('de outro computador') });
  e.noAr.set(NOME, 3);
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao_no_ar], ['PUBLICAR_ENDERECO_JA_EM_USO', 3], r.saida);
  assert.equal((await ctx.publicar('--por-cima')).json.codigo, 'PUBLICADO');
});

test('4g. envio que caiu no meio e só ele entrou no ar: a próxima publicação segue sem pedir nada', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  e.concluirCai = 'sem_publicar';
  escrever(ctx, 'site/index.html', '<title>Meu site</title><h1>Segunda</h1><img src="assets/foto.txt">');
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_CONCLUSAO_INCERTA');
  ctx.servico.publicarPendentes();
  escrever(ctx, 'site/index.html', '<title>Meu site</title><h1>Terceira</h1><img src="assets/foto.txt">');
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao], ['PUBLICADO', 3], r.saida);
});

test('4d. cópia da pasta pede --por-cima; pasta movida pede uma vez; a mesma pasta republica sem pedir', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICADO');
  assert.equal((await ctx.publicar()).json.dados.versao, 2, 'a mesma pasta republica sem pedir');
  const sites = ctx.env.ESTUDIO_SITES;
  fs.cpSync(pastaDoSite(ctx), path.join(sites, 'copia'), { recursive: true });
  const copia = await rodar(['publicar', 'copia'], ctx.env);
  assert.deepEqual([copia.codigo, copia.json.codigo, copia.json.dados.anterior_existe, copia.json.dados.nome], [2, 'PUBLICAR_PASTA_MUDOU', true, NOME], copia.saida);
  assert.equal((await rodar(['publicar', 'copia', '--por-cima'], ctx.env)).json.dados.versao, 3);
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_ENDERECO_JA_EM_USO', 'a original não é mais dona');
  fs.renameSync(path.join(sites, 'copia'), path.join(sites, 'movido'));
  const movido = await rodar(['publicar', 'movido'], ctx.env);
  assert.deepEqual([movido.json.codigo, movido.json.dados.anterior_existe], ['PUBLICAR_PASTA_MUDOU', false]);
  assert.equal((await rodar(['publicar', 'movido', '--por-cima'], ctx.env)).json.dados.versao, 4);
  assert.equal((await rodar(['publicar', 'movido'], ctx.env)).json.dados.versao, 5, 'depois da vez com --por-cima, não pede mais');
});

test('4e. quem publicou antes do registro de dono: no-ar.json que bate com o que está no ar vale uma vez', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  ctx.servico.estado.publicados.push({ slug: NOME, versao: 1, zip: Buffer.from('publicado antes do registro') });
  fs.writeFileSync(path.join(pastaDoSite(ctx), 'no-ar.json'), JSON.stringify({ nome: NOME, versao: 1 }));
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao], ['PUBLICADO', 2], r.saida);
  fs.writeFileSync(path.join(ctx.ferr, 'publicar', 'donos.json'), '{}');
  fs.writeFileSync(path.join(pastaDoSite(ctx), 'no-ar.json'), JSON.stringify({ nome: NOME, versao: 1 }));
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_ENDERECO_JA_EM_USO', 'no-ar.json que não bate não prova nada');
});

test('5. PARTE_EM_ANDAMENTO se reenvia; pedidos de espera do painel viram PUBLICAR_ESPERE_UM_POUCO', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  e.parteEmAndamento.add(0);
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'PUBLICADO'], r.saida);
  assert.equal(e.tentativasDaParte.get(0), 2);
  for (const [status, codigoServico] of [[429, 'ADICIONAR_ESPERE'], [429, 'CONFERIR_ESPERE'], [409, 'PARTE_EM_ANDAMENTO']]) {
    e.erroAoAbrir = { status, codigo: codigoServico };
    const espera = await ctx.publicar();
    assert.deepEqual([espera.codigo, espera.json.codigo], [1, 'PUBLICAR_ESPERE_UM_POUCO'], codigoServico);
  }
});

test('6. aviso de arquivo sem uso compara o nome inteiro', () => {
  assert.equal(citaNome('<img src="assets/data.png">', 'a.png'), false);
  assert.equal(citaNome('<img src="assets/a.png">', 'a.png'), true);
  assert.equal(citaNome("url('a.png?v=2')", 'a.png'), true);
  assert.equal(citaNome('<img src="a.png.bak">', 'a.png'), false);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-citados-'));
  try {
    fs.mkdirSync(path.join(pasta, 'assets'));
    fs.writeFileSync(path.join(pasta, 'index.html'), '<img src="assets/data.png">');
    fs.writeFileSync(path.join(pasta, 'assets', 'data.png'), 'x');
    fs.writeFileSync(path.join(pasta, 'assets', 'a.png'), 'x');
    assert.deepEqual(arquivosNaoCitados(pasta, ['index.html', 'assets/a.png', 'assets/data.png']), ['assets/a.png']);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

// autonom-ia/site-estudio#19: depois de o painel aceitar abrir o envio, o registro pendente fica (o
// concluir pode ter publicado mesmo com erro); no-ar.json guarda o nome que a pasta usa.
const registroDaPasta = (ctx) => {
  const arquivo = path.join(ctx.ferr, 'publicar', 'donos.json');
  if (!fs.existsSync(arquivo)) return null;
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'))[fs.realpathSync.native(pastaDoSite(ctx))] ?? null;
};
const novoConteudo = (ctx, titulo) => escrever(ctx, 'site/index.html', `<title>Meu site</title><h1>${titulo}</h1><img src="assets/foto.txt">`);

test('7a. concluir publica e responde com erro fora da lista: o pendente fica, e a próxima publicação segue', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  e.erroAoConcluir = { status: 500, codigo: 'FALHA_QUE_NINGUEM_LISTOU' };
  novoConteudo(ctx, 'Segunda');
  const falhou = await ctx.publicar();
  assert.equal(falhou.json.ok, false, falhou.saida);
  assert.equal(e.noAr.get(NOME), 2, 'o painel publicou mesmo assim');
  assert.equal(registroDaPasta(ctx)[NOME].pendente, true, 'o registro não foi desfeito');
  e.erroAoConcluir = null;
  novoConteudo(ctx, 'Terceira');
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao], ['PUBLICADO', 3], r.saida);
});

test('7b. concluir publica e a resposta vem estranha (sem endereço que sirva): a próxima publicação segue', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  e.enderecoDoSite = 'javascript:alert(1)';
  novoConteudo(ctx, 'Segunda');
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_RESPOSTA_ESTRANHA');
  assert.equal(e.noAr.get(NOME), 2);
  e.enderecoDoSite = null;
  novoConteudo(ctx, 'Terceira');
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao], ['PUBLICADO', 3], r.saida);
});

test('7c. recusa do painel ao abrir o envio desfaz o registro: nada foi enviado', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  ctx.servico.estado.erroAoAbrir = { status: 409, codigo: 'LIMITE_DE_SITES' };
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICAR_LIMITE_DE_SITES');
  assert.equal(registroDaPasta(ctx), null);
  assert.equal(fs.existsSync(path.join(pastaDoSite(ctx), 'no-ar.json')), false);
});

test('7d. o painel devolve outro nome no concluir: no-ar.json guarda o nome que esta pasta usa, e a próxima vai ao mesmo endereço', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  e.slugNaResposta = 'outro-nome';
  assert.equal((await ctx.publicar()).json.codigo, 'PUBLICADO');
  assert.equal(lerNoAr(ctx).nome, NOME);
  e.slugNaResposta = null;
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao, e.publicados.map((p) => p.slug)], ['PUBLICADO', 2, [NOME, NOME]], r.saida);
});

const semEm = (registro) => Object.fromEntries(Object.entries(registro).filter(([chave]) => chave !== 'em'));

test('7e. queda de conexão ao abrir o envio: o registro e o no-ar.json voltam exatamente ao que eram', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  assert.equal((await ctx.publicar()).json.dados.versao, 1);
  const lembreteAntes = lerNoAr(ctx);
  assert.deepEqual(semEm(registroDaPasta(ctx)[NOME]), { versao: 1 });
  e.abrirCai = true;
  novoConteudo(ctx, 'Segunda');
  const r = await ctx.publicar();
  assert.equal(r.json.codigo, 'PUBLICAR_SEM_CONEXAO', r.saida);
  assert.equal(e.aberturas, 2, 'o pedido de abrir chegou');
  assert.deepEqual(semEm(registroDaPasta(ctx)[NOME]), { versao: 1 }, 'sem pendente');
  assert.deepEqual(lerNoAr(ctx), lembreteAntes);
});

test('7f. --voltar com a resposta perdida: o painel voltou, e a próxima publicação segue sem pedir --por-cima', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  for (const titulo of ['Um', 'Dois', 'Três']) {
    novoConteudo(ctx, titulo);
    assert.equal((await ctx.publicar()).json.codigo, 'PUBLICADO');
  }
  e.voltarCai = true;
  assert.equal((await ctx.publicar('--voltar', '2')).json.codigo, 'PUBLICAR_SEM_CONEXAO');
  assert.equal(e.noAr.get(NOME), 2, 'o painel voltou mesmo assim');
  novoConteudo(ctx, 'Quatro');
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao], ['PUBLICADO', 4], r.saida);
});

test('7g. --voltar sem número com a resposta perdida: vale a anterior; outra versão no ar pede --por-cima', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const e = ctx.servico.estado;
  for (const titulo of ['Um', 'Dois']) {
    novoConteudo(ctx, titulo);
    assert.equal((await ctx.publicar()).json.codigo, 'PUBLICADO');
  }
  e.voltarCai = true;
  assert.equal((await ctx.publicar('--voltar')).json.codigo, 'PUBLICAR_SEM_CONEXAO');
  assert.equal(e.noAr.get(NOME), 1);
  novoConteudo(ctx, 'Três');
  assert.deepEqual((await ctx.publicar()).json.dados.versao, 3);
  // pediu a 2 e a resposta se perdeu, mas o que está no ar é a 1 (outra pessoa voltou): não é desta pasta
  e.voltarCai = true;
  assert.equal((await ctx.publicar('--voltar', '2')).json.codigo, 'PUBLICAR_SEM_CONEXAO');
  e.noAr.set(NOME, 1);
  const r = await ctx.publicar();
  assert.deepEqual([r.json.codigo, r.json.dados.versao_no_ar], ['PUBLICAR_ENDERECO_JA_EM_USO', 1], r.saida);
});
