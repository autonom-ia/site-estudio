/* Site Estúdio: pedido montado na página e enviado escrito no WhatsApp (o jeito "pedido-no-whatsapp"
   de kit/repertorio/como-usar.md). Copie para site/assets/js/pedido.js e carregue no fim da parte do
   pedido, com um script de src "${assets}js/pedido.js" e defer. A escolha, o texto e o visual são da
   parte que você escreve; esta peça só junta a mensagem, monta o link e avisa o leitor de tela.

   O que a parte escreve (só atributos; nenhum nome de classe é exigido):
     <form data-pedido data-whatsapp="5511900000000" data-mensagem="Olá! Quero encomendar na Oficina Raio.">
       data-whatsapp   o número com país e DDD, só dígitos (do fatos.md)
       data-mensagem   a frase de abertura, completa e sem dois-pontos no fim. É a mensagem inteira
                       quando nada foi escolhido, então diz sozinha o que a pessoa quer.
       Itens (o que dá para pedir, um por linha do fatos.md):
         <input type="checkbox" data-item="Câmara de ar aro 29">           entra se marcado
         <input type="number" min="0" value="0" data-item="Câmara de ar"> entra se maior que zero
         data-preco="35"   opcional, com fonte no fatos.md: a linha leva o valor e a mensagem o total
       Campos (o que a casa precisa saber):
         <input type="date" data-campo="Para o dia">                      entra se preenchido (dd/mm/aaaa)
         <input type="text" data-campo="Recado">                          entra se preenchido
         <input type="radio" name="t" value="Retirar na loja" data-campo="Entrega">  entra se marcado
     <p data-pedido-mensagem>…</p>      a mensagem visível. Nunca é região viva (sem aria-live): ela
                                        muda a cada letra digitada.
     <p data-pedido-aviso role="status"></p>  o que o leitor de tela fala: a mensagem pronta, só
                                        quando a pessoa termina um campo (o evento change) ou envia.
     <a data-pedido-enviar href="https://wa.me/<número>?text=<data-mensagem>">  o botão. O href já
                                        vem montado com a abertura: sem JavaScript, ele funciona.
     <span data-pedido-total></span>    opcional: o total, quando os itens têm preço.
     <button type="button" data-mais="<id do campo de número>"> e data-menos: opcionais.

   Nada vem marcado por esta peça: opção marcada por padrão só com um fato com fonte que a sustente.
   A mensagem nunca sai vazia e esta peça não escreve palavra nenhuma além dos rótulos e da abertura
   que a parte deu, então nenhuma palavra se repete por conta dela. */
