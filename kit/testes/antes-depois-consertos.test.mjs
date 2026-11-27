// Consertos do antes e depois trazidos do View Estúdio 1.2 (autonom-ia/view-estudio#4):
// - a troca de pasta nunca deixa o site sem ela: falha na entrada do novo (no Windows, arquivo aberto
//   em outro programa) devolve o atual; queda entre os dois nomes é desfeita ao abrir o site;
// - "antes" e "outro" guardam a versão vista em tentativa/ antes de voltar; uma volta que parou no meio
//   não guarda o site pela metade por cima dela; "depois" nessa situação devolve a versão vista inteira;
// - "antes" diz o que da comparação anterior apagou; ANTES_NAO_GUARDADO não manda desfazer de memória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { trocarPasta, recuperarSobras } from '../scripts/lib/antes-depois.mjs';

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESPACHANTE = path.join(KIT, 'scripts', 'estudio.mjs');
const MENSAGENS = JSON.parse(fs.readFileSync(path.join(KIT, 'mensagens.json'), 'utf8'));

function estudio(env, ...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
  return { codigo: r.status, json: JSON.parse(r.stdout.trim().split('\n').pop()) };
}

function escrever(arquivo, texto) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, texto);
}
const ler = (arquivo) => fs.readFileSync(arquivo, 'utf8');

function siteDeTeste(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-antes-consertos-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const pasta = path.join(base, 'sites', 'loja');
  const env = { ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') };
  const arq = {
    pasta,
    site: path.join(pasta, 'site'),
    css: path.join(pasta, 'site', 'assets', 'site.css'),
    parte: path.join(pasta, '_gerador', 'secoes', 'topo.mjs'),
    ad: path.join(pasta, 'revisao', 'antes-depois'),
  };
  escrever(path.join(arq.site, 'index.html'), '<!doctype html><title>Loja</title><h1>Loja</h1>');
  escrever(arq.css, 'body{background:#123}');
  escrever(arq.parte, "export default 'letra reta';");
  return { env, arq };
}
const mudar = (arq, cor) => {
  fs.writeFileSync(arq.css, `body{background:${cor}}`);
  fs.writeFileSync(arq.parte, `export default '${cor}';`);
};

test('troca: falha na entrada do novo devolve o atual inteiro e não deixa sobra', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-troca-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const origem = path.join(base, 'antes');
  const destino = path.join(base, 'site');
  escrever(path.join(origem, 'a.txt'), 'antes');
  escrever(path.join(destino, 'a.txt'), 'visto');
  const travado = (de, para) => {
    if (de.endsWith('.trocando')) throw Object.assign(new Error('arquivo aberto em outro programa'), { code: 'EPERM' });
    fs.renameSync(de, para);
  };
  assert.throws(() => trocarPasta(origem, destino, travado), { code: 'EPERM' });
  assert.equal(ler(path.join(destino, 'a.txt')), 'visto');
  assert.deepEqual(fs.readdirSync(base).sort(), ['antes', 'site']);
  trocarPasta(origem, destino);
  assert.equal(ler(path.join(destino, 'a.txt')), 'antes');
  assert.deepEqual(fs.readdirSync(base).sort(), ['antes', 'site']);
});

test('queda entre os dois nomes: abrir o site põe a pasta de volta, com aviso; o escolher termina a volta', (t) => {
  const { env, arq } = siteDeTeste(t);
  assert.equal(estudio(env, 'antes', 'loja').json.codigo, 'ANTES_GUARDADO');
  mudar(arq, '#f4ecdc');
  // o programa morreu depois de tirar site/ do lugar e antes de pôr o novo
  fs.renameSync(arq.site, `${arq.site}.descartando`);
  escrever(path.join(`${arq.site}.trocando`, 'index.html'), 'cópia montada pela metade');
  assert.deepEqual(recuperarSobras({ site: arq.site, gerador: path.join(arq.pasta, '_gerador') }, () => {}), ['site'], 'acha o que ficou fora');
  const r = estudio(env, 'escolher', 'loja', 'antes');
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'VOLTOU_COMO_ESTAVA'], JSON.stringify(r.json));
  assert.ok(r.json.avisos.some((a) => a.codigo === 'SITE_POSTO_DE_VOLTA'), JSON.stringify(r.json.avisos));
  assert.equal(ler(arq.css), 'body{background:#123}');
  assert.equal(ler(path.join(arq.ad, 'tentativa', 'site', 'assets', 'site.css')), 'body{background:#f4ecdc}', 'a versão vista foi guardada');
  assert.deepEqual(fs.readdirSync(arq.pasta).filter((n) => n.includes('.trocando') || n.includes('.descartando')), []);
});

