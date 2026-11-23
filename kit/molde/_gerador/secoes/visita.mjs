// Onde e quando: o convite, os horários, o endereço e os dois contatos como ação.
// Telefone, e-mail e endereço também estão em fatos.md, com a fonte.
export default function visita({ esc, site }) {
  const n = site.negocio;
  const horarios = [
    ['Terça a sexta', 'das 9h às 18h'],
    ['Sábado', 'das 9h às 13h'],
    ['Domingo e segunda', 'fechada'],
  ];
  return `<section class="visita" id="visita" data-secao="visita" data-molde="visita" aria-labelledby="visita-titulo">
  <div class="envelope visita__grade">
    <div class="visita__convite" data-revela>
      <h2 id="visita-titulo">Passe na oficina.</h2>
      <p>Sem hora marcada também dá: a bancada olha na hora e passa o preço.</p>
    </div>
    <div class="visita__dados" data-revela>
      <h3 class="sobretitulo">Horários</h3>
      <dl class="horarios">
        ${horarios.map(([d, h]) => `<div><dt>${esc(d)}</dt><dd>${esc(h)}</dd></div>`).join('\n        ')}
      </dl>
      <h3 class="sobretitulo">Endereço</h3>
      <address>${esc(n.rua)}<br>${esc(n.bairro)}, ${esc(n.cidade)}, ${esc(n.estado)}</address>
      <div class="acoes">
        <a class="botao botao--escuro" href="tel:+551100000000">Ligar: (11) 0000-0000</a>
        <a class="botao-linha" href="mailto:${esc(n.email)}">${esc(n.email)}</a>
      </div>
    </div>
  </div>
</section>`;
}