(function (raiz) {
  'use strict';

  var ABERTURA_PADRAO = 'Olá! Quero fazer um pedido.';

  function limpo(texto) {
    return String(texto === undefined || texto === null ? '' : texto).trim();
  }

  // Rótulo sem dois-pontos no fim: quem põe os dois-pontos é a linha.
  function rotulo(texto) {
    var t = limpo(texto);
    while (t.endsWith(':')) t = t.slice(0, -1).trim();
    return t;
  }

  // "2026-12-25" (o valor do campo de data) vira "25/12/2026"; outro texto fica como veio.
  function formatarDia(valor) {
    var partes = limpo(valor).split('-');
    if (partes.length !== 3 || partes[0].length !== 4) return limpo(valor);
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function formatarPreco(valor) {
    var n = Number(valor);
    if (!Number.isFinite(n)) return '';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
    } catch (e) {
      return 'R$ ' + n.toFixed(2).split('.').join(',');
    }
  }

  // A mensagem: a abertura e, abaixo, uma linha por item escolhido, o total e uma por campo
  // preenchido. Sem nada escolhido, é só a abertura (nunca vazia, nunca terminada em dois-pontos).
  // itens: [{ nome, quantidade (opcional), preco (opcional) }]; campos: [{ rotulo, valor }].
  function montarMensagem(abertura, itens, campos) {
    var linhas = [rotulo(abertura) || ABERTURA_PADRAO];
    var total = 0;
    var temPreco = false;
    (itens || []).forEach(function (item) {
      var nome = rotulo(item.nome);
      if (!nome) return;
      var qtd = item.quantidade === undefined || item.quantidade === null ? 1 : Number(item.quantidade);
      if (!(qtd > 0)) return;
      var linha = '- ' + nome + (item.quantidade === undefined || item.quantidade === null ? '' : ': ' + qtd);
      if (item.preco !== undefined && item.preco !== null && Number.isFinite(Number(item.preco))) {
        temPreco = true;
        total += qtd * Number(item.preco);
        linha += ' (' + formatarPreco(qtd * Number(item.preco)) + ')';
      }
      linhas.push(linha);
    });
    if (temPreco) linhas.push('Total: ' + formatarPreco(total));
    (campos || []).forEach(function (campo) {
      var nome = rotulo(campo.rotulo);
      var valor = limpo(campo.valor);
      if (nome && valor) linhas.push(nome + ': ' + valor);
    });
    return linhas.join('\n');
  }

  function linkDoWhatsapp(numero, mensagem) {
    var digitos = '';
    for (var ch of limpo(numero)) if (ch >= '0' && ch <= '9') digitos += ch;
    return 'https://wa.me/' + digitos + '?text=' + encodeURIComponent(mensagem);
  }

  // Lê o formulário: itens escolhidos e campos preenchidos, na ordem em que aparecem.
  function lerFormulario(form) {
    var itens = [];
    var campos = [];
    var porRotulo = {};
    form.querySelectorAll('[data-item], [data-campo]').forEach(function (el) {
      var marcavel = el.type === 'checkbox' || el.type === 'radio';
      if (marcavel && !el.checked) return;
      if (el.hasAttribute('data-item')) {
        var item = { nome: el.getAttribute('data-item') || el.value };
        if (el.type === 'number') item.quantidade = Number(el.value) || 0;
        if (el.hasAttribute('data-preco')) item.preco = Number(el.getAttribute('data-preco'));
        itens.push(item);
        return;
      }
      var valor = el.type === 'date' ? formatarDia(el.value) : limpo(el.value);
      if (!valor) return;
      var nome = rotulo(el.getAttribute('data-campo'));
      if (porRotulo[nome]) porRotulo[nome].valor += ', ' + valor;
      else {
        porRotulo[nome] = { rotulo: nome, valor: valor };
        campos.push(porRotulo[nome]);
      }
    });
    return { itens: itens, campos: campos };
  }

  function totalDe(itens) {
    var soma = 0;
    var tem = false;
    itens.forEach(function (i) {
      if (i.preco === undefined || !Number.isFinite(i.preco)) return;
      tem = true;
      soma += (i.quantidade === undefined ? 1 : i.quantidade) * i.preco;
    });
    return tem ? formatarPreco(soma) : '';
  }

  function ligar(form, doc) {
    var dentro = form.closest('section') || doc;
    var acha = function (atributo) {
      return dentro.querySelector('[' + atributo + ']');
    };
    var saida = acha('data-pedido-mensagem');
    var aviso = acha('data-pedido-aviso');
    var enviar = acha('data-pedido-enviar');
    var total = acha('data-pedido-total');
    var atual = '';
    var atualizar = function () {
      var lido = lerFormulario(form);
      atual = montarMensagem(form.getAttribute('data-mensagem'), lido.itens, lido.campos);
      if (saida) saida.textContent = atual;
      if (total) total.textContent = totalDe(lido.itens);
      if (enviar) enviar.setAttribute('href', linkDoWhatsapp(form.getAttribute('data-whatsapp'), atual));
    };
    // o leitor de tela fala a mensagem pronta só quando a pessoa termina um campo ou envia
    var anunciar = function () {
      if (aviso) aviso.textContent = 'Mensagem pronta: ' + atual;
    };
    form.addEventListener('input', atualizar);
    form.addEventListener('change', function () {
      atualizar();
      anunciar();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (enviar) enviar.click();
    });
    if (enviar) enviar.addEventListener('click', function () {
      atualizar();
      anunciar();
    });
    dentro.querySelectorAll('[data-mais], [data-menos]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var mais = botao.hasAttribute('data-mais');
        var campo = doc.getElementById(botao.getAttribute(mais ? 'data-mais' : 'data-menos'));
        if (!campo) return;
        var min = campo.min === '' ? 0 : Number(campo.min);
        var max = campo.max === '' ? Infinity : Number(campo.max);
        var valor = (Number(campo.value) || 0) + (mais ? 1 : -1);
        campo.value = String(Math.min(max, Math.max(min, valor)));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    atualizar();
  }

  raiz.SitePedido = { montarMensagem: montarMensagem, formatarDia: formatarDia, linkDoWhatsapp: linkDoWhatsapp, ABERTURA_PADRAO: ABERTURA_PADRAO };
  if (raiz.document) raiz.document.querySelectorAll('form[data-pedido]').forEach(function (form) {
    ligar(form, raiz.document);
  });
})(typeof window !== 'undefined' ? window : globalThis);
