// Comando publicar contra um serviço falso (servico-falso.mjs) que segue o contrato HTTP de
// sites.autonomia.site: login por código, envio em partes com queda e retomada, chave recusada,
// voltar versão, tradução dos erros, permissões 0600 e a chave fora da saída.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { subirServicoFalso } from './servico-falso.mjs';
import { SERVICO, configuracao, enderecoDeTesteAceito, CODIGOS_TRADUZIDOS } from '../scripts/lib/publicar-servico.mjs';
import { arquivoChave, arquivoPedido, gravarChave } from '../scripts/lib/publicar-guarda.mjs';
import { KitErro } from '../scripts/lib/saida.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const MENSAGENS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'kit', 'mensagens.json'), 'utf8'));
const NO_WINDOWS = process.platform === 'win32';
const modo = (arquivo) => fs.statSync(arquivo).mode & 0o777;

function rodar(args, env) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [DESPACHANTE, ...args], { env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
    let stdout = '';
    let stderr = '';
    filho.stdout.on('data', (d) => { stdout += d; });
    filho.stderr.on('data', (d) => { stderr += d; });
    filho.on('error', reject);
    filho.on('close', (codigo) => {
      const linhas = stdout.trim().split('\n');
      resolve({ codigo, json: JSON.parse(linhas[linhas.length - 1]), saida: stdout + stderr });
    });
  });
}

// Um site de verdade (index + foto incompressível de ~4 KB): com parte de 1000 bytes, vira 5+ partes.
async function preparar(t, opcoes) {
  const servico = await subirServicoFalso(opcoes);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-publicar-'));
  const site = path.join(base, 'sites', 'meu-site', 'site');
  fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<title>Meu site</title><img src="assets/foto.txt">');
  fs.writeFileSync(path.join(site, 'assets', 'foto.txt'), crypto.randomBytes(3000).toString('base64'));
  const ferr = path.join(base, 'ferr');
  const env = {
    ESTUDIO_PUBLICAR_URL: servico.base, ESTUDIO_FERRAMENTAS: ferr, ESTUDIO_SITES: path.join(base, 'sites'),
    ESTUDIO_PUBLICAR_INTERVALO_MS: '20', ESTUDIO_PUBLICAR_PRAZO_MS: '300',
  };
  t.after(async () => {
    await servico.fechar();
    fs.rmSync(base, { recursive: true, force: true });
  });
  return { servico, ferr, env, publicar: (...extra) => rodar(['publicar', 'meu-site', ...extra], env) };
}

// Chave aceita pelo serviço falso, gravada como o login gravaria.
function darChave(ctx) {
  ctx.servico.estado.chaves.add('se_pub_chave-de-teste');
  gravarChave(ctx.servico.base, 'se_pub_chave-de-teste', '', ctx.ferr);
}

test('endereço do serviço: produção fixa; o de teste só aceita http://127.0.0.1:<porta>', () => {
  for (const bom of ['http://127.0.0.1:8080', 'http://127.0.0.1:8080/']) assert.equal(enderecoDeTesteAceito(bom), true, bom);
  const ruins = ['https://127.0.0.1:8080', 'http://localhost:8080', 'http://127.0.0.1', 'http://127.0.0.1:8080/x',
    'http://a@127.0.0.1:8080', 'http://127.0.0.1.exemplo.com:80', 'http://127.0.0.1:8080/?x=1', SERVICO, 'nada'];
  for (const ruim of ruins) assert.equal(enderecoDeTesteAceito(ruim), false, ruim);
  const producao = configuracao({ ESTUDIO_PUBLICAR_PRAZO_MS: '1' });
  assert.deepEqual([producao.base, producao.teste, producao.tempos.prazoMs], ['https://sites.autonomia.site', false, 90000]);
  assert.throws(() => configuracao({ ESTUDIO_PUBLICAR_URL: 'https://outro.exemplo.com' }),
    (e) => e instanceof KitErro && e.codigo === 'PUBLICAR_ENDERECO_DE_TESTE_INVALIDO');
  assert.equal(configuracao({ ESTUDIO_PUBLICAR_URL: 'http://127.0.0.1:9/' }).base, 'http://127.0.0.1:9');
});

