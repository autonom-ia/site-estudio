// Primeira tela da página inicial: a assinatura tipográfica da marca (o nome da promessa composto
// como cartaz, cada linha num peso), o que o negócio é em uma frase e a ação principal.
// As linhas da assinatura ganham peso uma a uma ao abrir (site.js). Sem movimento, já aparecem prontas.
export default function abertura({ esc, link }) {
  const linhas = [
    ['fina', 'Bicicleta'],
    ['pesada', 'no ponto,'],
    ['media', 'pronta no'],
    ['luz', 'mesmo dia.'],
  ];
  return `<section class="abertura" data-secao="abertura" data-molde="abertura" aria-labelledby="abertura-titulo">
  <div class="envelope abertura__grade">
    <h1 class="assinatura" id="abertura-titulo" data-assina>
      ${linhas.map(([peso, texto]) => `<span class="assinatura__linha assinatura__linha--${peso}">${esc(texto)}</span>`).join('\n      ')}
    </h1>
    <div class="abertura__lado">
      <p class="sobretitulo">Oficina de bicicletas na Vila Exemplo</p>
      <p class="abertura__lide">${esc('Revisão, freio, câmbio e câmara, em bicicleta de qualquer marca. O preço vem antes do serviço.')}</p>
      <div class="acoes">
        <a class="botao" href="tel:+551100000000">Agendar: (11) 0000-0000</a>
        <a class="botao-linha" href="${link('#servicos')}">Ver os preços</a>
      </div>
    </div>
  </div>
</section>`;
}
