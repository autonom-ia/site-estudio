// Peças do kit sem navegador: argumentos, nomes, contrato JSON, gerador do molde, fatos, zip,
// espelho e versões.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lerArgs } from '../scripts/lib/args.mjs';
import { nomeValido, sugerirNome, nomeReservado } from '../scripts/lib/caminhos.mjs';
import { sanear } from '../scripts/lib/executar.mjs';
import { montarResultado } from '../scripts/lib/saida.mjs';
import { nomeDaPagina, escolherTamanhos, rodadaAtual, caminhosDo } from '../scripts/lib/site.mjs';
import { sequenciasNumericas, palavrasComArroba, lerTabelaDeFatos, montarLastro, conferirTexto } from '../scripts/lib/fatos.mjs';
import { montarZip, lerZip, crc32 } from '../scripts/lib/zip.mjs';
import { conferirEspelhos, gerarEspelhos } from '../scripts/lib/espelho.mjs';
import { compararVersoes, enderecoAceito } from '../scripts/lib/atualizacao.mjs';
import { lerEnv } from '../scripts/lib/json.mjs';
import { acharNavegador } from '../scripts/lib/chrome.mjs';
import { linkRelativo, esc, palavras, validarRota } from '../molde/_gerador/montar.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
const temporaria = (prefixo) => fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
const escreverEm = (base, rel, texto = 'x') => {
  fs.mkdirSync(path.dirname(path.join(base, ...rel.split('/'))), { recursive: true });
  fs.writeFileSync(path.join(base, ...rel.split('/')), texto);
};

function rodarEstudio(args, env = {}) {
  const r = spawnSync(process.execPath, [DESPACHANTE, ...args], { encoding: 'utf8', env: { ...process.env, ESTUDIO_NAO_ABRIR: '1', ...env } });
  const linhas = r.stdout.trim().split('\n');
  return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]), stdout: r.stdout, stderr: r.stderr };
}

test('lerArgs separa posicionais, --chave valor, --chave=valor e --chave sozinha', () => {
  const a = lerArgs(['exemplo', '--titulo', 'Meu site', '--qualidade=70', '--sem-secoes']);
  assert.deepEqual(a.posicionais, ['exemplo']);
  assert.deepEqual(a.opcoes, { titulo: 'Meu site', qualidade: '70', 'sem-secoes': true });
});

test('lerArgs: opção sem valor não engole o nome, antes ou depois dele', () => {
  for (const ordem of [['--sem-navegador', 'teste-rev'], ['teste-rev', '--sem-navegador']]) {
    const a = lerArgs(ordem);
    assert.deepEqual(a.posicionais, ['teste-rev'], ordem.join(' '));
    assert.deepEqual(a.opcoes, { 'sem-navegador': true }, ordem.join(' '));
  }
  const b = lerArgs(['--reduzido', '--conferir', 'site', '--rapido', '--confirmar', '--tamanhos', '390']);
  assert.deepEqual(b.posicionais, ['site']);
  assert.deepEqual(b.opcoes, { reduzido: true, conferir: true, rapido: true, confirmar: true, tamanhos: '390' });
  const r = rodarEstudio(['abrir', '--sem-navegador', 'nao-existe-mesmo']);
  assert.equal(r.json.codigo, 'SITE_NAO_ACHADO', 'o nome não pode virar valor de --sem-navegador');
});

test('navegador: ESTUDIO_CHROME, depois o de versão fixa de navegador.txt, antes do Chrome do sistema', () => {
  const ferr = temporaria('estudio-ferr-');
  try {
    const falso = path.join(ferr, 'navegador', 'chrome-headless-shell-falso');
    fs.mkdirSync(path.dirname(falso), { recursive: true });
    fs.writeFileSync(falso, '#!/bin/sh\n');
    fs.chmodSync(falso, 0o755);
    // o instalador do Windows grava com \r\n
    fs.writeFileSync(path.join(ferr, 'navegador.txt'), `${falso}\r\n`);
    const env = { HOME: process.env.HOME, PROGRAMFILES: process.env.PROGRAMFILES, LOCALAPPDATA: process.env.LOCALAPPDATA, ESTUDIO_FERRAMENTAS: ferr };
    assert.deepEqual(acharNavegador(env), { caminho: falso, tipo: 'shell' });
    const forcado = path.join(ferr, 'outro');
    fs.writeFileSync(forcado, '');
    assert.deepEqual(acharNavegador({ ...env, ESTUDIO_CHROME: forcado }), { caminho: forcado, tipo: 'forcado' });
    // navegador.txt que aponta para o que não existe não vale
    fs.writeFileSync(path.join(ferr, 'navegador.txt'), `${path.join(ferr, 'sumiu')}\n`);
    const semFixo = acharNavegador(env);
    assert.notEqual(semFixo && semFixo.caminho, path.join(ferr, 'sumiu'));
    if (process.platform !== 'win32') {
      // nem arquivo sem permissão de execução
      fs.chmodSync(falso, 0o644);
      fs.writeFileSync(path.join(ferr, 'navegador.txt'), `${falso}\n`);
      const r = acharNavegador(env);
      assert.notEqual(r && r.caminho, falso, JSON.stringify(r));
    }
  } finally {
    fs.rmSync(ferr, { recursive: true, force: true });
  }
});

