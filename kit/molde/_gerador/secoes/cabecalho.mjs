// Cabeçalho de todas as páginas: a marca e o menu. aria-current marca a página aberta.
export default function cabecalho({ site, paginas, pagina, esc, link, assets }) {
  const itens = [
    ...paginas.filter((p) => p.rota !== pagina.rota && p.menu).map((p) => ({ href: link(p.rota), texto: p.menu })),
    { href: link('/#servicos'), texto: 'Preços' },
    { href: link('/#visita'), texto: 'Onde fica' },
  ];
  return `<header class="topo" data-molde="cabecalho">
  <div class="envelope topo__linha">
    <a class="topo__marca" href="${link('')}"${pagina.rota === '' ? ' aria-current="page"' : ''}>
      <img src="${assets}img/icone.svg" alt="" width="28" height="28">
      <span>${esc(site.nome)}</span>
    </a>
    <nav class="topo__menu" aria-label="Principal">
      <ul>
        ${itens.map((i) => `<li><a href="${i.href}">${esc(i.texto)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </div>
</header>`;
}