test('"outro" guarda a versão vista; a próxima substitui com aviso; "depois" apaga a tentativa', (t) => {
  const { env, arq } = siteDeTeste(t);
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  let r = estudio(env, 'escolher', 'loja', 'outro');
  assert.equal(r.json.codigo, 'PRONTO_PARA_OUTRO_CAMINHO');
  assert.equal(ler(path.join(arq.ad, 'tentativa', '_gerador', 'secoes', 'topo.mjs')), "export default '#aaa';");
  assert.equal(r.json.arquivos.tentativa.endsWith('tentativa'), true);
  mudar(arq, '#bbb');
  r = estudio(env, 'escolher', 'loja', 'outro');
  assert.ok(r.json.avisos.some((a) => a.codigo === 'TENTATIVA_SUBSTITUIDA'));
  assert.equal(ler(path.join(arq.ad, 'tentativa', 'site', 'assets', 'site.css')), 'body{background:#bbb}');
  mudar(arq, '#ccc');
  r = estudio(env, 'escolher', 'loja', 'depois');
  assert.equal(r.json.codigo, 'FICOU_O_DEPOIS');
  assert.equal(fs.existsSync(path.join(arq.ad, 'tentativa')), false);
  assert.equal(ler(arq.css), 'body{background:#ccc}');
});

test('volta pendente: não guarda o site pela metade por cima da versão vista; "depois" a devolve inteira', (t) => {
  const { env, arq } = siteDeTeste(t);
  estudio(env, 'antes', 'loja');
  mudar(arq, '#f4ecdc');
  // o que um "escolher antes" que falhou no _gerador/ deixa: versão vista guardada, site/ já no antes,
  // _gerador/ ainda na versão vista e a volta marcada como pendente
  const tentativa = path.join(arq.ad, 'tentativa');
  fs.cpSync(arq.site, path.join(tentativa, 'site'), { recursive: true });
  fs.cpSync(path.join(arq.pasta, '_gerador'), path.join(tentativa, '_gerador'), { recursive: true });
  fs.writeFileSync(arq.css, 'body{background:#123}');
  fs.writeFileSync(path.join(arq.ad, 'estado.json'), JSON.stringify({ aberto: true, restauracao_pendente: true }));
  const r = estudio(env, 'escolher', 'loja', 'depois');
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.restauradas], [0, 'FICOU_O_DEPOIS', ['site', '_gerador']], JSON.stringify(r.json));
  assert.equal(ler(arq.css), 'body{background:#f4ecdc}', 'a versão vista voltou inteira');
  assert.equal(ler(arq.parte), "export default '#f4ecdc';");
});

test('volta pendente com "antes" de novo: termina a volta e a versão vista continua a de antes da falha', (t) => {
  const { env, arq } = siteDeTeste(t);
  estudio(env, 'antes', 'loja');
  mudar(arq, '#f4ecdc');
  const tentativa = path.join(arq.ad, 'tentativa');
  fs.cpSync(arq.site, path.join(tentativa, 'site'), { recursive: true });
  fs.cpSync(path.join(arq.pasta, '_gerador'), path.join(tentativa, '_gerador'), { recursive: true });
  fs.writeFileSync(arq.css, 'body{background:#123}');
  fs.writeFileSync(path.join(arq.ad, 'estado.json'), JSON.stringify({ aberto: true, restauracao_pendente: true }));
  const r = estudio(env, 'escolher', 'loja', 'antes');
  assert.equal(r.json.codigo, 'VOLTOU_COMO_ESTAVA');
  assert.equal(ler(arq.parte), "export default 'letra reta';");
  assert.equal(ler(path.join(tentativa, 'site', 'assets', 'site.css')), 'body{background:#f4ecdc}', 'a metade não foi guardada por cima');
  assert.deepEqual(JSON.parse(ler(path.join(arq.ad, 'estado.json'))), { aberto: false, escolha: 'antes' });
});

test('"antes" diz o que da comparação anterior apagou; ANTES_NAO_GUARDADO não manda desfazer de memória', (t) => {
  const { env, arq } = siteDeTeste(t);
  assert.deepEqual(estudio(env, 'antes', 'loja').json.dados.apagados, []);
  mudar(arq, '#aaa');
  estudio(env, 'escolher', 'loja', 'antes');
  assert.deepEqual(estudio(env, 'antes', 'loja').json.dados.apagados, ['antes', 'tentativa']);
  assert.ok(!MENSAGENS.ANTES_NAO_GUARDADO.acao.startsWith('Desfaça'));
  assert.ok(MENSAGENS.ANTES_NAO_GUARDADO.acao.includes('Não desfaça de memória'));
  for (const codigo of ['RESTAURACAO_FALHOU', 'SITE_POSTO_DE_VOLTA', 'TENTATIVA_SUBSTITUIDA']) assert.ok(MENSAGENS[codigo]?.texto && MENSAGENS[codigo]?.acao, codigo);
});

