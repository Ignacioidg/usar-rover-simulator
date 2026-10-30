// hotasController.js - Driver Web Gamepad API y Procesamiento de Señal para
// Joystick LOGITECH EXTREME 3D PRO (USB VID: 046d / PID: c215) y Joysticks HID Compatibles
// Grupo 4 UAI • Robótica y Tecnologías Emergentes (Octubre 2026)

(function () {
  const STORAGE_KEY = 'usar_rover_logitech_3dpro_config_v1';

  // Configuración por defecto optimizada para Logitech Extreme 3D Pro en Windows (Chrome/Edge/Firefox)
  const defaultConfig = {
    // Índices de ejes ('auto' detecta automáticamente entre layout 4-ejes [0,1,2,3] y layout Chromium HID 10-ejes [0,1,5,6,9])
    axisX: 0,           // Stick Izquierda / Derecha (Roll -> Dirección Fuelle)
    axisY: 1,           // Stick Adelante / Atrás (Pitch -> Avance / Reversa)
    axisTwist: 'auto',  // Rotación de puño Z (Rudder -> Eje 2 o Eje 5)
    axisThrottle: 'auto',// Palanca de gases en la base (Slider -> Eje 3 o Eje 6)
    axisHatPov: 'auto', // 8-Way POV Hat Switch (Eje 9 cuantizado en Chromium o Ejes 4/5)

    // Inversión de polaridad por eje
    invertX: false,
    invertY: false,
    invertTwist: false,
    invertThrottle: true, // En el Logitech Extreme 3D Pro hacia adelante (+) suele reportar -1.0 en Windows

    // Parámetros de filtrado e ingeniería de control
    deadzoneStick: 0.08,  // 8% para absorber holgura central del potenciómetro X/Y
    deadzoneTwist: 0.12,  // 12% para evitar giro involuntario de muñeca al inclinar el stick
    expoCurve: 0.35,      // 35% curva exponencial para maniobras finas entre escombros

    // Modos operativos del Logitech Extreme 3D Pro
    // 'stick_drive': Stick Y controla Avance/Reversa proporcional y la Palanca Throttle Base regula el límite de potencia PWM (25%-100%)
    // 'hotas_cruise': La Palanca Throttle Base fija la velocidad continua de crucero y el Stick Y da empuje momentáneo
    throttleMode: 'stick_drive',

    // Función del eje Twist Z (rotación de muñeca):
    // 'turret_and_steer': Gira la torreta Pan-Tilt horizontalmente y asiste un 35% la dirección
    // 'turret_pan': Controla la rotación horizontal (Yaw) de la torreta Pan-Tilt
    // 'rover_steer': Controla directamente la dirección articulada del rover
    // 'cam_orbit': Orbita la cámara exterior de 3ra persona
    twistMode: 'turret_and_steer'
  };

  let config = Object.assign({}, defaultConfig);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      config = Object.assign({}, defaultConfig, JSON.parse(saved));
    }
  } catch (err) {
    console.warn('No se pudo leer configuración HOTAS de localStorage:', err);
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      // Ignorar si el navegador bloquea localStorage en file://
    }
  }

  // Estado interno en tiempo real del joystick
  const state = {
    connected: false,
    gamepadIndex: null,
    id: '',
    isLogitech3DPro: false,
    axesRaw: [],
    buttonsPressed: new Array(16).fill(false),
    buttonsPrev: new Array(16).fill(false),
    buttonsJustPressed: new Array(16).fill(false),

    // Ejes efectivos resueltos por auto-detección
    resolvedTwistAxis: 2,
    resolvedThrottleAxis: 3,
    resolvedHatAxis: 9,
    throttleTouched: false,
    axisBaseline: null,

    // Valores procesados listos para el motor físico del Rover
    stickX: 0.0,         // -1 (Izquierda) a +1 (Derecha)
    stickY: 0.0,         // -1 (Atrás/Reversa) a +1 (Adelante/Avance)
    twistZ: 0.0,         // -1 (Giro Izq) a +1 (Giro Der)
    throttleSlider: 1.0, // 0.0 (Mínimo abajo) a 1.0 (Máximo arriba)
    throttleBipolar: 0.0,// -1.0 a +1.0
    cruiseReverse: false,// Marcha en modo crucero HOTAS (false = FWD, true = REV)

    // Vector del 8-Way POV Hat Switch (-1, 0, +1)
    hatX: 0.0,
    hatY: 0.0,
    hatDirectionLabel: 'CENTRADO',

    // Aprendizaje interactivo de ejes ("Detectar Eje")
    learningTarget: null, // 'axisX' | 'axisY' | 'axisTwist' | 'axisThrottle' | null
    learningBaseline: []
  };

  // Etiquetas de los 12 botones físicos del Logitech Extreme 3D Pro
  const BUTTON_DEFINITIONS = [
    { num: 1, group: 'Empuñadura', name: 'Gatillo (Trigger)', action: 'Freno de Emergencia (0% PWM)' },
    { num: 2, group: 'Empuñadura', name: 'Pulgar Lateral', action: 'Centrar Torreta Pan-Tilt (0°, 0°)' },
    { num: 3, group: 'Cabezal Izq. Sup.', name: 'Botón 3', action: 'Alternar Vista 1ra Persona (FPV) ↔ 3ra Persona' },
    { num: 4, group: 'Cabezal Der. Sup.', name: 'Botón 4', action: 'Alternar Estabilizador PID/SAS ↔ Manual' },
    { num: 5, group: 'Cabezal Izq. Inf.', name: 'Botón 5', action: 'Ciclar Reflectores LED (Off / Normal / Max)' },
    { num: 6, group: 'Cabezal Der. Inf.', name: 'Botón 6', action: 'Activar Escáner Láser 3D ToF / Micro-LiDAR' },
    { num: 7, group: 'Base Superior', name: 'Botón 7', action: 'Cambiar Tracción (8x8 → 6x6 → 4WD)' },
    { num: 8, group: 'Base Superior', name: 'Botón 8', action: 'Alternar Fuelle (Activo Servo ↔ Pasivo 3D)' },
    { num: 9, group: 'Base Media', name: 'Botón 9', action: 'Alternar Modo Derrumbe Oscuro / Luz Diurna' },
    { num: 10, group: 'Base Media', name: 'Botón 10', action: 'Mostrar / Ocultar Monitor Secundario PiP' },
    { num: 11, group: 'Base Inferior', name: 'Botón 11', action: 'Teletransportar a Siguiente Zona (1 → 4)' },
    { num: 12, group: 'Base Inferior', name: 'Botón 12', action: 'Cambiar Modo Throttle (Stick ↔ Crucero) / Nivelar' }
  ];

  // Función matemática de Zona Muerta + Curva Exponencial
  function applyDeadzoneAndExpo(raw, deadzone, expo) {
    if (!Number.isFinite(raw)) return 0;
    const abs = Math.abs(raw);
    if (abs <= deadzone) return 0;
    const sign = Math.sign(raw);
    const normalized = Math.min(1, (abs - deadzone) / Math.max(0.01, 1 - deadzone));
    return sign * ((1 - expo) * normalized + expo * (normalized * normalized * normalized));
  }

  // Decodifica el eje POV Hat cuantizado de DirectInput/Chromium (usualmente axes[9])
  // En Chromium Windows: Norte = -1.0, NE = -0.714, E = -0.429, SE = -0.143,
  // S = +0.143, SW = +0.429, O = +0.714, NO = +1.0, Centrado > 1.1 (ej. +3.2857)
  function decodeQuantizedHatAxis(val) {
    if (!Number.isFinite(val) || val > 1.08 || val < -1.08) {
      return { x: 0, y: 0, label: 'CENTRADO' };
    }
    // Convertir de [-1.0, +1.0] a índice 0..7 (cada paso es 2/7 = 0.285714)
    const step = Math.round(((val + 1.0) / 2.0) * 7);
    switch (step) {
      case 0: return { x: 0, y: 1, label: 'N (ARRIBA)' };
      case 1: return { x: 0.707, y: 0.707, label: 'NE' };
      case 2: return { x: 1, y: 0, label: 'E (DERECHA)' };
      case 3: return { x: 0.707, y: -0.707, label: 'SE' };
      case 4: return { x: 0, y: -1, label: 'S (ABAJO)' };
      case 5: return { x: -0.707, y: -0.707, label: 'SO' };
      case 6: return { x: -1, y: 0, label: 'O (IZQUIERDA)' };
      case 7: return { x: -0.707, y: 0.707, label: 'NO' };
      default: return { x: 0, y: 0, label: 'CENTRADO' };
    }
  }

  // Selecciona el mejor Gamepad conectado priorizando Logitech Extreme 3D Pro (046d:c215)
  function findBestGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;

    let fallbackPad = null;
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      const idLower = (gp.id || '').toLowerCase();
      if (
        idLower.includes('extreme 3d') ||
        idLower.includes('c215') ||
        idLower.includes('logitech') ||
        idLower.includes('046d')
      ) {
        return gp;
      }
      if (!fallbackPad) fallbackPad = gp;
    }
    return fallbackPad;
  }

  // Auto-resuelve los índices de Twist Z y Throttle Slider según el perfil de navegador
  function resolveAutoAxes(gp) {
    const axes = gp.axes || [];
    const len = axes.length;

    if (!state.axisBaseline || state.axisBaseline.length !== len) {
      state.axisBaseline = axes.slice();
      // En Chromium Windows con RawInput, el Logitech Extreme 3D Pro expone 10 ejes:
      // Eje 5 = Twist Rz, Eje 6 = Throttle Slider, Eje 9 = POV Hat
      if (len >= 9) {
        state.resolvedTwistAxis = 5;
        state.resolvedThrottleAxis = 6;
        state.resolvedHatAxis = 9;
      } else {
        state.resolvedTwistAxis = 2;
        state.resolvedThrottleAxis = 3;
        state.resolvedHatAxis = -1;
      }
    }

    // Detectar actividad real en ejes alternativos para adaptarse instantáneamente a cualquier driver
    if (len >= 6 && state.axisBaseline) {
      const delta2 = Math.abs((axes[2] || 0) - (state.axisBaseline[2] || 0));
      const delta5 = Math.abs((axes[5] || 0) - (state.axisBaseline[5] || 0));
      if (delta2 > 0.18 && delta5 < 0.05) state.resolvedTwistAxis = 2;
      else if (delta5 > 0.18 && delta2 < 0.05) state.resolvedTwistAxis = 5;
    }

    if (len >= 7 && state.axisBaseline) {
      const delta3 = Math.abs((axes[3] || 0) - (state.axisBaseline[3] || 0));
      const delta6 = Math.abs((axes[6] || 0) - (state.axisBaseline[6] || 0));
      if (delta3 > 0.15 && delta6 < 0.05) {
        state.resolvedThrottleAxis = 3;
        state.throttleTouched = true;
      } else if (delta6 > 0.15 && delta3 < 0.05) {
        state.resolvedThrottleAxis = 6;
        state.throttleTouched = true;
      }
    } else if (len >= 4 && state.axisBaseline) {
      const delta3 = Math.abs((axes[3] || 0) - (state.axisBaseline[3] || 0));
      if (delta3 > 0.12) state.throttleTouched = true;
    }
  }

  // Actualización cuadro a cuadro (60 Hz)
  function poll() {
    const gp = findBestGamepad();

    if (!gp) {
      const wasConnected = state.connected;
      state.connected = false;
      state.gamepadIndex = null;
      state.id = '';
      state.isLogitech3DPro = false;
      state.stickX = 0;
      state.stickY = 0;
      state.twistZ = 0;
      state.hatX = 0;
      state.hatY = 0;
      state.hatDirectionLabel = 'CENTRADO';
      state.buttonsJustPressed.fill(false);
      state.buttonsPressed.fill(false);
      return { connected: false, justDisconnected: wasConnected };
    }

    const justConnected = !state.connected || state.gamepadIndex !== gp.index;
    state.connected = true;
    state.gamepadIndex = gp.index;
    state.id = gp.id || 'Joystick USB Conectado';
    const idLow = state.id.toLowerCase();
    state.isLogitech3DPro =
      idLow.includes('extreme 3d') || idLow.includes('c215') || idLow.includes('logitech') || idLow.includes('046d');

    state.axesRaw = (gp.axes || []).map((v) => (Number.isFinite(v) ? v : 0));
    resolveAutoAxes(gp);

    // Si el usuario activó el modo "Aprender / Detectar Eje" en el modal de calibración
    if (state.learningTarget && state.learningBaseline.length === state.axesRaw.length) {
      let maxDelta = 0;
      let bestIdx = -1;
      for (let i = 0; i < state.axesRaw.length; i++) {
        if (i === 9) continue; // Ignorar POV Hat cuantizado al aprender ejes analógicos
        const d = Math.abs(state.axesRaw[i] - state.learningBaseline[i]);
        if (d > maxDelta) {
          maxDelta = d;
          bestIdx = i;
        }
      }
      if (maxDelta > 0.45 && bestIdx >= 0) {
        config[state.learningTarget] = bestIdx;
        if (state.learningTarget === 'axisThrottle') state.throttleTouched = true;
        state.learningTarget = null;
        saveConfig();
      }
    }

    // 1. Lectura de Eje X (Stick Roll -> Dirección del Rover)
    const idxX = config.axisX === 'auto' ? 0 : Number(config.axisX) || 0;
    const rawX = (state.axesRaw[idxX] || 0) * (config.invertX ? -1 : 1);
    state.stickX = applyDeadzoneAndExpo(rawX, config.deadzoneStick, config.expoCurve);

    // 2. Lectura de Eje Y (Stick Pitch -> Avance / Reversa)
    // Nota: Por estándar HID, empujar el stick hacia adelante da -1.0 y tirar hacia atrás da +1.0.
    // Lo convertimos para que empujar hacia adelante sea +1.0 (Avance) y tirar hacia atrás sea -1.0 (Reversa).
    const idxY = config.axisY === 'auto' ? 1 : Number(config.axisY) || 1;
    const rawY = -(state.axesRaw[idxY] || 0) * (config.invertY ? -1 : 1);
    state.stickY = applyDeadzoneAndExpo(rawY, config.deadzoneStick, config.expoCurve);

    // 3. Lectura de Eje Twist Z (Rotación de empuñadura / Rudder)
    const idxTwist = config.axisTwist === 'auto' ? state.resolvedTwistAxis : Number(config.axisTwist);
    const rawTwist = (state.axesRaw[idxTwist] || 0) * (config.invertTwist ? -1 : 1);
    state.twistZ = applyDeadzoneAndExpo(rawTwist, config.deadzoneTwist, config.expoCurve * 0.7);

    // 4. Lectura de Palanca de Gases en la Base (Throttle Slider)
    const idxThr = config.axisThrottle === 'auto' ? state.resolvedThrottleAxis : Number(config.axisThrottle);
    let rawThr = state.axesRaw[idxThr];
    if (Number.isFinite(rawThr) && Math.abs(rawThr) <= 1.05) {
      if (config.invertThrottle) rawThr = -rawThr;
      // Convertir de [-1, +1] a [0, 1]
      state.throttleBipolar = THREE.MathUtils.clamp(rawThr, -1, 1);
      state.throttleSlider = THREE.MathUtils.clamp((rawThr + 1) * 0.5, 0, 1);
    } else {
      state.throttleBipolar = 0;
      state.throttleSlider = 1.0;
    }

    // 5. Lectura del 8-Way POV Hat Switch (Cabezal Superior)
    let hatX = 0;
    let hatY = 0;
    let hatLabel = 'CENTRADO';

    const hatIdx = config.axisHatPov === 'auto' ? state.resolvedHatAxis : Number(config.axisHatPov);
    if (hatIdx >= 0 && hatIdx < state.axesRaw.length && state.axesRaw.length >= 9) {
      const decoded = decodeQuantizedHatAxis(state.axesRaw[hatIdx]);
      hatX = decoded.x;
      hatY = decoded.y;
      hatLabel = decoded.label;
    } else if (state.axesRaw.length >= 6 && config.axisHatPov === 'axes45') {
      hatX = Math.abs(state.axesRaw[4] || 0) > 0.3 ? Math.sign(state.axesRaw[4]) : 0;
      hatY = Math.abs(state.axesRaw[5] || 0) > 0.3 ? -Math.sign(state.axesRaw[5]) : 0;
    }

    // Fallback a botones D-Pad (12..15) si el navegador mapea el POV Hat a botones
    const btns = gp.buttons || [];
    if (hatX === 0 && hatY === 0 && btns.length >= 16) {
      if (btns[12] && btns[12].pressed) hatY += 1;
      if (btns[13] && btns[13].pressed) hatY -= 1;
      if (btns[14] && btns[14].pressed) hatX -= 1;
      if (btns[15] && btns[15].pressed) hatX += 1;
      if (hatX !== 0 || hatY !== 0) {
        hatLabel = `${hatY > 0 ? 'N' : hatY < 0 ? 'S' : ''}${hatX > 0 ? 'E' : hatX < 0 ? 'O' : ''}`;
      }
    }

    state.hatX = hatX;
    state.hatY = hatY;
    state.hatDirectionLabel = hatLabel;

    // 6. Lectura de los 12 Botones Físicos y detección de pulsación única (Rising Edge)
    for (let i = 0; i < 16; i++) {
      const pressed = !!(btns[i] && (btns[i].pressed || btns[i].value > 0.5));
      state.buttonsJustPressed[i] = pressed && !state.buttonsPrev[i];
      state.buttonsPressed[i] = pressed;
      state.buttonsPrev[i] = pressed;
    }

    return {
      connected: true,
      justConnected,
      state,
      config
    };
  }

  function startAxisLearning(targetKey) {
    state.learningTarget = targetKey;
    state.learningBaseline = state.axesRaw.slice();
  }

  function cancelAxisLearning() {
    state.learningTarget = null;
  }

  function updateConfig(partial) {
    Object.assign(config, partial);
    saveConfig();
  }

  function resetConfigToDefaults() {
    Object.assign(config, defaultConfig);
    state.axisBaseline = null;
    state.learningTarget = null;
    saveConfig();
  }

  window.HotasController = {
    poll,
    getState: () => state,
    getConfig: () => config,
    updateConfig,
    resetConfigToDefaults,
    startAxisLearning,
    cancelAxisLearning,
    BUTTON_DEFINITIONS
  };
})();
