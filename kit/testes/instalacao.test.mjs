// Instalação numa entrada só: a ação "tudo" no Mac e no Windows, liberada nas permissões do
// estúdio, e o I-01 sem pergunta (a caixinha do "tudo" é o sim da pessoa). Sem rede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, ...rel.split('/')), 'utf8');
const lerJson = (rel) => JSON.parse(ler(rel));

test('instalação numa entrada só: "tudo" no Mac e no Windows, liberado nas permissões do estúdio', () => {
  const sh = ler('instalar/instalar.sh');
  assert.ok(sh.includes('  tudo) acao_tudo ;;'));
  assert.ok(sh.includes('"acoes":["tudo",'));
  const ps1 = ler('instalar/instalar.ps1');
  assert.ok(ps1.includes("'tudo' { Invoke-AcaoTudo }"));
  assert.ok(ps1.includes("acoes = @('tudo',"));
  const permitidos = lerJson('.claude/settings.json').permissions.allow;
  for (const p of [
    'Bash(bash instalar/instalar.sh tudo:*)',
    'Bash(powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar/instalar.ps1 tudo:*)',
    'PowerShell(powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar/instalar.ps1 tudo *)',
    'Bash(./estudio:*)',
    'WebFetch',
    'WebSearch',
  ]) {
    assert.ok(permitidos.includes(p), p);
  }
  // o que apaga ou move fica pedindo licença
  for (const p of permitidos) for (const perigo of ['desinstalar', 'mudar-pasta', 'rm ']) assert.equal(p.includes(perigo), false, p);
  // o I-01 não é pergunta: a caixinha do "tudo" é o sim da pessoa
  const i01 = lerJson('instalar/mensagens.json').textos['I-01'];
  assert.equal(i01.opcoes, undefined);
  assert.ok(i01.depois.includes('"tudo"'));
  const skill = ler('.claude/skills/instalar-estudio/SKILL.md');
  assert.ok(skill.includes('rode `tudo`'));
});

test('instalador do Mac: ação desconhecida lista "tudo" (sem rede, sem instalar nada)', { skip: process.platform !== 'darwin' }, () => {
  assert.equal(spawnSync('bash', ['-n', path.join(RAIZ, 'instalar', 'instalar.sh')]).status, 0);
  const r = spawnSync('bash', [path.join(RAIZ, 'instalar', 'instalar.sh'), 'nao-existe'], { encoding: 'utf8' });
  const ultima = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(r.status, 1);
  assert.equal(ultima.codigo, 'ACAO_DESCONHECIDA');
  assert.equal(ultima.dados.acoes[0], 'tudo');
});
