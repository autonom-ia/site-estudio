// Proteções da leitura sem login: opção dada sem valor não vira fonte pulada em silêncio, e o
// estúdio não varre site de terceiro (loja de pedidos, link curto, página de links, redirecionamento
// para outro endereço) nem anota o contato dele como fato do negócio. Sem navegador: leitor falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ehSiteDoNegocio, lerFontes } from '../scripts/lib/ler.mjs';
import { abriuNoMesmoSite, lerSite } from '../scripts/lib/ler-site.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');

// Leitor falso: toda página pedida "abre" em `final` (o endereço depois do redirecionamento).
function leitorQueRedireciona(final, links) {
  const visitas = [];
  return {
    visitas,
    ir: async (url) => visitas.push(url),
    avaliar: async (fn) => (fn.name === 'lerPaginaDoSite' ? { url: final, titulo: 'T', descricao: '', titulos: [], texto: 'texto', links, imagens: [], jsonld: [] } : true),
  };
}

function rodarLer(args) {
  const sites = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ler-prot-'));
  try {
    fs.mkdirSync(path.join(sites, 'teste-ler'));
    const r = spawnSync(process.execPath, [DESPACHANTE, 'ler', 'teste-ler', ...args], { encoding: 'utf8', env: { ...process.env, ESTUDIO_SITES: sites } });
    const linhas = r.stdout.trim().split('\n');
    return { status: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
  } finally {
    fs.rmSync(sites, { recursive: true, force: true });
  }
}

test('opção sem valor (--instagram, --site...) é erro, nunca fonte pulada em silêncio', () => {
  for (const [args, nome] of [
    [['--instagram', '--negocio', 'Casa, Cidade'], '--instagram'],
    [['--negocio', 'Casa, Cidade', '--instagram'], '--instagram'],
    [['--instagram', '   ', '--negocio', 'Casa, Cidade'], '--instagram'],
    [['--instagram', 'casa', '--site'], '--site'],
  ]) {
    const r = rodarLer(args);
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(r.json.codigo, 'ARGUMENTO_INVALIDO', args.join(' '));
    assert.equal(r.json.dados.argumento, nome, args.join(' '));
  }
});

test('loja de pedidos, link curto e página de links não contam como site do negócio', () => {
  for (const u of ['https://www.ifood.com.br/delivery/x', 'https://bit.ly/abc', 'https://linkme.bio/x', 'https://beacons.ai/x', 'https://linktr.ee/x', 'https://maps.app.goo.gl/x', 'https://wa.link/x']) {
    assert.ok(!ehSiteDoNegocio(u), u);
  }
  assert.ok(ehSiteDoNegocio('https://www.casa.example/'));
});

test('a primeira página precisa abrir no mesmo endereço pedido, e esse endereço precisa ser do negócio', () => {
  assert.ok(abriuNoMesmoSite('http://casa.example/', 'https://www.casa.example/inicio'));
  assert.ok(!abriuNoMesmoSite('https://casa.example/', 'https://outra.example/'));
  assert.ok(!abriuNoMesmoSite('https://casa.example/', 'https://www.ifood.com.br/delivery/x'));
  assert.ok(!abriuNoMesmoSite('nada', 'https://casa.example/'));
});

test('site que redireciona para outro endereço: lê só a primeira página e não segue os links', async () => {
  const leitor = leitorQueRedireciona('https://www.ifood.com.br/delivery/outra', ['https://www.ifood.com.br/delivery/a', 'https://www.ifood.com.br/delivery/b']);
  const s = await lerSite(leitor, 'https://bit.ly/abc');
  assert.equal(s.desvio, 'https://www.ifood.com.br/delivery/outra');
  assert.equal(leitor.visitas.length, 1);
  assert.equal(s.paginas, undefined);
});

test('ler com site de terceiro: aviso LER_SITE_OUTRO_ENDERECO e nenhum contato dele em fatos.md', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ler-prot-'));
  try {
    const fatos = path.join(pasta, 'fatos.md');
    fs.writeFileSync(fatos, '# Fatos\n');
    const leitor = leitorQueRedireciona('https://www.ifood.com.br/delivery/outra', ['tel:+550000', 'mailto:contato@terceiro.example']);
    const r = await lerFontes({ site: 'https://casa.example/' }, { pasta: path.join(pasta, 'coleta'), fatos, leitor, data: '2026-11-23' });
    assert.deepEqual(r.avisos.map((a) => a.codigo), ['LER_SITE_OUTRO_ENDERECO']);
    assert.equal(r.avisos[0].dados.final, 'https://www.ifood.com.br/delivery/outra');
    assert.equal(r.dados.site, undefined);
    assert.equal(r.registros.length, 0);
    assert.ok(!fs.readFileSync(fatos, 'utf8').includes('550000'));
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
