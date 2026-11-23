// Apoio dos testes do comando publicar: roda o estúdio como processo, prepara um site de verdade
// e um serviço falso (servico-falso.mjs), e grava uma chave aceita como o login gravaria.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { subirServicoFalso } from './servico-falso.mjs';
import { gravarChave } from '../scripts/lib/publicar-guarda.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESPACHANTE = path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs');
export const MENSAGENS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'kit', 'mensagens.json'), 'utf8'));
export const NO_WINDOWS = process.platform === 'win32';
export const modo = (arquivo) => fs.statSync(arquivo).mode & 0o777;

export function rodar(args, env) {
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
export async function preparar(t, opcoes, envExtra = {}) {
  const servico = await subirServicoFalso(opcoes);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-publicar-'));
  const site = path.join(base, 'sites', 'meu-site', 'site');
  fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<title>Meu site</title><img src="assets/foto.txt">');
  fs.writeFileSync(path.join(site, 'assets', 'foto.txt'), crypto.randomBytes(3000).toString('base64'));
  const ferr = path.join(base, 'ferr');
  const env = {
    ESTUDIO_PUBLICAR_URL: servico.base, ESTUDIO_FERRAMENTAS: ferr, ESTUDIO_SITES: path.join(base, 'sites'),
    ESTUDIO_PUBLICAR_INTERVALO_MS: '20', ESTUDIO_PUBLICAR_PRAZO_MS: '300', ...envExtra,
  };
  t.after(async () => {
    await servico.fechar();
    fs.rmSync(base, { recursive: true, force: true });
  });
  return { servico, ferr, env, publicar: (...extra) => rodar(['publicar', 'meu-site', ...extra], env) };
}

// Chave aceita pelo serviço falso, gravada como o login gravaria.
export function darChave(ctx) {
  ctx.servico.estado.chaves.add('se_pub_chave-de-teste');
  gravarChave(ctx.servico.base, 'se_pub_chave-de-teste', '', ctx.ferr);
}
