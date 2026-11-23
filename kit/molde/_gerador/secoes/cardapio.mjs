// O que a casa vende, como uma lista tipográfica: nome, descrição e preço, separados por fio.
// Todo preço também está em fatos.md, com a fonte.
export default function cardapio({ esc }) {
  const grupos = [
    ['Do forno', [
      ['Pão de fermentação natural', 'Casca grossa, miolo úmido. Sai às sete e às onze.', 'R$ 18,00'],
      ['Pão de milho', 'Com fubá de moinho de pedra e um fio de mel.', 'R$ 14,00'],
      ['Brioche da casa', 'Manteiga, ovos caipiras e paciência.', 'R$ 16,00'],
    ]],
    ['Para acompanhar', [
      ['Café coado', 'Grão do mês, moído na hora.', 'R$ 9,00'],
      ['Pingado', 'Café coado com leite vaporizado.', 'R$ 8,00'],
      ['Torrada na chapa', 'Pão da casa com manteiga de garrafa.', 'R$ 12,00'],
    ]],
  ];
  return `<section class="cardapio" id="cardapio" data-secao="cardapio" data-molde="cardapio" aria-labelledby="cardapio-titulo">
  <div class="envelope cardapio__grade">
    <div class="cardapio__cabeca">
      <h2 id="cardapio-titulo">O que sai do forno</h2>
      <p>Cardápio curto de propósito. Quando acaba, acabou: amanhã tem mais.</p>
    </div>
    <div class="cardapio__listas">
      ${grupos.map(([titulo, itens]) => `<div class="cardapio__grupo" data-revela>
        <h3>${esc(titulo)}</h3>
        <ul>
          ${itens.map(([nome, desc, preco]) => `<li><span class="item__nome">${esc(nome)}</span><span class="item__preco">${esc(preco)}</span><span class="item__desc">${esc(desc)}</span></li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>`;
}
