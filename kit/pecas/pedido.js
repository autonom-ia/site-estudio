/* Site Estúdio: pedido montado na página e enviado escrito no WhatsApp (o jeito "pedido-no-whatsapp"
   de kit/repertorio/como-usar.md). Copie para site/assets/js/pedido.js e carregue no fim da parte do
   pedido, com um script de src "${assets}js/pedido.js" e defer. A escolha, o texto e o visual são da
   parte que você escreve; esta peça só junta a mensagem, monta o link e avisa o leitor de tela.
   Ela não acrescenta palavra nenhuma: o texto da abertura e dos rótulos é do autor da parte.

   Tudo fica DENTRO do próprio <form data-pedido>: a peça procura cada peça a partir do formulário,
   então dois pedidos na mesma página (ou na mesma parte) não se misturam.
     <form data-pedido data-whatsapp="5511900000000" data-mensagem="Olá! Quero encomendar na Oficina Raio.">
       data-whatsapp   o número com país e DDD (do fatos.md). Sem dígito nenhum, a peça não mexe no
                       link e o ./estudio checar reprova (pedido-sem-whatsapp).
       data-mensagem   a frase de abertura, completa e sem dois-pontos no fim. É a mensagem inteira
                       quando nada foi escolhido, então diz sozinha o que a pessoa quer.
       Itens (o que dá para pedir, um por linha do fatos.md). O nome vem SEMPRE de data-item; item
       sem nome não entra (e o checar reprova: pedido-opcao-sem-valor):
         <input type="checkbox" data-item="Câmara de ar aro 29">                   entra se marcado
         <input type="number" min="0" step="1" value="0" data-item="Câmara de ar"> entra com 1 ou mais
         Quantidade só vale inteira e maior que zero: a mesma regra serve para a linha e para o total.
         data-preco="35"   opcional, com fonte no fatos.md: a linha leva o valor e a mensagem o total
       Campos (o que a casa precisa saber):
         <input type="date" data-campo="Para o dia">                     entra se preenchido (dd/mm/aaaa)
         <input type="text" data-campo="Recado">                         entra se preenchido
         <input type="radio" name="e" data-campo="Entrega" data-valor="Retirar na loja">  entra se marcado
         Caixa de marcar e botão de rádio dizem o que valem em data-valor (sem ele, a opção é recusada:
         o navegador mandaria "on").
       <p data-pedido-mensagem>…</p>  a mensagem visível, uma linha por item: dê a ele
                                      white-space: pre-line no CSS. Nunca é região viva (sem aria-live):
                                      ela muda a cada letra digitada.
       <p data-pedido-aviso role="status"></p>  o que o leitor de tela fala: a mensagem pronta, só
                                      quando a pessoa termina um campo (o evento change) ou envia.
       <a data-pedido-enviar href="${whatsapp(numero, abertura)}">  o botão. O href nasce no gerador
                                      com whatsapp() do ctx, que codifica o texto (sem JavaScript, um
                                      &, # ou + cru cortaria a mensagem). A peça refaz o href a cada mudança.
       <span data-pedido-total></span>  opcional: o total, quando os itens têm preço.
       <button type="button" data-mais="<id do campo de número>"> e data-menos: opcionais.
     </form>

   Nada vem marcado por esta peça: opção marcada por padrão só com um fato com fonte que a sustente.
   A mensagem nunca sai vazia e nenhuma palavra se repete por conta da peça. */
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
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    } catch (e) {
      return 'R$ ' + valor.toFixed(2).split('.').join(',');
    }
  }

  function temValor(v) {
    return v !== undefined && v !== null;
  }

  // O único filtro de itens: nome escrito e, se tem quantidade, inteira e maior que zero; preço, se
  // veio, é número. A linha da mensagem e o total saem desta mesma lista, então sempre batem.
  function itensValidos(itens) {
    var lista = [];
    (itens || []).forEach(function (item) {
      var nome = rotulo(item && item.nome);
      if (!nome) return;
      var comQuantidade = temValor(item.quantidade);
      var qtd = comQuantidade ? Number(item.quantidade) : 1;
      if (!Number.isInteger(qtd) || qtd <= 0) return;
      var preco = temValor(item.preco) && Number.isFinite(Number(item.preco)) ? Number(item.preco) : null;
      lista.push({ nome: nome, quantidade: qtd, comQuantidade: comQuantidade, preco: preco });
    });
    return lista;
  }

  // O total dos itens válidos com preço; '' quando nenhum tem preço.
  function totalDe(itens) {
    var validos = itensValidos(itens).filter(function (i) {
      return i.preco !== null;
    });
    if (!validos.length) return '';
    return formatarPreco(validos.reduce(function (soma, i) {
      return soma + i.quantidade * i.preco;
    }, 0));
  }

  // A mensagem: a abertura e, abaixo, uma linha por item válido, o total e uma por campo
  // preenchido. Sem nada escolhido, é só a abertura (nunca vazia, nunca terminada em dois-pontos).
  // itens: [{ nome, quantidade (opcional), preco (opcional) }]; campos: [{ rotulo, valor }].
  function montarMensagem(abertura, itens, campos) {
    var linhas = [rotulo(abertura) || ABERTURA_PADRAO];
    itensValidos(itens).forEach(function (i) {
      var linha = '- ' + i.nome + (i.comQuantidade ? ': ' + i.quantidade : '');
      if (i.preco !== null) linha += ' (' + formatarPreco(i.quantidade * i.preco) + ')';
      linhas.push(linha);
    });
    var total = totalDe(itens);
    if (total) linhas.push('Total: ' + total);
    (campos || []).forEach(function (campo) {
      var nome = rotulo(campo.rotulo);
      var valor = limpo(campo.valor);
      if (nome && valor) linhas.push(nome + ': ' + valor);
    });
    return linhas.join('\n');
  }

  function digitos(numero) {
    var saida = '';
    for (var ch of limpo(numero)) if (ch >= '0' && ch <= '9') saida += ch;
    return saida;
  }

  // O endereço do WhatsApp com o texto codificado; '' quando o número não tem dígito nenhum.
  function linkDoWhatsapp(numero, mensagem) {
    var n = digitos(numero);
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(mensagem) : '';
  }

  // O que uma caixa de marcar ou um botão de rádio vale: data-valor, nunca o "on" do navegador.
  function valorDaOpcao(el) {
    return limpo(el.getAttribute('data-valor'));
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
        var item = { nome: el.getAttribute('data-item') };
        if (el.type === 'number') item.quantidade = el.value === '' ? 0 : Number(el.value);
        if (el.hasAttribute('data-preco')) item.preco = Number(el.getAttribute('data-preco'));
        itens.push(item);
        return;
      }
      var valor = marcavel ? valorDaOpcao(el) : el.type === 'date' ? formatarDia(el.value) : limpo(el.value);
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

  function ligar(form) {
    var acha = function (atributo) {
      return form.querySelector('[' + atributo + ']');
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
      var link = linkDoWhatsapp(form.getAttribute('data-whatsapp'), atual);
      if (enviar && link) enviar.setAttribute('href', link);
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
    form.querySelectorAll('input[type="number"][data-item]').forEach(function (campo) {
      if (campo.min === '') campo.min = '0';
      if (campo.step === '') campo.step = '1';
    });
    form.querySelectorAll('[data-mais], [data-menos]').forEach(function (botao) {
      botao.addEventListener('click', function () {
        var mais = botao.hasAttribute('data-mais');
        var id = botao.getAttribute(mais ? 'data-mais' : 'data-menos');
        var campo = Array.prototype.find.call(form.querySelectorAll('[id]'), function (el) {
          return el.id === id;
        });
        if (!campo) return;
        var min = campo.min === '' ? 0 : Number(campo.min);
        var max = campo.max === '' ? Infinity : Number(campo.max);
        var valor = Math.trunc(Number(campo.value) || 0) + (mais ? 1 : -1);
        campo.value = String(Math.min(max, Math.max(min, valor)));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    atualizar();
  }

  raiz.SitePedido = {
    montarMensagem: montarMensagem,
    totalDe: totalDe,
    formatarDia: formatarDia,
    linkDoWhatsapp: linkDoWhatsapp,
    ABERTURA_PADRAO: ABERTURA_PADRAO,
  };
  if (raiz.document) raiz.document.querySelectorAll('form[data-pedido]').forEach(ligar);
})(typeof window !== 'undefined' ? window : globalThis);
