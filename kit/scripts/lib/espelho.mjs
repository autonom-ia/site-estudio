// Espelhos: AGENTS.md (fonte) → CLAUDE.md e .claude/skills/ (fonte) → .agents/skills/.
// O Claude Code lê CLAUDE.md e .claude/skills; o Codex lê AGENTS.md e .agents/skills.
// Uma fonte só, cópia idêntica byte a byte.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { listarArquivos, ehPasta } from './caminhos.mjs';

const hash = (arquivo) => crypto.createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');

// Como listarArquivos, mas sem seguir link: um link (inclusive quebrado) é listado como item, e o
// que está do outro lado nunca é visitado, sobrescrito nem apagado.
function listarSemSeguir(base, rel = '') {
  const saida = [];
  for (const nome of fs.readdirSync(path.join(base, rel)).sort()) {
    if (nome === '.DS_Store' || nome === 'Thumbs.db') continue;
    const r = rel ? `${rel}/${nome}` : nome;
    if (fs.lstatSync(path.join(base, r)).isDirectory()) saida.push(...listarSemSeguir(base, r));
    else saida.push(r);
  }
  return saida;
}

const ehLink = (caminho) => {
  try {
    return fs.lstatSync(caminho).isSymbolicLink();
  } catch {
    return false;
  }
};

// Primeiro link (simbólico ou junção) no caminho de "base" até base/rel, inclusive o último; '' se nenhum.
// O espelho nunca escreve nem apaga através de link: o que está do outro lado é da pessoa.
function linkNoCaminho(base, rel) {
  let atual = base;
  for (const parte of rel.split('/')) {
    atual = path.join(atual, parte);
    if (ehLink(atual)) return atual;
  }
  return '';
}

// Remove só o link. No Windows, link de pasta e junção saem com rmdir (sem tocar no alvo).
function tirarLink(link) {
  try {
    fs.unlinkSync(link);
  } catch {
    fs.rmdirSync(link);
  }
}

// .agents e .agents/skills como link: recusa em vez de escrever em pasta de fora do estúdio.
function exigirSemLink(raiz) {
  for (const dir of [path.join(raiz, '.agents'), path.join(raiz, '.agents', 'skills')]) {
    if (ehLink(dir)) throw new Error(`${path.relative(raiz, dir)} é um link: o espelho não escreve através dele`);
  }
}

function pares(raiz) {
  const fonte = path.join(raiz, '.claude', 'skills');
  const copia = path.join(raiz, '.agents', 'skills');
  const naFonte = listarArquivos(fonte);
  // Só as pastas de skill que existem na fonte entram no espelho. Skill que a pessoa pôs
  // só em .agents/skills (dela, para o Codex) não é sobra: fica como está.
  // Lista só dentro dessas pastas: a skill da pessoa (que pode ser link) nem é visitada.
  const naCopia = skillsAdministradas(naFonte).flatMap((skill) => {
    const alvo = path.join(copia, skill);
    if (!ehPasta(alvo)) return fs.existsSync(alvo) ? [skill] : []; // arquivo solto em skills/
    return listarSemSeguir(alvo).map((r) => `${skill}/${r}`);
  });
  return { fonte, copia, naFonte, naCopia };
}

