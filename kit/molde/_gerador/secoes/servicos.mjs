// O que o negócio vende, como uma lista tipográfica: nome, descrição e preço, separados por fio.
// Todo preço também está em fatos.md, com a fonte.
export default function servicos({ esc }) {
  const grupos = [
    ['Revisão', [
      ['Revisão completa', 'Freio, câmbio, rodas, rolamentos e aperto geral.', 'R$ 180,00'],
      ['Lavagem e lubrificação', 'Corrente, coroa e cassete limpos e lubrificados.', 'R$ 50,00'],
      ['Montagem de bicicleta nova', 'Da caixa para a rua, regulada.', 'R$ 120,00'],
    ]],
    ['Ajustes', [
      ['Regulagem de freio e câmbio', 'Freio firme e marcha que entra sem ruído.', 'R$ 60,00'],
      ['Troca de câmara', 'Câmara nova e pneu conferido.', 'R$ 35,00'],
      ['Ajuste de selim e guidão', 'Altura e distância medidas no seu corpo.', 'R$ 90,00'],
    ]],
  ];
  return `<section class="servicos" id="servicos" data-secao="servicos" data-molde="servicos" aria-labelledby="servicos-titulo">
  <div class="envelope servicos__grade">
    <div class="servicos__cabeca">
      <h2 id="servicos-titulo">Quanto custa</h2>
      <p>Preço fechado na bancada, antes de começar. Peça, quando precisa, é à parte e mostrada antes.</p>
    </div>
    <div class="servicos__listas">
      ${grupos.map(([titulo, itens]) => `<div class="servicos__grupo" data-revela>
        <h3>${esc(titulo)}</h3>
        <ul>
          ${itens.map(([nome, desc, preco]) => `<li><span class="item__nome">${esc(nome)}</span><span class="item__preco">${esc(preco)}</span><span class="item__desc">${esc(desc)}</span></li>`).join('\n          ')}
        </ul>
      </div>`).join('\n      ')}
    </div>
  </div>
</section>`;
}
