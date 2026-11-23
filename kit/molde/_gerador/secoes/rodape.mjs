// Rodapé de todas as páginas: a assinatura grande, o menu de novo e a nota do exemplo.
// A nota é do molde: apague o parágrafo inteiro (com o data-molde) no site de verdade.
export default function rodape({ site, paginas, esc, link }) {
  return `<footer class="rodape">
  <div class="envelope">
    <p class="rodape__assinatura" aria-hidden="true">${esc(site.nome)}</p>
    <nav class="rodape__menu" aria-label="Rodapé">
      <ul>
        ${paginas.map((p) => `<li><a href="${link(p.rota)}">${esc(p.menu)}</a></li>`).join('\n        ')}
        <li><a href="${link('/#visita')}">Como chegar</a></li>
      </ul>
    </nav>
    <p class="rodape__nota" data-molde="rodape">Site de exemplo do Site Estúdio, feito para um negócio fictício. Troque todo o texto, as cores e as fotos pelos do seu.</p>
  </div>
</footer>`;
}