export function conferirEspelhos(raiz) {
  const diferencas = [];
  const a = path.join(raiz, 'AGENTS.md');
  const c = path.join(raiz, 'CLAUDE.md');
  if (!fs.existsSync(a)) diferencas.push({ arquivo: 'AGENTS.md', problema: 'fonte ausente' });
  else if (!fs.existsSync(c)) diferencas.push({ arquivo: 'CLAUDE.md', problema: 'falta a cópia' });
  else if (hash(a) !== hash(c)) diferencas.push({ arquivo: 'CLAUDE.md', problema: 'diferente de AGENTS.md' });
  const { fonte, copia, naFonte, naCopia } = pares(raiz);
  if (!naFonte.length) diferencas.push({ arquivo: '.claude/skills', problema: 'fonte vazia ou ausente' });
  for (const r of naFonte) {
    if (linkNoCaminho(copia, r)) diferencas.push({ arquivo: `.agents/skills/${r}`, problema: 'link no caminho da cópia' });
    else if (!naCopia.includes(r)) diferencas.push({ arquivo: `.agents/skills/${r}`, problema: 'falta a cópia' });
    else if (ehLink(path.join(copia, ...r.split('/'))) || hash(path.join(fonte, ...r.split('/'))) !== hash(path.join(copia, ...r.split('/')))) {
      diferencas.push({ arquivo: `.agents/skills/${r}`, problema: 'diferente da fonte' });
    }
  }
  for (const r of naCopia) if (!naFonte.includes(r)) diferencas.push({ arquivo: `.agents/skills/${r}`, problema: 'sobra: não existe na fonte' });
  return { ok: diferencas.length === 0, diferencas, skills: naFonte.length };
}

// Gera as cópias. Devolve a lista do que foi escrito e apagado.
export function gerarEspelhos(raiz) {
  const escritos = [];
  const apagados = [];
  exigirSemLink(raiz);
  const a = path.join(raiz, 'AGENTS.md');
  if (fs.existsSync(a)) {
    fs.copyFileSync(a, path.join(raiz, 'CLAUDE.md'));
    escritos.push('CLAUDE.md');
  }
  const { fonte, copia, naFonte, naCopia } = pares(raiz);
  for (const r of naFonte) {
    const de = path.join(fonte, ...r.split('/'));
    const para = path.join(copia, ...r.split('/'));
    // link em qualquer ponto do caminho da cópia (a pasta da skill, uma subpasta ou o próprio
    // arquivo): sai só o link, o alvo fica intocado, e a cópia é escrita no lugar dele.
    const link = linkNoCaminho(copia, r);
    if (link) tirarLink(link);
    else if (fs.existsSync(para) && hash(de) === hash(para)) continue;
    fs.mkdirSync(path.dirname(para), { recursive: true });
    fs.copyFileSync(de, para);
    escritos.push(`.agents/skills/${r}`);
  }
  for (const r of naCopia) {
    if (naFonte.includes(r)) continue;
    const link = linkNoCaminho(copia, r);
    if (link) {
      // sobra através de link: some o link, nunca o que está do outro lado
      if (ehLink(link)) {
        tirarLink(link);
        apagados.push(`.agents/skills/${path.relative(copia, link).split(path.sep).join('/')}`);
      }
      continue;
    }
    const alvo = path.join(copia, ...r.split('/'));
    let st;
    try {
      st = fs.lstatSync(alvo);
    } catch {
      continue;
    }
    // era um link que já virou pasta de verdade neste mesmo passo: a pasta é do espelho
    if (st.isDirectory()) continue;
    fs.rmSync(alvo, { force: true });
    apagados.push(`.agents/skills/${r}`);
  }
  // pastas que ficaram vazias depois de apagar sobras, só dentro das skills do estúdio
  for (const skill of skillsAdministradas(naFonte)) limparVazias(path.join(copia, skill));
  return { escritos, apagados };
}

const skillsAdministradas = (naFonte) => [...new Set(naFonte.map((r) => r.split('/')[0]))];

// Apaga as subpastas vazias. Usa lstat: link (inclusive quebrado) não é atravessado nem apagado.
function limparVazias(dir) {
  let st;
  try {
    st = fs.lstatSync(dir);
  } catch {
    return;
  }
  if (!st.isDirectory()) return;
  for (const nome of fs.readdirSync(dir)) {
    const c = path.join(dir, nome);
    if (!fs.lstatSync(c).isDirectory()) continue;
    limparVazias(c);
    if (!fs.readdirSync(c).length) fs.rmdirSync(c);
  }
}