test('login pendente, continuação do mesmo pedido, aprovação e envio em partes com queda e retomada', async (t) => {
  const ctx = await preparar(t);
  const { servico } = ctx;
  servico.estado.derrubarParte.add(1);
  const r1 = await ctx.publicar();
  assert.equal(r1.codigo, 1);
  assert.equal(r1.json.codigo, 'PUBLICAR_AGUARDANDO_LOGIN');
  assert.deepEqual([r1.json.dados.codigo_curto, r1.json.dados.endereco, r1.json.dados.pedido_novo], ['BCDF-GHJK', `${servico.base}/estudio/ligar`, true]);
  const pedido = JSON.parse(fs.readFileSync(arquivoPedido(ctx.ferr), 'utf8'));
  assert.ok(!r1.saida.includes(pedido.codigo_dispositivo), 'o código de dispositivo não sai');
  if (!NO_WINDOWS) assert.equal(modo(arquivoPedido(ctx.ferr)), 0o600);

  const r2 = await ctx.publicar();
  assert.equal(r2.json.codigo, 'PUBLICAR_AGUARDANDO_LOGIN');
  assert.equal(r2.json.dados.pedido_novo, false);
  assert.equal(servico.estado.iniciados, 1, 'a segunda chamada continua o mesmo pedido');
  assert.ok(servico.estado.consultas >= 2);

  servico.aprovar();
  const r3 = await ctx.publicar();
  assert.equal(r3.codigo, 0, r3.saida);
  assert.equal(r3.json.codigo, 'PUBLICADO');
  assert.deepEqual([r3.json.dados.versao, r3.json.dados.endereco], [1, `${servico.base}/no-ar/meu-site/`]);
  const chave = JSON.parse(fs.readFileSync(arquivoChave(ctx.ferr), 'utf8')).chave;
  assert.ok(chave.startsWith('se_pub_'));
  assert.ok(!r3.saida.includes(chave) && !r3.saida.includes(chave.slice(7)), 'a chave nunca aparece na saída');
  assert.ok(!JSON.stringify(r3.json.dados).includes('se_pub_'));
  assert.equal(fs.existsSync(arquivoPedido(ctx.ferr)), false, 'pedido apagado depois da aprovação');
  if (!NO_WINDOWS) assert.equal(modo(arquivoChave(ctx.ferr)), 0o600);
  assert.ok(arquivoChave(ctx.ferr).startsWith(ctx.ferr + path.sep), 'a chave fica dentro de .ferramentas/');

  const [publicado] = servico.estado.publicados;
  assert.ok(publicado.zip.length > 3000, 'o pacote foi em várias partes');
  assert.equal(servico.estado.tentativasDaParte.get(1), 2, 'a parte derrubada foi reenviada uma vez');
  assert.ok(servico.estado.autorizacoes.every((a) => a === `Bearer ${chave}`));

  const r4 = await ctx.publicar();
  assert.deepEqual([r4.json.codigo, r4.json.dados.versao, servico.estado.iniciados], ['PUBLICADO', 2, 1]);
});

test('chave recusada (401) é apagada e o login recomeça', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  ctx.servico.revogarTudo();
  const r = await ctx.publicar();
  assert.equal(r.json.codigo, 'PUBLICAR_AGUARDANDO_LOGIN');
  assert.equal(r.json.dados.chave_recusada, true);
  assert.equal(fs.existsSync(arquivoChave(ctx.ferr)), false);
  assert.equal(fs.existsSync(arquivoPedido(ctx.ferr)), true);
  assert.equal(ctx.servico.estado.publicados.length, 0);
});

test('login recusado no navegador apaga o pedido', async (t) => {
  const ctx = await preparar(t);
  await ctx.publicar();
  ctx.servico.recusar();
  const r = await ctx.publicar();
  assert.equal(r.json.codigo, 'PUBLICAR_LOGIN_RECUSADO');
  assert.equal(fs.existsSync(arquivoPedido(ctx.ferr)), false);
});

test('voltar: versão escolhida, a anterior (sem número) e versão que não existe', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const dois = await ctx.publicar('--voltar', '2');
  assert.deepEqual([dois.codigo, dois.json.codigo, dois.json.dados.versao], [0, 'PUBLICAR_VERSAO_VOLTOU', 2]);
  assert.equal((await ctx.publicar('--voltar')).json.codigo, 'PUBLICAR_VERSAO_VOLTOU');
  assert.equal((await rodar(['publicar', '--voltar', 'meu-site'], ctx.env)).json.codigo, 'PUBLICAR_VERSAO_VOLTOU');
  assert.deepEqual(ctx.servico.estado.voltas, [{ versao: 2 }, {}, {}]);
  const sumiu = await ctx.publicar('--voltar', '99');
  assert.equal(sumiu.json.codigo, 'PUBLICAR_VERSAO_INEXISTENTE');
  assert.equal(ctx.servico.estado.publicados.length, 0, 'voltar não envia o site');
});