// Pasta que o sistema não deixa apagar (no Mac e no Linux, sem permissão de escrita): faz a parte de
// dentro de uma troca concluída sobrar, como um arquivo aberto no Windows.
function travar(pasta) {
  const trava = path.join(pasta, 'trava');
  escrever(path.join(trava, 'aberto.txt'), 'em uso');
  fs.chmodSync(trava, 0o500);
  return trava;
}
const destravar = (pasta) => {
  for (const nome of fs.existsSync(pasta) ? fs.readdirSync(pasta) : []) {
    const trava = path.join(pasta, nome, 'trava');
    if (fs.existsSync(trava)) fs.chmodSync(trava, 0o700);
  }
};
const SEM_CHMOD = process.platform === 'win32' ? 'no Windows a permissão não trava a remoção' : false;

test('troca feita com a cópia velha presa: vale, devolve a sobra, e a tentativa seguinte copia a pasta no lugar, nunca a sobra', { skip: SEM_CHMOD }, (t) => {
  const { env, arq } = siteDeTeste(t);
  t.after(() => destravar(arq.pasta));
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  travar(arq.site);
  const r = estudio(env, 'escolher', 'loja', 'antes');
  assert.deepEqual([r.codigo, r.json.codigo], [0, 'VOLTOU_COMO_ESTAVA'], JSON.stringify(r.json));
  assert.deepEqual(r.json.avisos.map((a) => a.codigo), ['SOBRA_DA_TROCA']);
  assert.ok(r.json.avisos[0].dados.sobra.endsWith('site.descartando'));
  assert.equal(ler(arq.css), 'body{background:#123}', 'a troca valeu');
  // A pessoa fechou o programa (a trava sai), mas a sobra continua ao lado: é a versão #aaa, e o site
  // no lugar é o antes. Uma tentativa nova guarda o que está no lugar, e a troca apaga a sobra.
  destravar(arq.pasta);
  assert.ok(fs.existsSync(`${arq.site}.descartando`));
  estudio(env, 'antes', 'loja', '--de-novo');
  mudar(arq, '#bbb');
  assert.equal(estudio(env, 'escolher', 'loja', 'outro').json.codigo, 'PRONTO_PARA_OUTRO_CAMINHO');
  assert.equal(ler(path.join(arq.ad, 'tentativa', 'site', 'assets', 'site.css')), 'body{background:#bbb}');
  assert.equal(fs.existsSync(`${arq.site}.descartando`), false);
});

test('"antes --de-novo" com volta parada no meio reprova e não apaga a versão vista', (t) => {
  const { env, arq } = siteDeTeste(t);
  estudio(env, 'antes', 'loja');
  mudar(arq, '#f4ecdc');
  const tentativa = path.join(arq.ad, 'tentativa');
  fs.cpSync(arq.site, path.join(tentativa, 'site'), { recursive: true });
  fs.writeFileSync(arq.css, 'body{background:#123}');
  fs.writeFileSync(path.join(arq.ad, 'estado.json'), JSON.stringify({ aberto: true, restauracao_pendente: true }));
  const r = estudio(env, 'antes', 'loja', '--de-novo');
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.restauracao_pendente], [2, 'ANTES_EM_ABERTO', true], JSON.stringify(r.json));
  assert.equal(ler(path.join(tentativa, 'site', 'assets', 'site.css')), 'body{background:#f4ecdc}');
});

test('"antes" troca a comparação inteira de uma vez e não deixa nada ao lado', (t) => {
  const { env, arq } = siteDeTeste(t);
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  const r = estudio(env, 'antes', 'loja', '--de-novo');
  assert.equal(r.json.codigo, 'ANTES_GUARDADO');
  assert.equal(ler(path.join(arq.ad, 'antes', 'assets', 'site.css')), 'body{background:#aaa}');
  assert.equal(ler(path.join(arq.pasta, 'revisao', 'antes-gerador', 'secoes', 'topo.mjs')), "export default '#aaa';");
  assert.deepEqual(JSON.parse(ler(path.join(arq.ad, 'estado.json'))), { aberto: true, gerador: true });
  const soltos = fs.readdirSync(path.join(arq.pasta, 'revisao')).filter((n) => n.includes('.'));
  assert.deepEqual(soltos, []);
});

