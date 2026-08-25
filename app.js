/* 1. CONFIGURACIÓN Y PERSISTENCIA (localStorage) */
const CONFIG_POR_DEFECTO = { pinDocente: '1234', velocidadMetronomo: 100, ritmoInicial: 'FV' };
const ConfigManager = {
  cargar: function() {
    const configGuardada = localStorage.getItem('simulador_dea_config');
    if (configGuardada) {
      try { return { ...CONFIG_POR_DEFECTO, ...JSON.parse(configGuardada) }; } catch (e) { return { ...CONFIG_POR_DEFECTO }; }
    }
    this.guardar(CONFIG_POR_DEFECTO); return { ...CONFIG_POR_DEFECTO };
  },
  guardar: function(nuevaConfig) { localStorage.setItem('simulador_dea_config', JSON.stringify(nuevaConfig)); },
  actualizarCampo: function(clave, valor) {
    const configActual = this.cargar(); configActual[clave] = valor; this.guardar(configActual);
  }
};
let configApp = ConfigManager.cargar();

/* 2. CATÁLOGO DE RITMOS Y ESTADO GLOBAL */
const CATALOGO_RITMOS = {
  FV: { id: 'FV', nombre: 'Fibrilación Ventricular', esDesfibrilable: true },
  TV: { id: 'TV', nombre: 'Taquicardia Ventricular', esDesfibrilable: true },
  ASISTOLIA: { id: 'ASISTOLIA', nombre: 'Asistolia', esDesfibrilable: false },
  AESP: { id: 'AESP', nombre: 'AESP', esDesfibrilable: false },
  SINUSAL: { id: 'SINUSAL', nombre: 'Ritmo Sinusal', esDesfibrilable: false }
};
let estadoSimulador = { encendido: false, faseActual: 'apagado', ritmoActual: CATALOGO_RITMOS[configApp.ritmoInicial], siguienteRitmo: CATALOGO_RITMOS[configApp.ritmoInicial], esperandoConector: false, esperandoDescarga: false };

/* 3. SÍNTESIS DE VOZ */
let vozEspaniol = null;
function cargarVoces() {
  const voces = window.speechSynthesis.getVoices();
  vozEspaniol = voces.find(v => v.lang === 'es-ES') || voces.find(v => v.lang.startsWith('es'));
}
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) { speechSynthesis.onvoiceschanged = cargarVoces; }
cargarVoces();

function decir(texto, alTerminar = null) {
  window.speechSynthesis.cancel();
  if (!texto) return;
  const mensaje = new SpeechSynthesisUtterance(texto);
  if (vozEspaniol) mensaje.voice = vozEspaniol;
  mensaje.lang = 'es-ES'; mensaje.rate = 0.95; mensaje.pitch = 0.90;
  mensaje.onend = () => { if (typeof alTerminar === 'function') alTerminar(); };
  window.speechSynthesis.speak(mensaje);
}
function callarDEA() { window.speechSynthesis.cancel(); }

/* 4. AUDIO NATIVO (METRÓNOMO) */
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let temporizadorMetronomo = null; let temporizadorRCP = null; let tiempoRestanteRCP = 120;

function reproducirPitidoMetronomo(frecuencia = 800, duracion = 0.05) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const oscilador = audioCtx.createOscillator(); const ganancia = audioCtx.createGain();
  oscilador.type = 'sine'; oscilador.frequency.setValueAtTime(frecuencia, audioCtx.currentTime);
  ganancia.gain.setValueAtTime(0.3, audioCtx.currentTime); ganancia.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion);
  oscilador.connect(ganancia); ganancia.connect(audioCtx.destination);
  oscilador.start(audioCtx.currentTime); oscilador.stop(audioCtx.currentTime + duracion);
}
function cambiarVelocidadMetronomo(lpm) {
  detenerMetronomo(); configApp.velocidadMetronomo = lpm; ConfigManager.actualizarCampo('velocidadMetronomo', lpm);
  const intervaloMs = 60000 / lpm; reproducirPitidoMetronomo(); temporizadorMetronomo = setInterval(reproducirPitidoMetronomo, intervaloMs);
}
function detenerMetronomo() { if (temporizadorMetronomo) { clearInterval(temporizadorMetronomo); temporizadorMetronomo = null; } }