test('códigos de erro do serviço viram frase simples do estúdio', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  const casos = [
    [403, 'SITE_DE_OUTRA_PESSOA', 'PUBLICAR_SITE_DE_OUTRA_PESSOA'],
    [409, 'LIMITE_DE_SITES', 'PUBLICAR_LIMITE_DE_SITES'],
    [413, 'SITE_GRANDE_DEMAIS', 'PUBLICAR_SITE_GRANDE_DEMAIS'],
    [429, 'LIMITE_DO_DIA', 'PUBLICAR_LIMITE_DO_DIA'],
    [503, 'PUBLICACAO_DESLIGADA', 'PUBLICAR_DESLIGADA'],
    [422, 'PACOTE_ATALHO', 'PUBLICAR_PACOTE_RECUSADO'],
    [418, 'NOVO_CODIGO', 'PUBLICAR_RECUSADO'],
  ];
  for (const [status, codigoServico, codigo] of casos) {
    ctx.servico.estado.erroAoAbrir = { status, codigo: codigoServico };
    const r = await ctx.publicar();
    assert.equal(r.codigo, 1, codigoServico);
    assert.equal(r.json.codigo, codigo, codigoServico);
    assert.equal(r.json.resumo, MENSAGENS[codigo].texto);
    assert.ok(!r.json.resumo.includes(codigoServico));
  }
  assert.equal(ctx.servico.estado.publicados.length, 0);
});

test('site no ar sem cadeado ainda: PUBLICADO_CERTIFICADO_PENDENTE; sem serviço: PUBLICAR_SEM_CONEXAO', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  ctx.servico.estado.enderecoDoSite = `${ctx.servico.base}/fora/`;
  const r = await ctx.publicar();
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'PUBLICADO_CERTIFICADO_PENDENTE']);
  const fechado = await subirServicoFalso();
  await fechado.fechar();
  const sem = await rodar(['publicar', 'meu-site'], { ...ctx.env, ESTUDIO_PUBLICAR_URL: fechado.base });
  assert.equal(sem.json.codigo, 'PUBLICAR_SEM_CONEXAO');
});

test('--sair esquece a chave e o pedido deste computador', async (t) => {
  const ctx = await preparar(t);
  darChave(ctx);
  fs.writeFileSync(arquivoPedido(ctx.ferr), '{}');
  const r = await rodar(['publicar', '--sair'], ctx.env);
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.tinha_acesso], [0, 'PUBLICAR_SAIU', true]);
  assert.equal(fs.existsSync(arquivoChave(ctx.ferr)), false);
  assert.equal(fs.existsSync(arquivoPedido(ctx.ferr)), false);
});

test('mensagens da publicação existem, para leigo, e .gitignore cobre .ferramentas/', () => {
  const novos = ['PUBLICADO', 'PUBLICADO_CERTIFICADO_PENDENTE', 'PUBLICAR_AGUARDANDO_LOGIN', 'PUBLICAR_VERSAO_VOLTOU', 'PUBLICAR_SAIU',
    'PUBLICAR_SEM_CONEXAO', 'PUBLICAR_LOGIN_RECUSADO', 'PUBLICAR_MUITAS_TENTATIVAS', 'PUBLICAR_ENDERECO_DE_TESTE_INVALIDO',
    'PUBLICAR_RESPOSTA_ESTRANHA', ...CODIGOS_TRADUZIDOS];
  const proibidas = ['pasta', 'comando', 'zip', 'json', 'nota', 'rodada', 'preflight'];
  for (const codigo of novos) {
    assert.ok(MENSAGENS[codigo], `${codigo} falta em mensagens.json`);
    for (const campo of ['texto', 'acao']) {
      const texto = MENSAGENS[codigo][campo].toLowerCase();
      for (const p of proibidas) assert.ok(!texto.includes(p), `${codigo}.${campo} tem "${p}"`);
    }
  }
  const linhas = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  assert.ok(linhas.includes('.ferramentas/'));
});
