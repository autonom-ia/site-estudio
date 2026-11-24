/* Site Estúdio: motor 3D pequeno, em WebGL puro (sem biblioteca, sem arquivo de modelo).
   Só é baixado quando a parte com 3D chega perto da tela (3d.js decide). As formas nascem de
   números: um perfil que gira (torno), um tubo entre dois pontos e um anel. Cada cena
   (<nome>-3d.js) usa este motor e se registra em window.Cena3D.cenas[<nome>].
   As cores vêm das variáveis da marca (tokens.css): a cena muda junto com a marca. */
(function () {
  'use strict';

  var MAX_PIXELS = 2; // densidade de tela máxima: acima disso o celular esquenta sem ganho visível

  /* ---------- contas de matriz 4x4 (coluna por coluna, como o WebGL lê) ---------- */

  function identidade() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function multiplicar(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c += 1) {
      for (var r = 0; r < 4; r += 1) {
        var s = 0;
        for (var k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }
  function compor() {
    var m = identidade();
    for (var i = 0; i < arguments.length; i += 1) m = multiplicar(m, arguments[i]);
    return m;
  }
  function perspectiva(fov, aspecto, perto, longe) {
    var f = 1 / Math.tan(fov / 2);
    var nf = 1 / (perto - longe);
    return new Float32Array([f / aspecto, 0, 0, 0, 0, f, 0, 0, 0, 0, (longe + perto) * nf, -1, 0, 0, 2 * longe * perto * nf, 0]);
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function normal(v) {
    var t = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / t, v[1] / t, v[2] / t];
  }
  function olharPara(olho, alvo) {
    var z = normal(sub(olho, alvo));
    var x = normal(cruz([0, 1, 0], z));
    var y = cruz(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * olho[0] + x[1] * olho[1] + x[2] * olho[2]),
      -(y[0] * olho[0] + y[1] * olho[1] + y[2] * olho[2]),
      -(z[0] * olho[0] + z[1] * olho[1] + z[2] * olho[2]),
      1,
    ]);
  }
  function girarX(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function girarY(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  function girarZ(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function mover(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  /* ---------- formas ---------- */

  // Perfil que gira em volta do eixo vertical: [[raio, altura], ...] de baixo para cima.
  // Um ponto repetido vira quina (a luz quebra ali, como na borda de uma tampa).
  function torno(perfil, lados) {
    var pos = [];
    var nor = [];
    var idx = [];
    var n = perfil.length;
    var mesmo = function (a, b) { return a[0] === b[0] && a[1] === b[1]; };
    var normais = perfil.map(function (p, i) {
      var nx = 0;
      var ny = 0;
      var juntar = function (de, para) {
        var dr = para[0] - de[0];
        var dy = para[1] - de[1];
        var t = Math.hypot(dr, dy) || 1;
        nx += dy / t;
        ny -= dr / t;
      };
      if (i > 0 && !mesmo(perfil[i - 1], p)) juntar(perfil[i - 1], p);
      if (i < n - 1 && !mesmo(perfil[i + 1], p)) juntar(p, perfil[i + 1]);
      var t = Math.hypot(nx, ny) || 1;
      return [nx / t, ny / t];
    });
    for (var i = 0; i < n; i += 1) {
      for (var j = 0; j <= lados; j += 1) {
        var a = (j / lados) * Math.PI * 2;
        var c = Math.cos(a);
        var s = Math.sin(a);
        pos.push(perfil[i][0] * c, perfil[i][1], perfil[i][0] * s);
        nor.push(normais[i][0] * c, normais[i][1], normais[i][0] * s);
      }
    }
    for (var k = 0; k < n - 1; k += 1) {
      if (mesmo(perfil[k], perfil[k + 1])) continue;
      for (var m = 0; m < lados; m += 1) {
        var p0 = k * (lados + 1) + m;
        var p1 = p0 + lados + 1;
        idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    }
    return { pos: pos, nor: nor, idx: idx };
  }

  // Tampo plano deitado (y = 0), de x0 a x1 e de z0 (fundo) a z1 (frente): a bancada.
  function plano(x0, x1, z0, z1) {
    return {
      pos: [x0, 0, z0, x1, 0, z0, x0, 0, z1, x1, 0, z1],
      nor: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      idx: [0, 2, 1, 1, 2, 3],
    };
  }

  // Tubo reto entre dois pontos (um raio de roda, uma haste).
  function tubo(a, b, raio, lados) {
    var d = normal(sub(b, a));
    var u = normal(cruz(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    var v = cruz(d, u);
    var pos = [];
    var nor = [];
    var idx = [];
    [a, b].forEach(function (centro) {
      for (var j = 0; j <= lados; j += 1) {
        var ang = (j / lados) * Math.PI * 2;
        var c = Math.cos(ang);
        var s = Math.sin(ang);
        var nn = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
        pos.push(centro[0] + nn[0] * raio, centro[1] + nn[1] * raio, centro[2] + nn[2] * raio);
        nor.push(nn[0], nn[1], nn[2]);
      }
    });
    for (var m = 0; m < lados; m += 1) idx.push(m, m + lados + 1, m + 1, m + lados + 1, m + lados + 2, m + 1);
    return { pos: pos, nor: nor, idx: idx };
  }

  // Anel deitado no chão, em volta do eixo vertical (aro, pneu, faixa).
  function anel(raioGrande, raioPequeno, ladosGrande, ladosPequeno) {
    var pos = [];
    var nor = [];
    var idx = [];
    for (var i = 0; i <= ladosGrande; i += 1) {
      var a = (i / ladosGrande) * Math.PI * 2;
      for (var j = 0; j <= ladosPequeno; j += 1) {
        var b = (j / ladosPequeno) * Math.PI * 2;
        var nx = Math.cos(b) * Math.cos(a);
        var ny = Math.sin(b);
        var nz = Math.cos(b) * Math.sin(a);
        pos.push((raioGrande + raioPequeno * Math.cos(b)) * Math.cos(a), raioPequeno * ny, (raioGrande + raioPequeno * Math.cos(b)) * Math.sin(a));
        nor.push(nx, ny, nz);
      }
    }
    for (var k = 0; k < ladosGrande; k += 1) {
      for (var m = 0; m < ladosPequeno; m += 1) {
        var p0 = k * (ladosPequeno + 1) + m;
        var p1 = p0 + ladosPequeno + 1;
        idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    }
    return { pos: pos, nor: nor, idx: idx };
  }

  function juntar(lista) {
    var pos = [];
    var nor = [];
    var idx = [];
    lista.forEach(function (g) {
      var base = pos.length / 3;
      for (var i = 0; i < g.pos.length; i += 1) {
        pos.push(g.pos[i]);
        nor.push(g.nor[i]);
      }
      for (var k = 0; k < g.idx.length; k += 1) idx.push(g.idx[k] + base);
    });
    return { pos: pos, nor: nor, idx: idx };
  }

  /* ---------- cor: qualquer cor que o CSS entende vira [r, g, b] de 0 a 1 ---------- */

  var pincel = null;
  function cor(valor) {
    if (Array.isArray(valor)) return valor;
    if (!pincel) {
      var tela = document.createElement('canvas');
      tela.width = 1;
      tela.height = 1;
      pincel = tela.getContext('2d', { willReadFrequently: true });
    }
    pincel.clearRect(0, 0, 1, 1);
    pincel.fillStyle = '#808080';
    pincel.fillStyle = String(valor || '').trim() || '#808080';
    pincel.fillRect(0, 0, 1, 1);
    var d = pincel.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  // Cor de uma variável da marca (ex.: '--cor-luz'), lida no elemento; sem ela, a reserva.
  function corDaMarca(elemento, variavel, reserva) {
    var v = getComputedStyle(elemento).getPropertyValue(variavel).trim();
    return cor(v || reserva);
  }
  function misturar(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* ---------- sombreamento ---------- */

  var VERTICE = [
    'attribute vec3 aPos;',
    'attribute vec3 aNor;',
    'uniform mat4 uModelo;',
    'uniform mat4 uVista;',
    'varying vec3 vNor;',
    'varying vec3 vPos;',
    'void main() {',
    '  vec4 p = uModelo * vec4(aPos, 1.0);',
    '  vPos = p.xyz;',
    '  vNor = mat3(uModelo) * aNor;',
    '  gl_Position = uVista * p;',
    '}',
  ].join('\n');

  // Luz de estúdio: céu e chão (luz que vem de cima e de baixo), uma luz principal, o brilho do
  // acabamento, o reflexo de duas janelas (o que faz o brilhante parecer brilhante) e a borda que
  // acende de lado. A primeira janela é alta e acende em peça deitada (a roda); a segunda é uma
  // janela comprida em pé, que acende em peça em pé (um cilindro, como a caramanhola, reflete o
  // que está ao lado, nunca o que está em cima) e só nos acabamentos com brilho. As cores entram e saem em sRGB, com a conta feita em luz linear; o fim
  // da conta amacia as luzes fortes como uma câmera (sem estourar o branco).
  var FRAGMENTO = [
    'precision mediump float;',
    'varying vec3 vNor;',
    'varying vec3 vPos;',
    'uniform vec3 uCor;',
    'uniform float uBrilho;',
    'uniform float uMetal;',
    'uniform float uAcende;',
    'uniform vec3 uOlho;',
    'uniform vec3 uCeu;',
    'uniform vec3 uChao;',
    'uniform vec3 uLuz;',
    'uniform float uForca;',
    'vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }',
    'void main() {',
    '  vec3 n = normalize(vNor);',
    '  vec3 v = normalize(uOlho - vPos);',
    '  if (dot(n, v) < 0.0) n = -n;',
    '  vec3 base = lin(uCor);',
    '  vec3 ceu = lin(uCeu);',
    '  vec3 chao = lin(uChao);',
    '  vec3 l = normalize(uLuz);',
    '  float dif = max(dot(n, l), 0.0);',
    '  vec3 ambiente = mix(chao, ceu, n.y * 0.5 + 0.5);',
    '  vec3 h = normalize(l + v);',
    '  float aperto = mix(12.0, 220.0, uBrilho);',
    '  float pontoDeLuz = pow(max(dot(n, h), 0.0), aperto) * mix(0.08, 1.6, uBrilho);',
    '  vec3 r = reflect(-v, n);',
    '  float janelaAlta = smoothstep(0.25, 0.55, r.y) * smoothstep(0.95, 0.6, abs(r.x + 0.35));',
    '  float janelaEmPe = smoothstep(0.24, 0.06, abs(r.x + 0.5)) * smoothstep(-0.5, 0.0, r.y) * smoothstep(0.7, 0.35, r.y) * uBrilho;',
    '  float janela = max(janelaAlta, janelaEmPe);',
    '  float borda = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
    '  vec3 reflexoCor = mix(vec3(1.0), base * 1.4 + 0.05, uMetal);',
    '  vec3 difuso = base * (ambiente * 0.5 + dif * uForca * 0.8) * (1.0 - uMetal * 0.75);',
    '  vec3 c = difuso;',
    '  c += reflexoCor * (pontoDeLuz * uForca + janela * mix(0.02, 0.55, uBrilho));',
    '  c += ceu * borda * mix(0.10, 0.45, uBrilho);',
    '  c += base * uAcende;',
    '  c = vec3(1.0) - exp(-c * 1.2);',
    '  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);',
    '}',
  ].join('\n');

  // Sombra macia no chão: um disco que some para as bordas.
  var VERTICE_SOMBRA = [
    'attribute vec2 aCanto;',
    'uniform mat4 uVista;',
    'uniform vec3 uCentro;',
    'uniform vec2 uRaio;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aCanto;',
    '  gl_Position = uVista * vec4(uCentro + vec3(aCanto.x * uRaio.x, 0.0, aCanto.y * uRaio.y), 1.0);',
    '}',
  ].join('\n');
  var FRAGMENTO_SOMBRA = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform vec3 uTom;',
    'uniform float uForcaSombra;',
    'void main() {',
    '  float d = length(vUv);',
    '  float a = (1.0 - smoothstep(0.0, 1.0, d)) * uForcaSombra;',
    '  a += (1.0 - smoothstep(0.0, 0.35, d)) * uForcaSombra * 0.6;',
    '  gl_FragColor = vec4(uTom * a, a);',
    '}',
  ].join('\n');

  function programa(gl, fonteVertice, fonteFragmento) {
    var compilar = function (tipo, fonte) {
      var s = gl.createShader(tipo);
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'sombreamento não compilou');
      return s;
    };
    var p = gl.createProgram();
    gl.attachShader(p, compilar(gl.VERTEX_SHADER, fonteVertice));
    gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, fonteFragmento));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'sombreamento não ligou');
    var u = {};
    var total = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < total; i += 1) {
      var info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }

  /* ---------- a cena ---------- */

  // Cria a cena dentro do palco (o elemento com data-3d). Devolve null se o WebGL não abrir:
  // a imagem de reserva continua no lugar.
  function criar(palco, opcoes) {
    var tela = document.createElement('canvas');
    tela.setAttribute('aria-hidden', 'true');
    var gl = null;
    try {
      gl = tela.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    } catch (e) {
      gl = null;
    }
    if (!gl) {
      palco.setAttribute('data-3d-motivo', 'sem-webgl');
      return null;
    }
    var p3d;
    var pSombra;
    try {
      p3d = programa(gl, VERTICE, FRAGMENTO);
      pSombra = programa(gl, VERTICE_SOMBRA, FRAGMENTO_SOMBRA);
    } catch (e) {
      // não some calado: o checar mostra como erro-de-script, e a reserva fica no lugar
      palco.setAttribute('data-3d-motivo', 'falhou');
      console.error('Site Estúdio 3D: o desenho não compilou (' + palco.getAttribute('data-3d') + '): ' + (e && e.message));
      var perder = gl.getExtension('WEBGL_lose_context');
      if (perder) perder.loseContext();
      return null;
    }
    var canto = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, canto);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var cena = {
      palco: palco,
      tela: tela,
      gl: gl,
      objetos: [],
      sombra: null,
      camera: { fov: (opcoes && opcoes.fov) || 0.55, olho: [0, 0, 5], alvo: [0, 0, 0] },
      luz: { ceu: [1, 1, 1], chao: [0.4, 0.4, 0.4], direcao: [-0.6, 0.9, 0.7], forca: 1 },
      largura: 0,
      altura: 0,
      perdida: false,
      desenhada: false,
    };

    cena.malha = function (geo) {
      if (geo.pos.length / 3 > 65535) throw new Error('forma com pontos demais');
      var b = { n: geo.idx.length, pos: gl.createBuffer(), nor: gl.createBuffer(), idx: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.nor), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);
      return b;
    };
    // material: { cor: [r,g,b] ou cor do CSS, brilho 0..1, metal 0..1, acende 0..1, chao: true
    // para o que fica embaixo da sombra (a bancada: desenhada antes da sombra, que cai nela) }
    cena.objeto = function (geo, material) {
      var o = { malha: cena.malha(geo), matriz: identidade(), visivel: true, chao: Boolean(material.chao), material: { cor: cor(material.cor), brilho: material.brilho || 0, metal: material.metal || 0, acende: material.acende || 0 } };
      cena.objetos.push(o);
      return o;
    };
    // Disco de sombra no chão: centro [x,y,z], raio [x,z] e força (0..1).
    cena.chao = function (centro, raio, forca, tom) {
      cena.sombra = { centro: centro, raio: raio, forca: forca, tom: cor(tom || '#000') };
    };

    // Ajusta o tamanho da imagem ao tamanho do palco na tela. Devolve true se mudou.
    cena.ajustar = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXELS);
      var w = Math.max(1, Math.round(tela.clientWidth * dpr));
      var h = Math.max(1, Math.round(tela.clientHeight * dpr));
      if (w === cena.largura && h === cena.altura) return false;
      cena.largura = w;
      cena.altura = h;
      tela.width = w;
      tela.height = h;
      return true;
    };

    // Desenha os objetos com luz: só os do chão (chao: true) ou só os outros.
    var pintar = function (vista, doChao) {
      var lista = cena.objetos.filter(function (o) { return o.visivel && o.chao === doChao; });
      if (!lista.length) return;
      var cam = cena.camera;
      gl.useProgram(p3d.p);
      gl.enable(gl.DEPTH_TEST);
      gl.uniformMatrix4fv(p3d.u.uVista, false, vista);
      gl.uniform3fv(p3d.u.uOlho, cam.olho);
      gl.uniform3fv(p3d.u.uCeu, cena.luz.ceu);
      gl.uniform3fv(p3d.u.uChao, cena.luz.chao);
      gl.uniform3fv(p3d.u.uLuz, cena.luz.direcao);
      gl.uniform1f(p3d.u.uForca, cena.luz.forca);
      var aPos = gl.getAttribLocation(p3d.p, 'aPos');
      var aNor = gl.getAttribLocation(p3d.p, 'aNor');
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aNor);
      lista.forEach(function (o) {
        var m = o.material;
        gl.uniformMatrix4fv(p3d.u.uModelo, false, o.matriz);
        gl.uniform3fv(p3d.u.uCor, m.cor);
        gl.uniform1f(p3d.u.uBrilho, m.brilho);
        gl.uniform1f(p3d.u.uMetal, m.metal);
        gl.uniform1f(p3d.u.uAcende, m.acende);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.malha.pos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.malha.nor);
        gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.malha.idx);
        gl.drawElements(gl.TRIANGLES, o.malha.n, gl.UNSIGNED_SHORT, 0);
      });
      gl.disableVertexAttribArray(aPos);
      gl.disableVertexAttribArray(aNor);
    };

    cena.desenhar = function () {
      if (cena.perdida) return;
      cena.ajustar();
      gl.viewport(0, 0, cena.largura, cena.altura);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var cam = cena.camera;
      var vista = multiplicar(perspectiva(cam.fov, cena.largura / cena.altura, 0.1, 40), olharPara(cam.olho, cam.alvo));

      // a bancada primeiro, depois a sombra por cima dela, depois a peça
      pintar(vista, true);
      if (cena.sombra) {
        var s = cena.sombra;
        gl.useProgram(pSombra.p);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniformMatrix4fv(pSombra.u.uVista, false, vista);
        gl.uniform3fv(pSombra.u.uCentro, s.centro);
        gl.uniform2fv(pSombra.u.uRaio, s.raio);
        gl.uniform3fv(pSombra.u.uTom, s.tom);
        gl.uniform1f(pSombra.u.uForcaSombra, s.forca);
        var aCanto = gl.getAttribLocation(pSombra.p, 'aCanto');
        gl.bindBuffer(gl.ARRAY_BUFFER, canto);
        gl.enableVertexAttribArray(aCanto);
        gl.vertexAttribPointer(aCanto, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disableVertexAttribArray(aCanto);
        gl.disable(gl.BLEND);
      }
      pintar(vista, false);
      if (!cena.desenhada) {
        cena.desenhada = true;
        palco.setAttribute('data-3d-estado', 'pronta');
        palco.removeAttribute('data-3d-motivo');
      }
    };

    // Laço de quadros só enquanto o palco aparece na tela e a aba está à vista. "quadro(t)"
    // devolve true enquanto ainda há movimento; parado, o laço dorme até cena.acordar().
    var pedido = 0;
    var naTela = true;
    var quadro = function () { return false; };
    var passo = function (t) {
      pedido = 0;
      var continua = quadro(t);
      cena.desenhar();
      if (continua) cena.acordar();
    };
    // O primeiro quadro sai na hora: a peça já aparece na pose certa no primeiro desenho.
    cena.animar = function (fn) {
      quadro = fn;
      quadro(performance.now());
      cena.desenhar();
      cena.acordar();
    };
    cena.acordar = function () {
      if (pedido || !naTela || cena.perdida || document.visibilityState === 'hidden') return;
      pedido = requestAnimationFrame(passo);
    };
    // Todo ouvinte da cena (rolagem, ponteiro, escolhas) entra por aqui: parar() tira todos.
    var ouvidos = [];
    var vigias = [];
    cena.ouvir = function (alvo, evento, fn, op) {
      alvo.addEventListener(evento, fn, op);
      ouvidos.push([alvo, evento, fn, op]);
    };
    // Vigia da cena (ResizeObserver, IntersectionObserver): parar() desliga todos.
    cena.vigiar = function (vigia) {
      vigias.push(vigia);
    };
    // Para de vez: solta o desenho, tira o canvas, os vigias e os ouvintes; a reserva volta.
    cena.parar = function (motivo) {
      if (pedido) cancelAnimationFrame(pedido);
      pedido = 0;
      cena.perdida = true;
      vigias.forEach(function (v) { v.disconnect(); });
      vigias = [];
      ouvidos.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
      ouvidos = [];
      palco.setAttribute('data-3d-estado', 'reserva');
      palco.setAttribute('data-3d-motivo', motivo || 'parada');
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      if (tela.parentNode) tela.parentNode.removeChild(tela);
      criadas.delete(palco);
    };

    if ('IntersectionObserver' in window) {
      var naVista = new IntersectionObserver(function (entradas) {
        naTela = entradas[entradas.length - 1].isIntersecting;
        if (naTela) cena.acordar();
      });
      naVista.observe(palco);
      vigias.push(naVista);
    }
    cena.ouvir(document, 'visibilitychange', function () { cena.acordar(); });
    // Tamanho novo: desenha na hora (trocar o tamanho apaga a imagem, e a foto pode vir antes do quadro seguinte).
    if ('ResizeObserver' in window) {
      var medida = new ResizeObserver(function () {
        if (cena.ajustar()) cena.desenhar();
      });
      medida.observe(tela);
      vigias.push(medida);
    }
    cena.ouvir(tela, 'webglcontextlost', function (e) {
      e.preventDefault();
      cena.parar('desenho-perdido');
    });

    palco.appendChild(tela);
    criadas.set(palco, cena);
    return cena;
  }

  // A cena criada em cada palco (o carregador para a cena se a montagem falhar no meio).
  var criadas = new WeakMap();
  function cenaDo(palco) {
    return criadas.get(palco) || null;
  }

  window.Cena3D = {
    criar: criar,
    cenaDo: cenaDo,
    cenas: (window.Cena3D && window.Cena3D.cenas) || {},
    formas: { torno: torno, tubo: tubo, anel: anel, plano: plano, juntar: juntar },
    matriz: { identidade: identidade, compor: compor, girarX: girarX, girarY: girarY, girarZ: girarZ, mover: mover },
    cor: cor,
    corDaMarca: corDaMarca,
    misturar: misturar,
  };
})();