test('nome de site: só minúsculas, números e hífen; sugestão tira acento e espaço', () => {
  assert.equal(nomeValido('clinica-horizonte'), true);
  for (const ruim of ['', 'Café', 'a b', '../x', '-a', 'a-', 'a/b', 'a.b']) assert.equal(nomeValido(ruim), false, ruim);
  assert.equal(sugerirNome('Clínica Horizonte 2027!'), 'clinica-horizonte-2027');
});

test('nome de site: nomes reservados do Windows (con, nul, com1, lpt9…) não valem; a sugestão é usável', () => {
  for (const ruim of ['con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9']) {
    assert.equal(nomeValido(ruim), false, ruim);
    assert.equal(nomeValido(sugerirNome(ruim)), true, sugerirNome(ruim));
  }
  assert.equal(nomeReservado('CON'), true);
  assert.equal(nomeReservado('con.algo'), true);
  assert.equal(nomeReservado('Lpt3.txt'), true);
  for (const bom of ['console', 'con-1', 'com0', 'com10', 'lpt', 'nulo', 'auxilio']) assert.equal(nomeValido(bom), true, bom);
  assert.equal(sugerirNome('CON'), 'con-1');
  assert.equal(sugerirNome('Com1'), 'com1-1');
  assert.equal(sugerirNome('con.algo'), 'con-algo');
  const r = rodarEstudio(['novo', 'nul'], { ESTUDIO_SITES: path.join(os.tmpdir(), 'estudio-nao-cria') });
  assert.equal(r.json.codigo, 'NOME_INVALIDO');
  assert.equal(r.json.dados.sugestao, 'nul-1');
});

test('sanear esconde sequências longas parecidas com segredo', () => {
  assert.equal(sanear(`chave=${'a'.repeat(20)}${'B'.repeat(20)} ok`), 'chave=<REDACTED> ok');
  assert.equal(sanear('curto_123'), 'curto_123');
});

test('contrato: resultado sempre tem ok, comando, codigo, resumo, arquivos, avisos e dados', () => {
  const r = montarResultado('x', { ok: true });
  assert.deepEqual(Object.keys(r).sort(), ['arquivos', 'avisos', 'codigo', 'comando', 'dados', 'ok', 'resumo']);
});

test('contrato: nome e caminho longos ficam intactos; só detalhe, erro e saida passam pelo sanear', () => {
  const nome = 'clinica-horizonte-odontologia-integrada-sp-zl';
  assert.equal(nome.length, 45);
  const segredo = `${'a'.repeat(20)}${'B'.repeat(20)}`;
  const r = montarResultado('novo', {
    ok: true,
    arquivos: { site: `sites/${nome}/site` },
    avisos: [{ codigo: 'X', dados: { nome, erro: `falhou ${segredo}` } }],
    dados: { nome, paginas: [nome], detalhe: `token ${segredo}`, filho: { saida: [`linha ${segredo}`], titulo: nome } },
  });
  assert.equal(r.dados.nome, nome);
  assert.deepEqual(r.dados.paginas, [nome]);
  assert.equal(r.dados.filho.titulo, nome);
  assert.equal(r.arquivos.site, `sites/${nome}/site`);
  assert.equal(r.avisos[0].dados.nome, nome);
  assert.equal(r.dados.detalhe, 'token <REDACTED>');
  assert.deepEqual(r.dados.filho.saida, ['linha <REDACTED>']);
  assert.equal(r.avisos[0].dados.erro, 'falhou <REDACTED>');
});

test('despachante: comando desconhecido sai 1 com JSON na última linha e lista os comandos', () => {
  const r = rodarEstudio(['nao-existe']);
  assert.equal(r.codigo, 1);
  assert.equal(r.json.codigo, 'COMANDO_DESCONHECIDO');
  for (const c of ['novo', 'montar', 'checar', 'prints', 'medir', 'acessibilidade', 'desempenho', 'fatos', 'preflight', 'abrir', 'pacote', 'verificar', 'espelhar', 'versao', 'atualizar']) {
    assert.ok(r.json.dados.disponiveis.includes(c), c);
  }
});

test('despachante: versao sai 0 e informa o axe-core fixo', () => {
  const r = rodarEstudio(['versao']);
  assert.equal(r.codigo, 0);
  assert.equal(r.json.dados.axe, fs.readFileSync(path.join(RAIZ, 'kit', 'vendor', 'axe', 'VERSAO'), 'utf8').trim());
});