/* 5. LÓGICA PRINCIPAL DEL DEA */
function inicializarSimulador() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  // Restablecer la imagen al estado "sin conectar"
  const contenedorDea = document.querySelector('.contenedor-dea');
  if (contenedorDea) contenedorDea.style.backgroundImage = "url('img/dea-fondo.jpg')";

  estadoSimulador.encendido = true; estadoSimulador.faseActual = 'espera'; estadoSimulador.esperandoConector = true;
  estadoSimulador.ritmoActual = CATALOGO_RITMOS[configApp.ritmoInicial]; estadoSimulador.siguienteRitmo = CATALOGO_RITMOS[configApp.ritmoInicial];
  decir("Unidad operativa. Pida ayuda. Retire la ropa del pecho del paciente.", () => {
    setTimeout(() => { decir("Coloque los parches sobre el pecho desnudo del paciente. Enchufe el conector."); }, 2000);
  });
}
function iniciarAnalisis() {
  estadoSimulador.faseActual = 'analizando'; estadoSimulador.ritmoActual = estadoSimulador.siguienteRitmo;
  setTimeout(() => {
    if (estadoSimulador.ritmoActual.esDesfibrilable) { iniciarCargaEnergia(); } else { decir("No se recomienda descarga.", () => { setTimeout(iniciarCicloRcp, 1000); }); }
  }, 4000);
}
function iniciarCargaEnergia() {
  estadoSimulador.faseActual = 'cargando';
  decir("Se recomienda descarga. Cargando energía.", () => {
    setTimeout(() => {
      const botonDescarga = document.getElementById('boton-descarga');
      if(botonDescarga) botonDescarga.classList.add('activo');
      estadoSimulador.esperandoDescarga = true;
      decir("No se acerque al paciente. Pulse el botón naranja parpadeante.");
    }, 3000);
  });
}
function iniciarCicloRcp() {
  estadoSimulador.faseActual = 'rcp'; tiempoRestanteRCP = 120;
  decir("Si es necesario, inicie la reanimación cardiopulmonar.", () => {
    cambiarVelocidadMetronomo(configApp.velocidadMetronomo);
    temporizadorRCP = setInterval(() => {
      tiempoRestanteRCP--; if (tiempoRestanteRCP === 60) decir("Continúe la RCP.");
      if (tiempoRestanteRCP <= 0) finalizarCicloRcp();
    }, 1000);
  });
}
function finalizarCicloRcp() { clearInterval(temporizadorRCP); detenerMetronomo(); decir("No toque al paciente. Analizando el ritmo cardíaco.", () => { iniciarAnalisis(); }); }

/* 6. INTERACCIONES DEL ALUMNO (UI) */
document.getElementById('boton-on')?.addEventListener('click', () => { inicializarSimulador(); });

document.getElementById('zona-conector')?.addEventListener('click', () => {
  if (!estadoSimulador.esperandoConector) return;
  
  estadoSimulador.esperandoConector = false; callarDEA(); 
  
  // Cambiar la imagen al estado "conectado"
  const contenedorDea = document.querySelector('.contenedor-dea');
  if (contenedorDea) contenedorDea.style.backgroundImage = "url('img/dea-conectado.jpg')";

  decir("No toque al paciente. Analizando el ritmo cardíaco.", () => { iniciarAnalisis(); });
});

const btnDescarga = document.getElementById('boton-descarga');
btnDescarga?.addEventListener('click', () => {
  if (!estadoSimulador.esperandoDescarga) return;
  estadoSimulador.esperandoDescarga = false; btnDescarga.classList.remove('activo'); callarDEA();
  decir("Descarga administrada.", () => { setTimeout(iniciarCicloRcp, 1000); });
});

/* 7. PANEL DOCENTE Y EVENTOS EN TIEMPO REAL */
let timerPulsacion; const logo = document.getElementById('logo-dea');
logo?.addEventListener('touchstart', iniciarPulsacion); logo?.addEventListener('mousedown', iniciarPulsacion);
logo?.addEventListener('touchend', cancelarPulsacion); logo?.addEventListener('mouseup', cancelarPulsacion); logo?.addEventListener('touchmove', cancelarPulsacion);
function iniciarPulsacion() { timerPulsacion = setTimeout(() => { document.getElementById('panel-docente').style.transform = 'translateX(0)'; }, 2000); }
function cancelarPulsacion() { clearTimeout(timerPulsacion); }
function docenteCambiarRitmo(nuevoRitmoId) { estadoSimulador.siguienteRitmo = CATALOGO_RITMOS[nuevoRitmoId]; }
function docenteForzarAnalisis() { if (estadoSimulador.faseActual === 'rcp') { tiempoRestanteRCP = 0; finalizarCicloRcp(); } }
function docenteFalloParches() {
  detenerMetronomo(); clearInterval(temporizadorRCP); estadoSimulador.faseActual = 'espera'; estadoSimulador.esperandoConector = true; 
  
  // Volver a la imagen "sin conectar" para forzar al alumno
  const contenedorDea = document.querySelector('.contenedor-dea');
  if (contenedorDea) contenedorDea.style.backgroundImage = "url('img/dea-fondo.jpg')";

  decir("Compruebe los parches. Asegure el conector.");
}

/* 8. SERVICE WORKER (OFFLINE) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW registrado')).catch(err => console.error('Error SW', err));
  });
}