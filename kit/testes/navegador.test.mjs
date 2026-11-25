// Ponta a ponta no Chrome: novo → preflight (GREEN) → prints da página inteira → desempenho →
// pacote → abrir; e um site estragado de propósito que checar, medir, acessibilidade e fatos
// precisam reprovar. Pula se não houver navegador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { opcoesDoNavegador } from './fixtures/navegador.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lerZip } from '../scripts/lib/zip.mjs';
import { FONTE_DE_EXEMPLO } from '../scripts/lib/fatos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const opcoes = opcoesDoNavegador(300000);

let base;
let env;
function estudio(...args) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env, timeout: 280000 });
  const linhas = (r.stdout || '').trim().split('\n');
  let json = null;
  try {
    json = JSON.parse(linhas[linhas.length - 1]);
  } catch {}
  return { codigo: r.status, json, stderr: r.stderr };
}

// Altura e largura de um JPEG, lidas do marcador SOF.
function tamanhoJpeg(buf) {
  let p = 2;
  while (p < buf.length) {
    if (buf[p] !== 0xff) return null;
    const marca = buf[p + 1];
    const len = buf.readUInt16BE(p + 2);
    if (marca === 0xc0 || marca === 0xc1 || marca === 0xc2) return { altura: buf.readUInt16BE(p + 5), largura: buf.readUInt16BE(p + 7) };
    p += 2 + len;
  }
  return null;
}

// Tira um atributo inteiro (espaço, nome, ="valor") de todo lugar do texto, sem expressão regular.
function semAtributo(texto, nome) {
  let saida = texto;
  const marca = ` ${nome}="`;
  let i = saida.indexOf(marca);
  while (i !== -1) {
    const fim = saida.indexOf('"', i + marca.length);
    saida = saida.slice(0, i) + saida.slice(fim + 1);
    i = saida.indexOf(marca);
  }
  return saida;
}