test('novo: nome inválido vira NOME_INVALIDO; cria, monta as duas páginas e não sobrescreve', () => {
  const base = temporaria('estudio-novo-');
  try {
    const ruim = rodarEstudio(['novo', 'Meu Site'], { ESTUDIO_SITES: base });
    assert.equal(ruim.codigo, 1);
    assert.equal(ruim.json.codigo, 'NOME_INVALIDO');
    assert.equal(ruim.json.dados.sugestao, 'meu-site');
    const ok = rodarEstudio(['novo', 'teste', '--titulo', 'Clínica <Horizonte>'], { ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem') });
    assert.equal(ok.codigo, 0, ok.stdout);
    assert.equal(ok.json.avisos[0].codigo, 'MARCA_DE_EXEMPLO');
    assert.deepEqual(ok.json.dados.paginas, ['index.html', 'a-casa/index.html']);
    const index = fs.readFileSync(path.join(base, 'teste', 'site', 'index.html'), 'utf8');
    assert.ok(index.includes('<title>Clínica &lt;Horizonte&gt; · '));
    assert.ok(index.includes('href="assets/css/site.css"'));
    const interna = fs.readFileSync(path.join(base, 'teste', 'site', 'a-casa', 'index.html'), 'utf8');
    assert.ok(interna.includes('href="../assets/css/site.css"'));
    assert.ok(fs.existsSync(path.join(base, 'teste', 'site', 'assets', 'marca', 'tokens.css')));
    for (const f of ['brief.md', 'fatos.md', 'referencias.md', 'direcao.md', 'material/LEIA-ME.txt']) assert.ok(fs.existsSync(path.join(base, 'teste', ...f.split('/'))), f);
    assert.equal(rodarEstudio(['novo', 'teste'], { ESTUDIO_SITES: base }).json.codigo, 'SITE_JA_EXISTE');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('novo: título com $&, $\' e $1 entra literal (não vira padrão de troca)', () => {
  const base = temporaria('estudio-novo-cifrao-');
  try {
    const titulo = "A $& B $' C $` D $1";
    const r = rodarEstudio(['novo', 'cifrao', '--titulo', titulo], { ESTUDIO_SITES: base, ESTUDIO_MARCA: path.join(base, 'sem') });
    assert.equal(r.codigo, 0, r.stdout);
    assert.equal(r.json.dados.titulo, titulo);
    const ordem = fs.readFileSync(path.join(base, 'cifrao', '_gerador', 'ordem.mjs'), 'utf8');
    assert.ok(ordem.includes(`nome: ${JSON.stringify(titulo)},`), ordem.slice(0, 800));
    assert.equal(ordem.includes('{{NOME_DO_SITE}}'), false);
    const index = fs.readFileSync(path.join(base, 'cifrao', 'site', 'index.html'), 'utf8');
    assert.ok(index.includes('<title>A $&amp; B $&#39; C $` D $1 · '), index.slice(0, 600));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('pacote: recusa cópia de segurança e rascunho (.old, .tmp, pasta backup, old, tmp…), sem pegar nome parecido', () => {
  const base = temporaria('estudio-backup-');
  try {
    const sites = path.join(base, 'sites');
    const site = path.join(sites, 'b', 'site');
    const colocar = (rel) => escreverEm(site, rel);
    colocar('index.html');
    // parecidos, mas não são cópia: passam
    for (const rel of ['assets/oldies/a.css', 'assets/bold.css', 'assets/template.html', 'assets/tmpl/b.css', 'gold/c.css', 'temp.html']) colocar(rel);
    const env = { ESTUDIO_SITES: sites };
    const ok = rodarEstudio(['pacote', 'b'], env);
    assert.equal(ok.codigo, 0, ok.stdout);
    const ruins = ['pagina.old', 'outra.OLD', 'a.backup', 'b.tmp', 'Index.HTML.BAK', 'c.orig', 'd.swp', 'e~',
      'backup/x.png', 'Backups/y.png', 'old/z.css', '_old/w.css', 'TMP/q.js', 'assets/tmp/r.js', 'assets.old/a.css'];
    for (const rel of ruins) colocar(rel);
    const r = rodarEstudio(['pacote', 'b'], env);
    assert.equal(r.codigo, 2, r.stdout);
    assert.equal(r.json.codigo, 'PACOTE_ARQUIVO_PRIVADO');
    const esperados = ['pagina.old', 'outra.OLD', 'a.backup', 'b.tmp', 'Index.HTML.BAK', 'c.orig', 'd.swp', 'e~',
      'backup/', 'Backups/', 'old/', '_old/', 'TMP/', 'assets/tmp/', 'assets.old/'];
    assert.deepEqual([...r.json.dados.arquivos].sort(), esperados.map((e) => `site/${e}`).sort());
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('pacote: recusa arquivo privado, oculto ou link em site/ antes de montar o zip', () => {
  const base = temporaria('estudio-privado-');
  try {
    const sites = path.join(base, 'sites');
    const site = path.join(sites, 'p', 'site');
    const colocar = (rel, texto = 'x') => {
      fs.mkdirSync(path.dirname(path.join(site, ...rel.split('/'))), { recursive: true });
      fs.writeFileSync(path.join(site, ...rel.split('/')), texto);
    };
    colocar('index.html', '<p>oi</p>');
    // permitidos: .nojekyll, .well-known/ e o lixo do sistema (que nunca entra no zip)
    colocar('.nojekyll', '');
    colocar('.well-known/security.txt', 'contato');
    colocar('.DS_Store', 'lixo');
    const env = { ESTUDIO_SITES: sites };
    const ok = rodarEstudio(['pacote', 'p'], env);
    assert.equal(ok.codigo, 0, ok.stdout);
    const nomes = lerZip(fs.readFileSync(path.join(sites, 'p', 'p-site.zip'))).map((e) => e.nome);
    assert.ok(nomes.includes('.nojekyll') && nomes.includes('.well-known/security.txt'), nomes.join(', '));
    assert.equal(nomes.includes('.DS_Store'), false);
    const proibidos = ['.env', 'producao.env', 'config.env.local', 'assets/chave.pem', 'assets/servidor.KEY', 'id_rsa', 'id_rsa.pub',
      'index.html.bak', 'site.css.orig', '.index.html.swp', 'index.html~', '.git/config', 'assets/.segredo/a.txt', '.htpasswd'];
    for (const rel of proibidos) colocar(rel);
    let link = false;
    try {
      fs.symlinkSync(path.join(base, 'fora.txt'), path.join(site, 'assets', 'atalho.txt'), 'file');
      link = true;
    } catch {}
    fs.rmSync(path.join(sites, 'p', 'p-site.zip'));
    const r = rodarEstudio(['pacote', 'p'], env);
    assert.equal(r.codigo, 2, r.stdout);
    assert.equal(r.json.codigo, 'PACOTE_ARQUIVO_PRIVADO');
    const esperados = ['.env', 'producao.env', 'config.env.local', 'assets/chave.pem', 'assets/servidor.KEY', 'id_rsa', 'id_rsa.pub',
      'index.html.bak', 'site.css.orig', '.index.html.swp', 'index.html~', '.git/', 'assets/.segredo/', '.htpasswd'];
    if (link) esperados.push('assets/atalho.txt');
    assert.deepEqual([...r.json.dados.arquivos].sort(), esperados.map((e) => `site/${e}`).sort());
    assert.equal(fs.existsSync(path.join(sites, 'p', 'p-site.zip')), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('marca: só tokens, fontes com licença e logo entram no site; marca.md nunca vai para o zip', () => {
  const base = temporaria('estudio-marca-');
  try {
    const marca = path.join(base, 'marca');
    fs.mkdirSync(path.join(marca, 'fontes'), { recursive: true });
    fs.copyFileSync(path.join(RAIZ, 'kit', 'marca-exemplo', 'tokens.css'), path.join(marca, 'tokens.css'));
    for (const f of ['Fraunces-Variable.woff2', 'DMSans-Variable.woff2', 'OFL-Fraunces.txt', 'OFL-DMSans.txt']) {
      fs.copyFileSync(path.join(RAIZ, 'kit', 'marca-exemplo', 'fontes', f), path.join(marca, 'fontes', f));
    }
    fs.writeFileSync(path.join(marca, 'fontes', 'rascunho.txt'), 'anotação');
    fs.writeFileSync(path.join(marca, 'marca.md'), '# Tom\nNota interna: não dizer o preço ao concorrente.\n');
    fs.writeFileSync(path.join(marca, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
    fs.writeFileSync(path.join(marca, 'logo-original.ai'), 'arquivo-fonte');
    fs.writeFileSync(path.join(marca, 'notas.txt'), 'interno');
    fs.mkdirSync(path.join(marca, 'rascunhos'));
    fs.writeFileSync(path.join(marca, 'rascunhos', 'ideia.png'), 'x');
    const env = { ESTUDIO_SITES: path.join(base, 'sites'), ESTUDIO_MARCA: marca };
    const r = rodarEstudio(['novo', 'comarca'], env);
    assert.equal(r.codigo, 0, r.stdout);
    assert.equal(r.json.dados.marca, 'minha-marca');
    const destino = path.join(base, 'sites', 'comarca', 'site', 'assets', 'marca');
    const dentro = [];
    const andar = (d, rel) => {
      for (const n of fs.readdirSync(d)) {
        const c = path.join(d, n);
        if (fs.statSync(c).isDirectory()) andar(c, `${rel}${n}/`);
        else dentro.push(`${rel}${n}`);
      }
    };
    andar(destino, '');
    assert.deepEqual(dentro.sort(), ['fontes/DMSans-Variable.woff2', 'fontes/Fraunces-Variable.woff2', 'fontes/OFL-DMSans.txt', 'fontes/OFL-Fraunces.txt', 'logo.svg', 'tokens.css']);
    // um .md largado em site/ por engano também fica fora do zip
    fs.writeFileSync(path.join(base, 'sites', 'comarca', 'site', 'assets', 'anotacao.md'), 'interno');
    fs.writeFileSync(path.join(base, 'sites', 'comarca', 'site', 'assets', 'img', 'sobrou.jpg'), 'x');
    const pc = rodarEstudio(['pacote', 'comarca'], env);
    assert.equal(pc.codigo, 0, pc.stdout);
    const nomes = lerZip(fs.readFileSync(path.join(base, 'sites', 'comarca', 'comarca-site.zip'))).map((e) => e.nome);
    assert.equal(nomes.some((n) => n.endsWith('.md')), false, nomes.join(', '));
    assert.equal(nomes.some((n) => n.includes('notas') || n.includes('.ai') || n.includes('rascunho')), false, nomes.join(', '));
    assert.ok(nomes.includes('assets/marca/fontes/OFL-Fraunces.txt'));
    assert.deepEqual(pc.json.dados.fora_do_pacote, ['site/assets/anotacao.md']);
    const solto = pc.json.avisos.find((a) => a.codigo === 'ARQUIVO_NAO_USADO');
    assert.ok(solto, JSON.stringify(pc.json.avisos));
    assert.ok(solto.dados.arquivos.includes('site/assets/img/sobrou.jpg'));
    assert.equal(solto.dados.arquivos.some((a) => a.includes('OFL') || a.includes('tokens.css') || a.includes('.woff2')), false, solto.dados.arquivos.join(', '));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('montar: tira da pasta site/ a página que saiu da ordem e acusa seção que não existe', () => {
  const base = temporaria('estudio-montar-');
  try {
    assert.equal(rodarEstudio(['novo', 'm'], { ESTUDIO_SITES: base }).codigo, 0);
    const ordem = path.join(base, 'm', '_gerador', 'ordem.mjs');
    const original = fs.readFileSync(ordem, 'utf8');
    const corte = original.indexOf("  {\n    rota: 'a-casa'");
    fs.writeFileSync(ordem, `${original.slice(0, corte)}];\n`);
    const r = rodarEstudio(['montar', 'm'], { ESTUDIO_SITES: base });
    assert.equal(r.codigo, 0, r.stdout);
    assert.deepEqual(r.json.dados.removidas, ['a-casa/index.html']);
    assert.equal(fs.existsSync(path.join(base, 'm', 'site', 'a-casa')), false);
    fs.writeFileSync(ordem, original.replace("'manifesto',", "'nao-existe',"));
    const falhou = rodarEstudio(['montar', 'm'], { ESTUDIO_SITES: base });
    assert.equal(falhou.codigo, 1);
    assert.equal(falhou.json.codigo, 'MONTAR_FALHOU');
    assert.ok(falhou.json.dados.detalhe.includes('nao-existe'));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('gerador: link relativo entre páginas, escape de HTML e palavras em <span>', () => {
  assert.equal(linkRelativo('', 'a-casa'), 'a-casa/');
  assert.equal(linkRelativo('', ''), './');
  assert.equal(linkRelativo('', '/#visita'), './#visita');
  assert.equal(linkRelativo('a-casa', ''), '../');
  assert.equal(linkRelativo('a-casa', '/#visita'), '../#visita');
  assert.equal(linkRelativo('servicos/limpeza', 'contato'), '../../contato/');
  assert.equal(linkRelativo('a-casa', '#topo'), '#topo');
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(palavras('um  dois\ntrês'), '<span>um</span> <span>dois</span> <span>três</span>');
});

test('molde: a anatomia de foto traz picture com srcset, sizes, width, height, alt e lazy', async () => {
  const { default: foto } = await import('../molde/_gerador/secoes/foto.mjs');
  const html = foto({ esc, assets: '../assets/' });
  for (const pedaco of ['<picture>', 'type="image/webp"', 'srcset="../assets/img/foto-800.webp 800w, ../assets/img/foto-1600.webp 1600w"', 'sizes="', 'width="1600"', 'height="1067"', 'alt="', 'loading="lazy"', '<figcaption']) {
    assert.ok(html.includes(pedaco), pedaco);
  }
  const ordem = fs.readFileSync(path.join(RAIZ, 'kit', 'molde', '_gerador', 'ordem.mjs'), 'utf8');
  assert.equal(ordem.includes("'foto'"), false, 'a anatomia não entra na ordem do molde: não há foto no estúdio');
});

test('nome da página, tamanhos de tela e rodada de revisão', () => {
  assert.equal(nomeDaPagina('index.html'), 'inicio');
  assert.equal(nomeDaPagina('a-casa/index.html'), 'a-casa');
  assert.equal(nomeDaPagina('servicos/limpeza/index.html'), 'servicos-limpeza');
  assert.equal(nomeDaPagina('obrigado.html'), 'obrigado');
  assert.deepEqual(escolherTamanhos({}).map((t) => t.largura), [390, 768, 1440, 1920]);
  assert.deepEqual(escolherTamanhos({ tamanhos: '1440,celular' }).map((t) => t.largura), [1440, 390]);
  assert.throws(() => escolherTamanhos({ tamanhos: '1000' }), (e) => e.codigo === 'ARGUMENTO_INVALIDO');
  const base = temporaria('estudio-rodada-');
  try {
    const c = caminhosDo('x', base);
    assert.equal(rodadaAtual(c, {}), 1);
    fs.mkdirSync(c.revisao, { recursive: true });
    fs.writeFileSync(path.join(c.revisao, 'rodada-1.md'), '#');
    fs.writeFileSync(path.join(c.revisao, 'rodada-2.md'), '#');
    assert.equal(rodadaAtual(c, {}), 3);
    assert.equal(rodadaAtual(c, { rodada: '1' }), 1);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('fatos: acha números com 3+ dígitos, telefone, preço, ano e @, sem expressão regular', () => {
  const t = 'Desde 2019. Ligue (11) 0000-0000 ou 0800 123 4567. Pão R$ 18,00, café R$ 9. Abre 7h às 19h. Rua X, 120, casa 2. Siga @cafe.aurora, ou escreva para ola@cafe.example.';
  const achados = sequenciasNumericas(t).map((s) => s.trecho);
  assert.deepEqual(achados, ['2019', '(11) 0000-0000', '0800 123 4567', '18,00', '120']);
  assert.deepEqual(palavrasComArroba(t), ['@cafe.aurora', 'ola@cafe.example']);
});

test('fatos: só vale linha com fonte; número de uma linha não empresta dígitos de outra', () => {
  const md = [
    '# Fatos',
    '| Fato | Fonte | Data |',
    '|---|---|---|',
    '| Telefone (11) 4198-2000 | cartão da loja | 2026 |',
    '| Temos 3.500 seguidores | | |',
    '| Abriu em 2021 | a dona | 2026 |',
    '| E-mail ola@casa.example | a dona | 2026 |',
    '',
    'texto solto com 1982 fora de tabela',
  ].join('\n');
  const linhas = lerTabelaDeFatos(md);
  assert.equal(linhas.length, 4);
  assert.equal(linhas.filter((l) => l.comFonte).length, 3);
  const lastro = montarLastro(linhas);
  const r = conferirTexto({ texto: 'Desde 1982. Ligue (11) 4198-2000. Desde 2021. Temos 3.500 fãs. Ramal 4.198. ola@casa.example @outra', enderecos: ['tel:+551141982000', 'mailto:ola@casa.example', 'mailto:x@y.example'] }, lastro);
  const trechos = r.faltam.map((f) => `${f.tipo}:${f.trecho}:${f.motivo}`);
  assert.deepEqual(trechos.sort(), [
    'arroba:@outra:fora-de-fatos',
    'email:mailto:x@y.example:fora-de-fatos',
    'numero:1982:fora-de-fatos',
    'numero:3.500:linha-sem-fonte',
  ]);
});

test('zip: escreve, lê de volta e confere o CRC de cada arquivo', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entradas = [
    { nome: 'index.html', dados: Buffer.from('<p>olá</p>'.repeat(50)) },
    { nome: 'a-casa/index.html', dados: Buffer.from('<p>casa</p>') },
    { nome: 'assets/img/x.bin', dados: Buffer.from([0, 1, 2, 3, 255]) },
  ];
  const lido = lerZip(montarZip(entradas));
  assert.deepEqual(lido.map((e) => e.nome), entradas.map((e) => e.nome));
  for (let k = 0; k < entradas.length; k += 1) {
    assert.ok(lido[k].crcOk);
    assert.ok(lido[k].dados.equals(entradas[k].dados));
  }
});

test('espelho: gera cópias iguais, confere, acusa diferença, remove sobra e deixa a skill da pessoa', () => {
  const raiz = temporaria('estudio-espelho-');
  try {
    fs.writeFileSync(path.join(raiz, 'AGENTS.md'), '# agentes\n');
    fs.mkdirSync(path.join(raiz, '.claude', 'skills', 'revisar'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.claude', 'skills', 'revisar', 'SKILL.md'), 'revisar\n');
    // sobra dentro de uma skill do estúdio: some
    fs.mkdirSync(path.join(raiz, '.agents', 'skills', 'revisar'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.agents', 'skills', 'revisar', 'velho.md'), 'velho\n');
    // skill da própria pessoa, só em .agents (para o Codex): fica e não reprova a conferência
    fs.mkdirSync(path.join(raiz, '.agents', 'skills', 'minha'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.agents', 'skills', 'minha', 'SKILL.md'), 'minha\n');
    assert.equal(conferirEspelhos(raiz).ok, false);
    const feito = gerarEspelhos(raiz);
    assert.deepEqual(feito.apagados, ['.agents/skills/revisar/velho.md']);
    assert.equal(fs.readFileSync(path.join(raiz, '.agents', 'skills', 'minha', 'SKILL.md'), 'utf8'), 'minha\n');
    assert.equal(conferirEspelhos(raiz).ok, true);
    fs.writeFileSync(path.join(raiz, 'CLAUDE.md'), '# mexido\n');
    assert.equal(conferirEspelhos(raiz).diferencas[0].arquivo, 'CLAUDE.md');
    const cmd = rodarEstudio(['espelhar', '--conferir'], { ESTUDIO_RAIZ_ESPELHO: raiz });
    assert.equal(cmd.codigo, 2);
    assert.equal(cmd.json.codigo, 'ESPELHO_DIFERENTE');
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('espelho: só limpa pasta vazia dentro das skills do estúdio, não atravessa link e link quebrado não derruba', (t) => {
  const raiz = temporaria('estudio-espelho-vazias-');
  try {
    escreverEm(raiz, 'AGENTS.md', '# agentes\n');
    escreverEm(raiz, '.claude/skills/revisar/SKILL.md', 'revisar\n');
    // dentro da skill do estúdio: a pasta que ficou vazia sai
    escreverEm(raiz, '.agents/skills/revisar/velha/sobra.md', 'x');
    // skill da pessoa, só em .agents, com pasta vazia de propósito: fica
    escreverEm(raiz, '.agents/skills/minha/SKILL.md', 'minha\n');
    fs.mkdirSync(path.join(raiz, '.agents', 'skills', 'minha', 'vazia'));
    // pasta de fora, com subpasta vazia, ligada por link dentro de uma skill do estúdio
    fs.mkdirSync(path.join(raiz, 'fora', 'vazia-de-fora'), { recursive: true });
    let links = true;
    try {
      fs.symlinkSync(path.join(raiz, 'fora'), path.join(raiz, '.agents', 'skills', 'revisar', 'atalho'), 'junction');
      fs.symlinkSync(path.join(raiz, 'nao-existe'), path.join(raiz, '.agents', 'skills', 'revisar', 'quebrado'), 'junction');
      fs.symlinkSync(path.join(raiz, 'nao-existe'), path.join(raiz, '.agents', 'skills', 'link-quebrado-da-pessoa'), 'junction');
    } catch {
      links = false;
    }
    gerarEspelhos(raiz);
    assert.equal(fs.existsSync(path.join(raiz, '.agents', 'skills', 'revisar', 'velha')), false);
    assert.ok(fs.existsSync(path.join(raiz, '.agents', 'skills', 'minha', 'vazia')));
    assert.equal(fs.readFileSync(path.join(raiz, '.agents', 'skills', 'revisar', 'SKILL.md'), 'utf8'), 'revisar\n');
    if (!links) {
      t.diagnostic('sem permissão para criar link: parte do link não conferida');
      return;
    }
    // o que está do outro lado do link fica intacto; o link dentro da skill do estúdio é sobra e sai
    assert.ok(fs.existsSync(path.join(raiz, 'fora', 'vazia-de-fora')));
    const existeSemSeguir = (...p) => {
      try {
        fs.lstatSync(path.join(raiz, ...p));
        return true;
      } catch {
        return false;
      }
    };
    assert.equal(existeSemSeguir('.agents', 'skills', 'revisar', 'atalho'), false);
    assert.equal(existeSemSeguir('.agents', 'skills', 'revisar', 'quebrado'), false);
    // a skill da pessoa (mesmo link quebrado) não é tocada
    assert.ok(fs.lstatSync(path.join(raiz, '.agents', 'skills', 'link-quebrado-da-pessoa')).isSymbolicLink());
    assert.equal(conferirEspelhos(raiz).ok, true);
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
  }
});

test('o repositório está espelhado (AGENTS.md = CLAUDE.md, .claude/skills = .agents/skills)', (t) => {
  if (!fs.existsSync(path.join(RAIZ, 'AGENTS.md')) || !fs.existsSync(path.join(RAIZ, '.claude', 'skills'))) {
    t.skip('AGENTS.md ou .claude/skills ainda não existem');
    return;
  }
  assert.deepEqual(conferirEspelhos(RAIZ).diferencas, []);
});

test('versões: comparação numérica e endereço de atualização só do repositório oficial', () => {
  assert.equal(compararVersoes('1.10.0', '1.9.3'), 1);
  assert.equal(compararVersoes('1.0.0', '1.0'), 0);
  assert.equal(enderecoAceito('https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip'), true);
  for (const ruim of ['https://github.com/outra/site-estudio/x.zip', 'https://github.com/autonom-ia/site-estudio/../x.zip',
    'https://x@github.com/autonom-ia/site-estudio/a.zip', 'http://github.com/autonom-ia/site-estudio/a.zip',
    'https://github.com/autonom-ia/view-estudio/a.zip']) {
    assert.equal(enderecoAceito(ruim), false, ruim);
  }
});

test('o endereço de atualização do kit bate com instalar/versoes.env', (t) => {
  const arq = path.join(RAIZ, 'instalar', 'versoes.env');
  if (!fs.existsSync(arq)) {
    t.skip('instalar/versoes.env ainda não existe');
    return;
  }
  const url = lerEnv(arq).ESTUDIO_ATUALIZAR_URL;
  assert.ok(url && enderecoAceito(url), String(url));
});

test('instalador: SHA256 do Node fixo por arquivo, @puppeteer/browsers no lock e nada de npx', () => {
  const v = lerEnv(path.join(RAIZ, 'instalar', 'versoes.env'));
  const hex = '0123456789abcdef';
  for (const chave of ['NODE_SHA256_DARWIN_ARM64', 'NODE_SHA256_DARWIN_X64', 'NODE_SHA256_WIN_X64', 'NODE_SHA256_WIN_ARM64']) {
    const sha = v[chave] || '';
    assert.equal(sha.length, 64, chave);
    assert.ok([...sha].every((ch) => hex.includes(ch)), chave);
  }
  const pacote = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(pacote.devDependencies['@puppeteer/browsers'], v.PUPPETEER_BROWSERS_VERSAO);
  const lock = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/@puppeteer/browsers'].version, v.PUPPETEER_BROWSERS_VERSAO);
  for (const arq of ['instalar.sh', 'instalar.ps1']) {
    const texto = fs.readFileSync(path.join(RAIZ, 'instalar', arq), 'utf8');
    assert.equal(texto.includes('SHASUMS256'), false, `${arq} ainda baixa a lista de hashes`);
    assert.equal(texto.includes('npx'), false, `${arq} ainda usa npx`);
    assert.ok(texto.includes('@puppeteer/browsers/lib/main-cli.js') || texto.includes('@puppeteer\\browsers\\lib\\main-cli.js'), arq);
  }
  // falta de peça é erro de instalação (saída 1), nunca reprovação de site (saída 2)
  const verificar = fs.readFileSync(path.join(RAIZ, 'kit', 'scripts', 'comandos', 'verificar.mjs'), 'utf8');
  assert.equal(verificar.includes('reprovado('), false);
  assert.ok(verificar.includes("falha('VERIFICACAO_FALHOU'"));
});

test('lerEnv lê CHAVE=VALOR e ignora comentário', () => {
  const pasta = temporaria('estudio-env-');
  try {
    const arq = path.join(pasta, 'v.env');
    fs.writeFileSync(arq, '# comentario\nA=1\n\nURL=https://x/y?a=b\n');
    assert.deepEqual(lerEnv(arq), { A: '1', URL: 'https://x/y?a=b' });
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('espelho: nunca escreve nem apaga através de link (pasta pessoal fica intocada)', () => {
  const raiz = temporaria('estudio-espelho-link-');
  const pessoal = temporaria('estudio-pessoal-');
  try {
    fs.writeFileSync(path.join(raiz, 'AGENTS.md'), '# agentes\n');
    fs.mkdirSync(path.join(raiz, '.claude', 'skills', 'revisar', 'ref'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.claude', 'skills', 'revisar', 'SKILL.md'), 'oficial\n');
    fs.writeFileSync(path.join(raiz, '.claude', 'skills', 'revisar', 'ref', 'a.md'), 'a\n');
    fs.writeFileSync(path.join(pessoal, 'SKILL.md'), 'minha\n');
    fs.writeFileSync(path.join(pessoal, 'nota.md'), 'nota\n');
    fs.mkdirSync(path.join(raiz, '.agents', 'skills'), { recursive: true });
    // a pasta da skill do estúdio virou link para uma pasta da pessoa
    fs.symlinkSync(pessoal, path.join(raiz, '.agents', 'skills', 'revisar'), 'dir');
    assert.equal(conferirEspelhos(raiz).ok, false);
    gerarEspelhos(raiz);
    assert.equal(fs.readFileSync(path.join(pessoal, 'SKILL.md'), 'utf8'), 'minha\n');
    assert.equal(fs.readFileSync(path.join(pessoal, 'nota.md'), 'utf8'), 'nota\n');
    assert.equal(fs.lstatSync(path.join(raiz, '.agents', 'skills', 'revisar')).isSymbolicLink(), false);
    assert.equal(fs.readFileSync(path.join(raiz, '.agents', 'skills', 'revisar', 'SKILL.md'), 'utf8'), 'oficial\n');
    assert.equal(conferirEspelhos(raiz).ok, true);
    // subpasta virou link: mesma regra
    fs.rmSync(path.join(raiz, '.agents', 'skills', 'revisar', 'ref'), { recursive: true });
    fs.symlinkSync(pessoal, path.join(raiz, '.agents', 'skills', 'revisar', 'ref'), 'dir');
    gerarEspelhos(raiz);
    assert.deepEqual(fs.readdirSync(pessoal).sort(), ['SKILL.md', 'nota.md']);
    assert.equal(conferirEspelhos(raiz).ok, true);
    // .agents/skills inteira como link: recusa
    fs.rmSync(path.join(raiz, '.agents', 'skills'), { recursive: true });
    fs.symlinkSync(pessoal, path.join(raiz, '.agents', 'skills'), 'dir');
    assert.throws(() => gerarEspelhos(raiz));
    assert.deepEqual(fs.readdirSync(pessoal).sort(), ['SKILL.md', 'nota.md']);
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true });
    fs.rmSync(pessoal, { recursive: true, force: true });
  }
});

test('montar: rota com nome reservado do Windows é recusada em qualquer nível', () => {
  for (const ruim of ['con', 'aux', 'nul', 'servicos/lpt1', 'com9/x', 'prn']) assert.equal(validarRota(ruim), false, ruim);
  for (const boa of ['', 'a-casa', 'servicos/console', 'com10', 'contato', 'auxilio/lpt']) assert.equal(validarRota(boa), true, boa);
});
