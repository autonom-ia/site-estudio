// Antes e depois sem perder o original: o "antes" guarda site/ e _gerador/, não troca um antes em
// aberto, e o "escolher" aplica a resposta da pessoa (depois, voltar, outro caminho) sem memória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DESPACHANTE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'estudio.mjs');

function estudio(env, ...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
  return { codigo: r.status, json: JSON.parse(r.stdout.trim().split('\n').pop()) };
}

function escrever(arquivo, texto) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, texto);
}

const ler = (arquivo) => fs.readFileSync(arquivo, 'utf8');

// Um site montado, com uma parte no _gerador/ e um estilo em site/assets/.
function siteDeTeste() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-antes-'));
  const env = { ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_FERRAMENTAS: path.join(base, 'ferr') };
  const pasta = path.join(base, 'sites', 'loja');
  const arq = {
    css: path.join(pasta, 'site', 'assets', 'site.css'),
    parte: path.join(pasta, '_gerador', 'secoes', 'topo.mjs'),
    nova: path.join(pasta, '_gerador', 'secoes', 'faixa.mjs'),
    mudancas: path.join(pasta, 'revisao', 'antes-depois', 'mudancas.json'),
  };
  escrever(path.join(pasta, 'site', 'index.html'), '<!doctype html><title>Loja</title><h1>Loja</h1>');
  escrever(arq.css, 'body{background:#123}');
  escrever(arq.parte, "export default 'letra reta';");
  return { base, env, arq };
}

// Simula a tentativa do assistente: muda o estilo e a parte, e cria uma parte nova.
function tentativa(arq, cor, letra) {
  fs.writeFileSync(arq.css, `body{background:${cor}}`);
  fs.writeFileSync(arq.parte, `export default '${letra}';`);
  fs.writeFileSync(arq.nova, "export default 'faixa';");
}

test('antes: guarda o _gerador/ e não troca um antes que a pessoa ainda não resolveu', () => {
  const t = siteDeTeste();
  try {
    let r = estudio(t.env, 'antes', 'loja');
    assert.equal(r.json.codigo, 'ANTES_GUARDADO');
    assert.equal(r.json.dados.gerador, true);
    tentativa(t.arq, '#f4ecdc', 'letra redonda');

    // "Outro caminho" mal seguido: rodar o antes de novo trocaria o original pela tentativa recusada
    r = estudio(t.env, 'antes', 'loja');
    assert.equal(r.codigo, 2);
    assert.equal(r.json.codigo, 'ANTES_EM_ABERTO');
    const guardado = path.join(t.base, 'sites', 'loja', 'revisao', 'antes-depois', 'antes', 'assets', 'site.css');
    assert.equal(ler(guardado), 'body{background:#123}');

    // --de-novo troca de propósito (a ordem dos argumentos não importa)
    r = estudio(t.env, 'antes', '--de-novo', 'loja');
    assert.equal(r.codigo, 0, JSON.stringify(r.json));
    assert.equal(ler(guardado), 'body{background:#f4ecdc}');
  } finally {
    fs.rmSync(t.base, { recursive: true, force: true });
  }
});

test('escolher outro: volta ao original, mantém o antes em aberto e a próxima comparação parte dele', () => {
  const t = siteDeTeste();
  try {
    estudio(t.env, 'antes', 'loja');
    tentativa(t.arq, '#f4ecdc', 'letra redonda');
    fs.writeFileSync(t.arq.mudancas, JSON.stringify({ pedido: 'mais caseiro', mudancas: [{ titulo: 'Fundo creme' }, { titulo: 'Letra redonda' }] }));

    let r = estudio(t.env, 'escolher', 'loja', 'outro');
    assert.equal(r.codigo, 0, JSON.stringify(r.json));
    assert.equal(r.json.codigo, 'PRONTO_PARA_OUTRO_CAMINHO');
    assert.equal(ler(t.arq.css), 'body{background:#123}');
    assert.equal(ler(t.arq.parte), "export default 'letra reta';");
    assert.equal(fs.existsSync(t.arq.nova), false, 'a parte criada na tentativa recusada sai');
    assert.deepEqual(JSON.parse(ler(t.arq.mudancas)), { pedido: 'mais caseiro', mudancas: [] });
    assert.equal(estudio(t.env, 'antes', 'loja').json.codigo, 'ANTES_EM_ABERTO');

    // segunda tentativa e "Voltar como estava": volta ao original, não à primeira tentativa
    tentativa(t.arq, '#000', 'letra fina');
    r = estudio(t.env, 'escolher', 'loja', 'antes');
    assert.equal(r.json.codigo, 'VOLTOU_COMO_ESTAVA');
    assert.equal(r.json.dados.gerador_restaurado, true);
    assert.equal(ler(t.arq.css), 'body{background:#123}');
    assert.equal(ler(t.arq.parte), "export default 'letra reta';");

    // resolvido: não volta de novo, e o próximo pedido vago guarda um antes novo
    r = estudio(t.env, 'escolher', 'loja', 'antes');
    assert.equal(r.codigo, 2);
    assert.equal(r.json.codigo, 'ANTES_JA_RESOLVIDO');
    assert.equal(estudio(t.env, 'antes', 'loja').json.codigo, 'ANTES_GUARDADO');
  } finally {
    fs.rmSync(t.base, { recursive: true, force: true });
  }
});

test('escolher depois: fica a mudança; escolha inválida e sem antes guardado são recusadas', () => {
  const t = siteDeTeste();
  try {
    let r = estudio(t.env, 'escolher', 'loja', 'depois');
    assert.equal(r.json.codigo, 'ANTES_NAO_GUARDADO');
    estudio(t.env, 'antes', 'loja');
    tentativa(t.arq, '#f4ecdc', 'letra redonda');
    r = estudio(t.env, 'escolher', 'loja', 'talvez');
    assert.equal(r.codigo, 1);
    assert.equal(r.json.codigo, 'ARGUMENTO_INVALIDO');
    r = estudio(t.env, 'escolher', 'loja', 'depois');
    assert.equal(r.json.codigo, 'FICOU_O_DEPOIS');
    assert.equal(ler(t.arq.css), 'body{background:#f4ecdc}');
    assert.equal(ler(t.arq.parte), "export default 'letra redonda';");
    assert.equal(estudio(t.env, 'antes', 'loja').json.codigo, 'ANTES_GUARDADO');
  } finally {
    fs.rmSync(t.base, { recursive: true, force: true });
  }
});