// Faz de conta que o assistente já trocou o conteúdo do molde: tira os data-molde, o molde: true
// da ordem e a fonte do exemplo de fatos.md. O texto continua o do molde, que passa nas medidas.
function tirarMolde(nome) {
  const pasta = path.join(base, nome);
  const secoes = path.join(pasta, '_gerador', 'secoes');
  for (const arq of fs.readdirSync(secoes)) {
    const c = path.join(secoes, arq);
    fs.writeFileSync(c, semAtributo(fs.readFileSync(c, 'utf8'), 'data-molde'));
  }
  const ordem = path.join(pasta, '_gerador', 'ordem.mjs');
  fs.writeFileSync(ordem, fs.readFileSync(ordem, 'utf8').replace('  molde: true,\n', ''));
  const fatos = path.join(pasta, 'fatos.md');
  fs.writeFileSync(fatos, fs.readFileSync(fatos, 'utf8').replaceAll(FONTE_DE_EXEMPLO, 'Teste automatizado do estúdio'));
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-nav-'));
  env = { ...process.env, ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem-marca'), ESTUDIO_NAO_ABRIR: '1' };
});
after(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

test('molde passa no preflight, vira prints da página inteira e por seção, e um zip para hospedar', opcoes, async () => {
  assert.equal(estudio('novo', 'ponta').codigo, 0);
  // recém-criado, o site ainda é o negócio fictício: reprova só por isso, e por todas as partes
  const cru = estudio('preflight', 'ponta');
  assert.equal(cru.codigo, 2, JSON.stringify(cru.json));
  const tiposCru = new Set(cru.json.dados.vermelhos.map((v) => v.tipo));
  assert.ok(tiposCru.has('resto-do-molde') && tiposCru.has('fonte-de-exemplo'), [...tiposCru].join(', '));
  assert.deepEqual(cru.json.dados.vermelhos.filter((v) => !['resto-do-molde', 'fonte-de-exemplo', 'numero', 'arroba', 'telefone', 'email'].includes(v.tipo)), []);
  assert.deepEqual(cru.json.dados.vermelhos.filter((v) => v.motivo && v.motivo !== 'fonte-de-exemplo'), []);
  const restos = cru.json.dados.vermelhos.filter((v) => v.tipo === 'resto-do-molde').map((v) => `${v.pagina} ${v.detalhe}`).join('\n');
  for (const parte of ['"abertura"', '"servicos"', '"visita"', '"cabecalho"', '"rodape"', 'ordem.mjs', '"historia"']) assert.ok(restos.includes(parte), parte);
  for (const etapa of ['medir', 'acessibilidade']) assert.equal(cru.json.dados.etapas[etapa].ok, true, etapa);

  tirarMolde('ponta');
  assert.equal(estudio('montar', 'ponta').codigo, 0);
  const pf = estudio('preflight', 'ponta');
  assert.equal(pf.codigo, 0, JSON.stringify(pf.json && pf.json.dados.vermelhos));
  assert.equal(pf.json.dados.red, 0);
  for (const etapa of ['checar', 'medir', 'acessibilidade', 'fatos']) assert.equal(pf.json.dados.etapas[etapa].ok, true, etapa);

  const pr = estudio('prints', 'ponta', '--tamanhos', '390,1440');
  assert.equal(pr.codigo, 0, JSON.stringify(pr.json));
  assert.deepEqual(pr.json.avisos, []);
  assert.equal(pr.json.dados.rodada, 1);
  const pasta = path.join(base, 'ponta', 'revisao', 'prints-r1');
  for (const largura of [390, 1440]) {
    const inteira = fs.readFileSync(path.join(pasta, `inicio-${largura}-inteira.jpg`));
    const t = tamanhoJpeg(inteira);
    assert.equal(t.largura, largura);
    // a página inteira, não só o topo
    assert.ok(t.altura > (largura === 390 ? 844 : 900) * 2, `altura ${t.altura} em ${largura}`);
  }
  const secoes = pr.json.dados.fotos.filter((f) => f.pagina === 'index.html' && f.largura === 390 && f.parte !== 'inteira').map((f) => f.parte);
  for (const s of ['abertura', 'jeito', 'servicos', 'pico', 'visita']) assert.ok(secoes.includes(s), s);
  assert.ok(fs.existsSync(path.join(pasta, 'a-oficina-390-inteira.jpg')));

  const de = estudio('desempenho', 'ponta');
  assert.equal(de.codigo, 0);
  assert.equal(de.json.dados.medidas.length, 4);
  assert.ok(de.json.dados.medidas.every((m) => m.peso_kb > 50 && m.pedidos > 3));

  const pc = estudio('pacote', 'ponta');
  assert.equal(pc.codigo, 0);
  const nomes = lerZip(fs.readFileSync(path.join(base, 'ponta', 'ponta-site.zip'))).map((e) => e.nome);
  for (const n of ['index.html', 'a-oficina/index.html', 'assets/css/site.css', 'assets/vendor/gsap/gsap.min.js', 'assets/marca/tokens.css']) assert.ok(nomes.includes(n), n);
  assert.ok(fs.existsSync(path.join(base, 'ponta', 'ponta-site.zip.sha256')));
});

test('abrir sobe o servidor do site e devolve o endereço', opcoes, async () => {
  const r = estudio('abrir', 'ponta', '--sem-navegador');
  assert.equal(r.codigo, 0, JSON.stringify(r.json));
  assert.equal(r.json.codigo, 'SERVIDOR_NO_AR', 'sem navegador, o código não pode dizer que abriu');
  assert.equal((await fetch(r.json.dados.endereco)).status, 200);
  assert.equal((await fetch(`${r.json.dados.endereco}a-oficina/`)).status, 200);
  const estado = path.join(RAIZ, '.ferramentas', 'servidores', 'ponta.json');
  const { pid } = JSON.parse(fs.readFileSync(estado, 'utf8'));
  process.kill(pid);
  fs.rmSync(estado, { force: true });
});

const ESTRAGO = `export default function estragada() {
  return \`<style>body{overflow-x:visible}</style>
<section class="estragada" data-secao="estragada" style="padding:4rem 1.5rem;position:relative">
  <p style="color:#d8d2c4">Texto quase invisível sobre o papel.</p>
  <a href="../nao-existe/">Página que não existe</a>
  <select aria-label="Escolha"><option>um</option></select>
  <p>Uma frase com travessão \\u2014 do jeito que entrega a máquina.</p>
  <p>Ligue 4321-9876 para reservar.</p>
  <script src="https://cdn.exemplo.invalid/biblioteca.js"></script>
  <div style="position:relative;height:200px">
    <p style="position:absolute;top:20px;left:0;font-size:32px;margin:0">Título por baixo</p>
    <p style="position:absolute;top:30px;left:10px;font-size:32px;margin:0">Outro texto por cima</p>
  </div>
  <div style="width:1400px;height:10px"></div>
  <a href="#visita" style="display:inline-block;padding:2px">x</a>
</section>\`;
}
`;

test('site estragado: checar, medir, acessibilidade, fatos e preflight reprovam com os tipos certos', opcoes, () => {
  assert.equal(estudio('novo', 'estragado').codigo, 0);
  tirarMolde('estragado');
  const pasta = path.join(base, 'estragado', '_gerador');
  fs.writeFileSync(path.join(pasta, 'secoes', 'estragada.mjs'), ESTRAGO);
  const ordem = path.join(pasta, 'ordem.mjs');
  fs.writeFileSync(ordem, fs.readFileSync(ordem, 'utf8').replace("'historia', 'chamada'", "'historia', 'estragada', 'chamada'"));
  assert.equal(estudio('montar', 'estragado').codigo, 0);

  const ck = estudio('checar', 'estragado');
  assert.equal(ck.codigo, 2, JSON.stringify(ck.json));
  const tiposCk = new Set(ck.json.dados.vermelhos.map((v) => v.tipo));
  for (const t of ['select-nativo', 'endereco-externo', 'link-morto', 'travessao']) assert.ok(tiposCk.has(t), `checar: faltou ${t} em ${[...tiposCk]}`);
  assert.ok(ck.json.dados.vermelhos.some((v) => v.tipo === 'link-morto' && v.detalhe.includes('#visita')), 'âncora morta');

  const md = estudio('medir', 'estragado', '--tamanhos', '390');
  assert.equal(md.codigo, 2);
  const tiposMd = new Set(md.json.dados.vermelhos.map((v) => v.tipo));
  for (const t of ['contraste', 'colisao', 'alvo-pequeno', 'rola-para-o-lado']) assert.ok(tiposMd.has(t), `medir: faltou ${t} em ${[...tiposMd]}`);
  // a colisão está bem abaixo da dobra do celular: o medidor rolou até o par
  assert.ok(md.json.dados.vermelhos.some((v) => v.tipo === 'colisao' && v.detalhe.includes('Título por baixo')));
  const contraste = md.json.dados.vermelhos.find((v) => v.tipo === 'contraste');
  assert.ok(Number(contraste.detalhe.split(':')[0]) < 1.5, contraste.detalhe);

  const ax = estudio('acessibilidade', 'estragado', '--tamanhos', '1440');
  assert.equal(ax.codigo, 2);
  assert.ok(ax.json.dados.vermelhos.some((v) => v.regra === 'color-contrast'));

  const ft = estudio('fatos', 'estragado');
  assert.equal(ft.codigo, 2);
  assert.deepEqual(ft.json.dados.vermelhos.map((v) => v.trecho), ['4321-9876']);

  const pf = estudio('preflight', 'estragado', '--tamanhos', '390');
  assert.equal(pf.codigo, 2);
  assert.equal(pf.json.codigo, 'PREFLIGHT_REPROVADO');
  for (const etapa of ['checar', 'medir', 'acessibilidade', 'fatos']) assert.equal(pf.json.dados.etapas[etapa].ok, false, etapa);
});