test('antes guardado sem _gerador/: voltar ao antes tira o _gerador/ que apareceu depois, e ele fica na tentativa', (t) => {
  const { env, arq } = siteDeTeste(t);
  const gerador = path.join(arq.pasta, '_gerador');
  fs.rmSync(gerador, { recursive: true });
  assert.equal(estudio(env, 'antes', 'loja').json.dados.gerador, false);
  escrever(arq.parte, "export default 'novo';");
  fs.writeFileSync(arq.css, 'body{background:#aaa}');
  let r = estudio(env, 'escolher', 'loja', 'outro');
  assert.deepEqual([r.json.codigo, r.json.dados.restauradas], ['PRONTO_PARA_OUTRO_CAMINHO', ['site', '_gerador']], JSON.stringify(r.json));
  assert.equal(fs.existsSync(gerador), false);
  assert.equal(ler(path.join(arq.ad, 'tentativa', '_gerador', 'secoes', 'topo.mjs')), "export default 'novo';");
  assert.equal(JSON.parse(ler(path.join(arq.ad, 'estado.json'))).gerador, false, '"outro" mantém a anotação');
  escrever(arq.parte, "export default 'de novo';");
  r = estudio(env, 'escolher', 'loja', 'antes');
  assert.equal(r.json.codigo, 'VOLTOU_COMO_ESTAVA');
  assert.equal(fs.existsSync(gerador), false);
});

test('"antes" que não consegue trocar reprova com código, o site não muda e a comparação anterior continua valendo', { skip: SEM_CHMOD }, (t) => {
  const { env, arq } = siteDeTeste(t);
  const revisao = path.join(arq.pasta, 'revisao');
  t.after(() => fs.existsSync(revisao) && fs.chmodSync(revisao, 0o700));
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  fs.chmodSync(revisao, 0o500);
  const r = estudio(env, 'antes', 'loja', '--de-novo');
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.pergunta_anterior_em_aberto], [2, 'ANTES_NAO_TROCADO', true], JSON.stringify(r.json));
  assert.ok(r.json.dados.erro);
  assert.equal(ler(arq.css), 'body{background:#aaa}', 'o site não mudou');
  fs.chmodSync(revisao, 0o700);
  assert.equal(estudio(env, 'escolher', 'loja', 'antes').json.codigo, 'VOLTOU_COMO_ESTAVA', 'a pergunta anterior ainda responde');
  assert.equal(ler(arq.css), 'body{background:#123}');
  assert.equal(ler(arq.parte), "export default 'letra reta';");
  assert.equal(estudio(env, 'antes', 'loja').json.codigo, 'ANTES_GUARDADO', 'rodar de novo termina');
});

test('"antes" que troca o gerador e falha na comparação devolve o gerador anterior: o antes de uma nunca volta com o gerador da outra', { skip: SEM_CHMOD }, (t) => {
  const { env, arq } = siteDeTeste(t);
  const revisao = path.join(arq.pasta, 'revisao');
  const preso = `${arq.ad}.descartando`;
  t.after(() => fs.existsSync(preso) && fs.chmodSync(preso, 0o700));
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  escrever(path.join(preso, 'aberto.txt'), 'em uso');
  fs.chmodSync(preso, 0o500);
  const r = estudio(env, 'antes', 'loja', '--de-novo');
  assert.deepEqual([r.codigo, r.json.codigo, r.json.dados.pergunta_anterior_em_aberto], [2, 'ANTES_NAO_TROCADO', true], JSON.stringify(r.json));
  assert.equal(ler(path.join(revisao, 'antes-gerador', 'secoes', 'topo.mjs')), "export default 'letra reta';", 'o gerador guardado voltou');
  assert.equal(ler(path.join(arq.ad, 'antes', 'assets', 'site.css')), 'body{background:#123}', 'o antes não mudou');
  fs.chmodSync(preso, 0o700);
  fs.rmSync(preso, { recursive: true });
  assert.deepEqual(fs.readdirSync(revisao).filter((n) => n.includes('.')), [], 'nada ficou ao lado');
  assert.equal(estudio(env, 'escolher', 'loja', 'antes').json.codigo, 'VOLTOU_COMO_ESTAVA');
  assert.equal(ler(arq.css), 'body{background:#123}');
  assert.equal(ler(arq.parte), "export default 'letra reta';", 'o gerador que voltou é o do mesmo antes');
});

test('"antes" que não consegue trocar depois de a pessoa já ter escolhido diz que não há pergunta em aberto', { skip: SEM_CHMOD }, (t) => {
  const { env, arq } = siteDeTeste(t);
  const revisao = path.join(arq.pasta, 'revisao');
  t.after(() => fs.existsSync(revisao) && fs.chmodSync(revisao, 0o700));
  estudio(env, 'antes', 'loja');
  mudar(arq, '#aaa');
  assert.equal(estudio(env, 'escolher', 'loja', 'depois').json.codigo, 'FICOU_O_DEPOIS');
  fs.chmodSync(revisao, 0o500);
  const r = estudio(env, 'antes', 'loja');
  fs.chmodSync(revisao, 0o700);
  assert.deepEqual([r.json.codigo, r.json.dados.pergunta_anterior_em_aberto], ['ANTES_NAO_TROCADO', false], JSON.stringify(r.json));
});
