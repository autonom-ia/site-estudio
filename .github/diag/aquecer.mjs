// Diagnóstico: quanto o Chrome leva para abrir e responder ao DevTools, três vezes seguidas,
// na máquina recém-criada do CI. Usa o mesmo launch do estúdio (mesmos argumentos e prazo).
import { launch } from '../../kit/scripts/lib/cdp.mjs';
for (let i = 1; i <= 3; i++) {
  const ini = Date.now();
  try {
    const nav = await launch({ com3d: true });
    console.log(`abertura ${i}: ${Date.now() - ini} ms`);
    await nav.fecharComCalma();
  } catch (e) {
    console.log(`abertura ${i}: falhou em ${Date.now() - ini} ms (${e.codigo || e.message})`);
  }
}
