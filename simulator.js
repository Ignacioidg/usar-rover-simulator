// simulator.js - Motor Físico Articulado, Simulación HOTAS, Lazo Cerrado PID/SAS,
// Sensores HC-SR04 + ToF/LiDAR 3D y Renderizado Dual (1ra Persona FPV + 3ra Persona + PiP)

(function () {
  const container = document.getElementById('canvas-container');

  // Escena, Niebla atmosférica de polvo en suspensión y Renderizador WebGL
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcbc4b8);
  scene.fog = new THREE.FogExp2(0xcbc4b8, 0.014);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // Iluminación Ambiental y Solar (Modo Día / Modo Derrumbe Oscuro Noche)
  const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x5c5346, 0.85);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff2dc, 1.35);
  sunLight.position.set(32, 48, -22);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 140;
  const d = 48;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // Construcción del Escenario USAR y del Rover Articulado
  const terrain = window.TerrainBuilder.createUSARTerrain(scene);
  const rover = window.RoverBuilder.createUSARRover(scene);

  // Cámara de 3ra Persona (Seguimiento / Orbital)
  const thirdPersonCam = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 300);
  let camOrbitYaw = -0.48; // Ángulo inicial estilo imagen conceptual (3/4 frontal)
  let camOrbitPitch = 0.28;
  let camDistance = 6.2;

  // Nube de Puntos 3D para el Escáner ToF / Micro-LiDAR (Recomendación #5)
  const lidarGroup = new THREE.Group();
  scene.add(lidarGroup);
  const lidarDots = [];
  const lidarDotGeo = new THREE.SphereGeometry(0.055, 8, 8);
  for (let i = 0; i < 45; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const dot = new THREE.Mesh(lidarDotGeo, mat);
    dot.visible = false;
    lidarGroup.add(dot);
    lidarDots.push(dot);
  }

  // Estado Operativo del Rover y Sistemas de Ingeniería
  const state = {
    // Cinemática del Rover
    x: 0.0,
    z: -0.6,
    y: 0.5,
    heading: 0.0,       // Radianes (0 = mirando hacia +Z)
    targetHeadingSAS: 0.0,
    speed: 0.0,         // m/s
    articulationYaw: 0.0,
    frontPitch: 0.0,
    frontRoll: 0.0,
    rearPitch: 0.0,
    rearRoll: 0.0,

    // Controles Virtuales HOTAS
    throttleInput: 0.0, // -1 a +1
    throttleHold: 0.0,  // Modo retención HOTAS con R/F
    stickX: 0.0,        // Dirección (-1 izq, +1 der)
    brakeActive: false,

    // Torreta Pan-Tilt 2-DoF (Simulación de IMU Visor VR)
    turretYaw: 0.0,     // Grados (-140° a +140°)
    turretPitch: 0.0,   // Grados (-40° a +55°)

    // Modos de Ingeniería y Teleoperación
    cameraMode: '3rd',  // '3rd' o 'fpv'
    pipEnabled: true,
    sasEnabled: true,   // Modo Estabilizado (PID / SAS) vs Manual Directo
    drivetrain: '8x8',  // '6x6', '8x8', '4wd'
    jointMode: 'active',// 'active' (Servo Alto Torque) o 'passive' (Pasiva Amortiguada)
    lightsLevel: 1,     // 0: Off, 1: Normal, 2: Alta Potencia USAR
    nightMode: false,
    lidarActive: false,
    rfLinkMode: '58ghz',// '58ghz' (<15ms), 'qvga' (38ms), 'vga' (58ms), 'congested' (125ms)

    // Telemetría de Sensores
    tofDistance: 12.0,
    ultrasonicDistance: 12.0,
    pwmPercent: 0,
    batteryVolts: 16.4,
    currentAmps: 1.8,
    bellyClearance: 0.48,
    highCentered: false,
    groundedCount: 8,
    activeWheelsCount: 8,
    latencyMs: 14,
    fpsSim: 60
  };

  // Mapa de Teclas Pulsadas
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const code = e.code;
    keys[code] = true;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }

    // Atajos de teclado instantáneos
    if (code === 'KeyV') toggleCameraMode();
    if (code === 'KeyP') togglePiP();
    if (code === 'KeyG') toggleSASMode();
    if (code === 'KeyL') cycleLights();
    if (code === 'KeyN') toggleNightMode();
    if (code === 'KeyT') toggleLidar();
    if (code === 'KeyM') toggleJointMode();
    if (code === 'KeyX' || code === 'KeyC') centerTurret();
    if (code === 'KeyH') toggleModal();
    if (code === 'KeyJ') toggleHotasModal();
    if (code === 'KeyK') toggleVrWifiQuick();
    if (code === 'Escape') {
      document.getElementById('engineering-modal').classList.add('hidden');
      document.getElementById('hotas-modal').classList.add('hidden');
      const vrModal = document.getElementById('vr-wifi-modal');
      if (vrModal) vrModal.classList.add('hidden');
      if (window.HotasController) window.HotasController.cancelAxisLearning();
    }
    if (code === 'Digit1') teleportToZone(1);
    if (code === 'Digit2') teleportToZone(2);
    if (code === 'Digit3') teleportToZone(3);
    if (code === 'Digit4') teleportToZone(4);
    if (code === 'Backspace' || code === 'Digit0') resetRoverPose();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Control con Mouse (Arrastrar para orbitar en 3ra persona o mover Pan-Tilt en 1ra persona)
  let isDragging = false;
  let dragButton = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragButton = e.button;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (state.cameraMode === 'fpv' || dragButton === 2 || e.shiftKey) {
      // Mover torreta Pan-Tilt (Head-tracking simulado)
      state.turretYaw = THREE.MathUtils.clamp(state.turretYaw - dx * 0.28, -135, 135);
      state.turretPitch = THREE.MathUtils.clamp(state.turretPitch - dy * 0.25, -38, 52);
    } else {
      // Orbitar cámara de 3ra persona alrededor del rover
      camOrbitYaw -= dx * 0.0065;
      camOrbitPitch = THREE.MathUtils.clamp(camOrbitPitch + dy * 0.0055, 0.06, 1.25);
    }
  });

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  renderer.domElement.addEventListener('wheel', (e) => {
    camDistance = THREE.MathUtils.clamp(camDistance + e.deltaY * 0.004, 3.2, 14.0);
  });

  // =========================================================================
  // FUNCIONES DE INTERFAZ Y CONMUTACIÓN DE SISTEMAS
  // =========================================================================
  function toggleCameraMode() {
    state.cameraMode = state.cameraMode === '3rd' ? 'fpv' : '3rd';
    const btn = document.getElementById('btn-cam-mode');
    const fpvOverlay = document.getElementById('fpv-overlay');
    const pipTitle = document.getElementById('pip-title');

    if (state.cameraMode === 'fpv') {
      btn.innerHTML = '<span>🎥 VISTA: 1RA PERSONA (FPV VR)</span> <span class="key-hint">V</span>';
      btn.classList.add('active');
      fpvOverlay.classList.add('active');
      pipTitle.textContent = 'GEMELO DIGITAL 3D (EXTERIOR)';
    } else {
      btn.innerHTML = '<span>🎥 VISTA: 3RA PERSONA (EXTERIOR)</span> <span class="key-hint">V</span>';
      btn.classList.remove('active');
      fpvOverlay.classList.remove('active');
      pipTitle.textContent = 'STREAMING ESP32-CAM (FPV)';
    }
  }

  function togglePiP() {
    state.pipEnabled = !state.pipEnabled;
    document.getElementById('pip-frame').classList.toggle('hidden', !state.pipEnabled);
    document.getElementById('btn-pip').classList.toggle('active', state.pipEnabled);
  }

  function toggleSASMode() {
    state.sasEnabled = !state.sasEnabled;
    state.targetHeadingSAS = state.heading;
    const pill = document.getElementById('sas-status-pill');
    const btn = document.getElementById('btn-sas');
    if (state.sasEnabled) {
      pill.textContent = 'SAS / PID: ESTABILIZADO';
      pill.className = 'sas-pill active';
      btn.classList.add('active');
    } else {
      pill.textContent = 'MODO: MANUAL DIRECTO';
      pill.className = 'sas-pill manual';
      btn.classList.remove('active');
    }
  }

  function cycleLights() {
    state.lightsLevel = (state.lightsLevel + 1) % 3;
    rover.setLightsIntensity(state.lightsLevel);
    const labels = ['OFF', 'NORMAL', 'MAX USAR'];
    document.getElementById('lights-label').textContent = labels[state.lightsLevel];
    document.getElementById('btn-lights').classList.toggle('active', state.lightsLevel > 0);
  }

  function toggleNightMode() {
    state.nightMode = !state.nightMode;
    if (state.nightMode) {
      scene.background.setHex(0x070b11);
      scene.fog.color.setHex(0x070b11);
      scene.fog.density = 0.025;
      hemiLight.intensity = 0.12;
      sunLight.intensity = 0.14;
      if (state.lightsLevel === 0) cycleLights();
    } else {
      scene.background.setHex(0xcbc4b8);
      scene.fog.color.setHex(0xcbc4b8);
      scene.fog.density = 0.014;
      hemiLight.intensity = 0.85;
      sunLight.intensity = 1.35;
    }
    document.getElementById('btn-night').classList.toggle('active', state.nightMode);
  }

  function toggleLidar() {
    state.lidarActive = !state.lidarActive;
    lidarDots.forEach((d) => (d.visible = state.lidarActive));
    document.getElementById('btn-lidar').classList.toggle('active', state.lidarActive);
  }

  function toggleJointMode() {
    state.jointMode = state.jointMode === 'active' ? 'passive' : 'active';
    const el = document.getElementById('joint-mode-val');
    el.textContent = state.jointMode === 'active' ? 'ACTIVA (SERVO)' : 'PASIVA (3D)';
  }

  function centerTurret() {
    state.turretYaw = 0;
    state.turretPitch = 0;
  }

  function setDrivetrain(mode) {
    state.drivetrain = mode;
    rover.setDrivetrainConfig(mode);
    document.querySelectorAll('[data-drive]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-drive') === mode);
    });
  }

  function teleportToZone(zoneIdx) {
    const zones = {
      1: { x: 0.0, z: -0.6, heading: 0.0, name: 'Zona 1: Losas Colapsadas (Concept Art)' },
      2: { x: -24.0, z: 6.5, heading: 0.0, name: 'Zona 2: Zanja Sísmica y Puente' },
      3: { x: 24.0, z: 6.5, heading: 0.0, name: 'Zona 3: Rampa de Alta Pendiente' },
      4: { x: 0.0, z: 33.5, heading: 0.0, name: 'Zona 4: Túnel Oscuro Colapsado' }
    };
    const t = zones[zoneIdx];
    if (!t) return;
    state.x = t.x;
    state.z = t.z;
    state.heading = t.heading;
    state.targetHeadingSAS = t.heading;
    state.speed = 0;
    state.throttleInput = 0;
    state.throttleHold = 0;
    state.articulationYaw = 0;
    showBannerAlert(`TELETRANSPORTE: ${t.name}`, 'success', 2400);
  }

  function resetRoverPose() {
    state.speed = 0;
    state.throttleInput = 0;
    state.throttleHold = 0;
    state.articulationYaw = 0;
    state.frontPitch = 0;
    state.frontRoll = 0;
    state.rearPitch = 0;
    state.rearRoll = 0;
    showBannerAlert('CHASIS REESTABLECIDO Y NIVELADO', 'success', 1800);
  }

  let alertTimeout = null;
  function showBannerAlert(msg, type = 'danger', duration = 2200) {
    const banner = document.getElementById('hud-alert-banner');
    banner.textContent = msg;
    banner.className = 'show ' + (type === 'success' ? 'success' : '');
    if (alertTimeout) clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
      banner.className = '';
    }, duration);
  }

  let currentZoneIdx = 1;

  function cycleDrivetrain() {
    const order = ['8x8', '6x6', '4wd'];
    const next = order[(order.indexOf(state.drivetrain) + 1) % order.length];
    setDrivetrain(next);
    showBannerAlert(`TRACCIÓN [BOTÓN 7]: MODO ${next.toUpperCase()} ACTIVADO`, 'success', 1900);
  }

  function cycleTeleportZone() {
    currentZoneIdx = (currentZoneIdx % 4) + 1;
    teleportToZone(currentZoneIdx);
  }

  function toggleThrottleMode() {
    if (!window.HotasController) return;
    const cfg = window.HotasController.getConfig();
    const nextMode = cfg.throttleMode === 'stick_drive' ? 'hotas_cruise' : 'stick_drive';
    window.HotasController.updateConfig({ throttleMode: nextMode });
    const sel = document.getElementById('cfg-throttle-mode');
    if (sel) sel.value = nextMode;
    resetRoverPose();
    showBannerAlert(
      nextMode === 'stick_drive'
        ? 'MODO THROTTLE [B12]: STICK Y DIRECTO + LEVA BASE LÍMITE PWM'
        : 'MODO THROTTLE [B12]: CRUCERO HOTAS EN LEVA BASE',
      'success',
      2500
    );
  }

  function toggleHotasModal() {
    const modal = document.getElementById('hotas-modal');
    if (!modal) return;
    modal.classList.toggle('hidden');
    if (modal.classList.contains('hidden') && window.HotasController) {
      window.HotasController.cancelAxisLearning();
    } else {
      syncHotasModalControls();
    }
  }

  // Ejecuta la acción asignada a cualquiera de los 12 botones del Logitech Extreme 3D Pro (1..12)
  function triggerHotasButtonAction(btnNum) {
    switch (btnNum) {
      case 1:
        state.throttleHold = 0;
        state.throttleInput = 0;
        state.speed = 0;
        showBannerAlert('GATILLO [B1]: FRENO DE EMERGENCIA (0% PWM)', 'danger', 1400);
        break;
      case 2:
        centerTurret();
        if (window.HotasController && window.HotasController.getConfig().throttleMode === 'hotas_cruise') {
          const hs = window.HotasController.getState();
          hs.cruiseReverse = !hs.cruiseReverse;
          showBannerAlert(
            `PULGAR [B2]: TORRETA CENTRADA | MARCHA CRUCERO: ${hs.cruiseReverse ? 'REVERSA (REV)' : 'ADELANTE (FWD)'}`,
            'success',
            1900
          );
        } else {
          showBannerAlert('PULGAR [B2]: TORRETA PAN-TILT CENTRADA (0°, 0°)', 'success', 1400);
        }
        break;
      case 3:
        toggleCameraMode();
        break;
      case 4:
        toggleSASMode();
        break;
      case 5:
        cycleLights();
        break;
      case 6:
        toggleLidar();
        break;
      case 7:
        cycleDrivetrain();
        break;
      case 8:
        toggleJointMode();
        showBannerAlert(
          `FUELlE CENTRAL [B8]: ARTICULACIÓN ${state.jointMode === 'active' ? 'ACTIVA (SERVO)' : 'PASIVA (3D)'}`,
          'success',
          1800
        );
        break;
      case 9:
        toggleNightMode();
        break;
      case 10:
        togglePiP();
        break;
      case 11:
        cycleTeleportZone();
        break;
      case 12:
        toggleThrottleMode();
        break;
    }
  }

  function toggleModal() {
    document.getElementById('engineering-modal').classList.toggle('hidden');
  }

  // Vincular botones del DOM
  document.getElementById('btn-cam-mode').addEventListener('click', toggleCameraMode);
  document.getElementById('btn-pip').addEventListener('click', togglePiP);
  document.getElementById('btn-sas').addEventListener('click', toggleSASMode);
  document.getElementById('sas-status-pill').addEventListener('click', toggleSASMode);
  document.getElementById('btn-lights').addEventListener('click', cycleLights);
  document.getElementById('btn-night').addEventListener('click', toggleNightMode);
  document.getElementById('btn-lidar').addEventListener('click', toggleLidar);
  document.getElementById('btn-help').addEventListener('click', toggleModal);
  document.getElementById('btn-close-modal').addEventListener('click', toggleModal);
  document.getElementById('joint-toggle-btn').addEventListener('click', toggleJointMode);

  // Controles de Modal y Botonera Interactiva Logitech Extreme 3D Pro
  const btnHotasConfig = document.getElementById('btn-hotas-config');
  if (btnHotasConfig) btnHotasConfig.addEventListener('click', toggleHotasModal);
  const btnOpenHotasSide = document.getElementById('btn-open-hotas-side');
  if (btnOpenHotasSide) btnOpenHotasSide.addEventListener('click', toggleHotasModal);
  const btnCloseHotasModal = document.getElementById('btn-close-hotas-modal');
  if (btnCloseHotasModal) btnCloseHotasModal.addEventListener('click', toggleHotasModal);

  document.querySelectorAll('[data-joybtn]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const num = parseInt(pill.getAttribute('data-joybtn'), 10);
      triggerHotasButtonAction(num);
    });
  });

  function syncHotasModalControls() {
    if (!window.HotasController) return;
    const cfg = window.HotasController.getConfig();
    document.getElementById('cfg-axis-x').value = String(cfg.axisX);
    document.getElementById('cfg-axis-y').value = String(cfg.axisY);
    document.getElementById('cfg-axis-twist').value = String(cfg.axisTwist);
    document.getElementById('cfg-axis-throttle').value = String(cfg.axisThrottle);
    document.getElementById('cfg-inv-x').checked = !!cfg.invertX;
    document.getElementById('cfg-inv-y').checked = !!cfg.invertY;
    document.getElementById('cfg-inv-twist').checked = !!cfg.invertTwist;
    document.getElementById('cfg-inv-throttle').checked = !!cfg.invertThrottle;
    document.getElementById('cfg-throttle-mode').value = cfg.throttleMode;
    document.getElementById('cfg-twist-mode').value = cfg.twistMode;
    const dzPct = Math.round(cfg.deadzoneStick * 100);
    const expoPct = Math.round(cfg.expoCurve * 100);
    document.getElementById('cfg-deadzone-stick').value = dzPct;
    document.getElementById('lbl-deadzone-stick').textContent = `${dzPct}%`;
    document.getElementById('cfg-expo-curve').value = expoPct;
    document.getElementById('lbl-expo-curve').textContent = `${expoPct}%`;
  }

  if (window.HotasController) {
    syncHotasModalControls();

    document.getElementById('cfg-axis-x').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ axisX: Number(e.target.value) });
    });
    document.getElementById('cfg-axis-y').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ axisY: Number(e.target.value) });
    });
    document.getElementById('cfg-axis-twist').addEventListener('change', (e) => {
      const v = e.target.value;
      window.HotasController.updateConfig({ axisTwist: v === 'auto' ? 'auto' : Number(v) });
    });
    document.getElementById('cfg-axis-throttle').addEventListener('change', (e) => {
      const v = e.target.value;
      window.HotasController.updateConfig({ axisThrottle: v === 'auto' ? 'auto' : Number(v) });
    });

    document.getElementById('cfg-inv-x').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ invertX: e.target.checked });
    });
    document.getElementById('cfg-inv-y').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ invertY: e.target.checked });
    });
    document.getElementById('cfg-inv-twist').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ invertTwist: e.target.checked });
    });
    document.getElementById('cfg-inv-throttle').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ invertThrottle: e.target.checked });
    });

    document.getElementById('cfg-throttle-mode').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ throttleMode: e.target.value });
    });
    document.getElementById('cfg-twist-mode').addEventListener('change', (e) => {
      window.HotasController.updateConfig({ twistMode: e.target.value });
    });

    document.getElementById('cfg-deadzone-stick').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      document.getElementById('lbl-deadzone-stick').textContent = `${val}%`;
      window.HotasController.updateConfig({ deadzoneStick: val / 100 });
    });
    document.getElementById('cfg-expo-curve').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      document.getElementById('lbl-expo-curve').textContent = `${val}%`;
      window.HotasController.updateConfig({ expoCurve: val / 100 });
    });

    document.querySelectorAll('[data-learn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetKey = btn.getAttribute('data-learn');
        window.HotasController.startAxisLearning(targetKey);
      });
    });

    document.getElementById('btn-reset-hotas-defaults').addEventListener('click', () => {
      window.HotasController.resetConfigToDefaults();
      syncHotasModalControls();
      showBannerAlert('CALIBRACIÓN LOGITECH EXTREME 3D PRO RESTAURADA DE FÁBRICA', 'success', 2200);
    });
  }

  window.addEventListener('gamepadconnected', (e) => {
    const gpName = (e.gamepad && e.gamepad.id) || 'Joystick USB';
    showBannerAlert(`🕹️ JOYSTICK CONECTADO: ${gpName}`, 'success', 3200);
  });

  window.addEventListener('gamepaddisconnected', () => {
    showBannerAlert('⚠ JOYSTICK DESCONECTADO • MODO TECLADO ACTIVO', 'danger', 2600);
  });

  document.querySelectorAll('[data-drive]').forEach((btn) => {
    btn.addEventListener('click', () => setDrivetrain(btn.getAttribute('data-drive')));
  });

  document.querySelectorAll('[data-zone]').forEach((btn) => {
    btn.addEventListener('click', () => teleportToZone(parseInt(btn.getAttribute('data-zone'), 10)));
  });

  document.getElementById('rf-link-select').addEventListener('change', (e) => {
    state.rfLinkMode = e.target.value;
  });

  // Construir cinta de brújula superior
  const compassStrip = document.getElementById('compass-strip');
  let compassHTML = '';
  const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N' };
  for (let deg = -180; deg <= 540; deg += 15) {
    const norm = ((deg % 360) + 360) % 360;
    const label = cardinals[norm] || `${norm}°`;
    compassHTML += `<span style="display:inline-block;width:42px;text-align:center;">${label}</span>`;
  }
  compassStrip.innerHTML = compassHTML;

  // =========================================================================
  // SIMULACIÓN FÍSICA DE SENSORES (RAYCASTING HC-SR04 vs ToF / LiDAR)
  // =========================================================================
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.1;
  raycaster.far = 30.0;

  function updateSensorsAndBeacons(time) {
    // 1. Medición Óptica ToF / Micro-LiDAR en el eje de la cámara Pan-Tilt
    const camWorldPos = new THREE.Vector3();
    const camWorldDir = new THREE.Vector3();
    rover.fpvCamera.getWorldPosition(camWorldPos);
    rover.fpvCamera.getWorldDirection(camWorldDir);

    raycaster.set(camWorldPos, camWorldDir);
    const hits = raycaster.intersectObjects(terrain.sensorMeshes, false);
    state.tofDistance = hits.length > 0 ? hits[0].distance : 25.0;

    // 2. Sensor Ultrasónico HC-SR04 en la parrilla frontal del chasis (sujeto a falsos ecos en ángulos oblicuos)
    const frontSensorPos = new THREE.Vector3(0, 0.54, 2.15);
    rover.root.localToWorld(frontSensorPos);
    const frontDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.heading);
    raycaster.set(frontSensorPos, frontDir);
    const ultraHits = raycaster.intersectObjects(terrain.sensorMeshes, false);
    let rawUltra = ultraHits.length > 0 ? ultraHits[0].distance : 12.0;
    // Simulación de dispersión acústica del HC-SR04 sobre escombros irregulares
    const acousticNoise = Math.sin(time * 9.0) * 0.14 * (Math.abs(state.frontRoll) * 4.0);
    state.ultrasonicDistance = Math.max(0.12, rawUltra + acousticNoise);

    // 3. Nube de Puntos 3D Micro-LiDAR (9x5 haces láser)
    if (state.lidarActive) {
      let idx = 0;
      const rightVec = new THREE.Vector3().crossVectors(camWorldDir, new THREE.Vector3(0, 1, 0)).normalize();
      const upVec = new THREE.Vector3().crossVectors(rightVec, camWorldDir).normalize();

      for (let row = -2; row <= 2; row++) {
        for (let col = -4; col <= 4; col++) {
          const dot = lidarDots[idx++];
          const dir = camWorldDir
            .clone()
            .addScaledVector(rightVec, col * 0.065)
            .addScaledVector(upVec, row * 0.055)
            .normalize();
          raycaster.set(camWorldPos, dir);
          const lHits = raycaster.intersectObjects(terrain.sensorMeshes, false);
          if (lHits.length > 0 && lHits[0].distance < 22) {
            dot.visible = true;
            dot.position.copy(lHits[0].point);
            const dist = lHits[0].distance;
            if (dist < 1.6) dot.material.color.setHex(0xef4444);
            else if (dist < 4.0) dot.material.color.setHex(0xfacc15);
            else dot.material.color.setHex(0x00f0ff);
          } else {
            dot.visible = false;
          }
        }
      }
    }

    // 4. Detección y Escaneo de Balizas USAR
    terrain.beacons.forEach((b, idx) => {
      b.ringMesh.rotation.z = time * 1.8;
      const s = 1 + Math.sin(time * 4 + idx) * 0.12;
      b.ringMesh.scale.set(s, s, 1);

      const distToRover = Math.hypot(b.x - state.x, b.z - state.z);
      const distEl = document.getElementById(`beacon-dist-${b.id}`);
      const itemEl = document.getElementById(`beacon-item-${b.id}`);

      if (!b.found) {
        if (distEl) distEl.textContent = `${distToRover.toFixed(1)} m`;
        // Si el rover se acerca a < 6.8m, registra el rescate automáticamente
        if (distToRover < 6.8) {
          b.found = true;
          b.podMat.color.setHex(0x10b981);
          b.podMat.emissive.setHex(0x10b981);
          if (itemEl) itemEl.classList.add('found');
          if (distEl) distEl.textContent = '✓ RESCATADO';
          showBannerAlert(`¡OBJETIVO USAR LOCALIZADO: ${b.name}!`, 'success', 3200);
        }
      }
    });
  }

  // =========================================================================
  // BUCLE DE FÍSICA DEL ROVER ARTICULADO Y SUSPENSIÓN MULTI-RUEDA
  // =========================================================================
  function updatePhysics(dt, time) {
    // 0. Muestreo del Joystick Físico LOGITECH EXTREME 3D PRO (Web Gamepad API)
    const hotasPoll = window.HotasController ? window.HotasController.poll() : { connected: false };
    const hs = window.HotasController ? window.HotasController.getState() : null;
    const hcfg = window.HotasController ? window.HotasController.getConfig() : null;

    if (hs && hs.connected) {
      // Procesar flancos de subida (pulsaciones únicas) en los botones 2 al 12 del Logitech Extreme 3D Pro
      for (let bIdx = 1; bIdx < 12; bIdx++) {
        if (hs.buttonsJustPressed[bIdx]) {
          triggerHotasButtonAction(bIdx + 1);
        }
      }
    }

    // 1. Lectura de Acelerador y Freno (Logitech Extreme 3D Pro + Teclado W/S y R/F)
    const joyTriggerBrake = !!(hs && hs.connected && hs.buttonsPressed[0]); // Botón 1 (Gatillo)
    state.brakeActive = !!keys['Space'] || joyTriggerBrake;

    if (keys['KeyR'] || keys['ShiftLeft']) {
      state.throttleHold = THREE.MathUtils.clamp(state.throttleHold + dt * 0.55, -1, 1);
    }
    if (keys['KeyF'] || keys['ControlLeft']) {
      state.throttleHold = THREE.MathUtils.clamp(state.throttleHold - dt * 0.55, -1, 1);
    }

    let targetThrottle = state.throttleHold;

    // Si el Logitech Extreme 3D Pro está conectado, integramos Stick Y y la Palanca Throttle Base
    if (hs && hs.connected && hcfg) {
      const powerCeiling = hs.throttleTouched ? 0.22 + 0.78 * hs.throttleSlider : 1.0;

      if (hcfg.throttleMode === 'hotas_cruise') {
        // Modo Crucero HOTAS: la leva de la base fija los gases continuos y el Stick Y da empuje diferencial
        const cruiseSign = hs.cruiseReverse ? -0.85 : 1.0;
        const baseCruise = hs.throttleSlider > 0.05 ? hs.throttleSlider * cruiseSign : 0;
        targetThrottle = THREE.MathUtils.clamp(baseCruise + hs.stickY * 0.75, -0.9, 1.0);
      } else {
        // Modo Rover Directo (Por Defecto): Stick Y controla Avance/Reversa escalado por el Techo de Potencia de la Leva Base
        if (Math.abs(hs.stickY) > 0.001) {
          const dirScale = hs.stickY >= 0 ? 1.0 : 0.85;
          targetThrottle = hs.stickY * dirScale * powerCeiling;
        } else if (Math.abs(state.throttleHold) > 0.01) {
          targetThrottle = state.throttleHold * powerCeiling;
        }
      }
    }

    // Sobrescritura directa por teclado si se pulsan W o S
    if (keys['KeyW']) targetThrottle = 1.0;
    else if (keys['KeyS']) targetThrottle = -0.85;

    if (state.brakeActive) {
      state.throttleHold = 0;
      targetThrottle = 0;
    }

    // Rampa exponencial suave (Etapa 02 de la presentación)
    state.throttleInput = THREE.MathUtils.lerp(state.throttleInput, targetThrottle, Math.min(1, dt * 7.5));

    // 2. Lectura de Stick de Dirección (Logitech Extreme 3D Pro Eje X + Twist Z + Teclado A/D)
    let rawSteer = 0;
    if (keys['KeyA']) rawSteer += 1;
    if (keys['KeyD']) rawSteer -= 1;

    if (hs && hs.connected && hcfg) {
      // En el motor del rover +1 es doblar a la izquierda y -1 es doblar a la derecha
      let joySteer = -hs.stickX;
      if (hcfg.twistMode === 'rover_steer') {
        joySteer = THREE.MathUtils.clamp(joySteer - hs.twistZ * 0.9, -1, 1);
      } else if (hcfg.twistMode === 'turret_and_steer') {
        joySteer = THREE.MathUtils.clamp(joySteer - hs.twistZ * 0.35, -1, 1);
      }
      if (Math.abs(joySteer) > Math.abs(rawSteer)) {
        rawSteer = joySteer;
      }
    }

    state.stickX = THREE.MathUtils.lerp(state.stickX, rawSteer, Math.min(1, dt * 8.5));

    // 3. Control de Torreta Pan-Tilt 2-DoF (POV Hat 8-Vías + Twist Z + Flechas del Teclado)
    const turretSpeed = 82 * dt;
    if (keys['ArrowLeft']) state.turretYaw = THREE.MathUtils.clamp(state.turretYaw + turretSpeed, -135, 135);
    if (keys['ArrowRight']) state.turretYaw = THREE.MathUtils.clamp(state.turretYaw - turretSpeed, -135, 135);
    if (keys['ArrowUp']) state.turretPitch = THREE.MathUtils.clamp(state.turretPitch + turretSpeed * 0.85, -38, 52);
    if (keys['ArrowDown']) state.turretPitch = THREE.MathUtils.clamp(state.turretPitch - turretSpeed * 0.85, -38, 52);

    if (hs && hs.connected && hcfg) {
      // POV Hat de 8 direcciones en la cabeza del Logitech Extreme 3D Pro
      if (Math.abs(hs.hatX) > 0.01 || Math.abs(hs.hatY) > 0.01) {
        state.turretYaw = THREE.MathUtils.clamp(state.turretYaw - hs.hatX * turretSpeed * 1.15, -135, 135);
        state.turretPitch = THREE.MathUtils.clamp(state.turretPitch + hs.hatY * turretSpeed * 0.95, -38, 52);
      }
      // Eje Twist Z (rotación de muñeca)
      if (Math.abs(hs.twistZ) > 0.01) {
        if (hcfg.twistMode === 'turret_pan' || hcfg.twistMode === 'turret_and_steer') {
          state.turretYaw = THREE.MathUtils.clamp(state.turretYaw - hs.twistZ * turretSpeed * 1.25, -135, 135);
        } else if (hcfg.twistMode === 'cam_orbit') {
          camOrbitYaw -= hs.twistZ * 1.8 * dt;
        }
      }
    }

    // Rotación de cámara 3ra persona con Q / E
    if (keys['KeyQ']) camOrbitYaw += 1.5 * dt;
    if (keys['KeyE']) camOrbitYaw -= 1.5 * dt;

    // 4. Articulación Central del Fuelle (Dirección Articulada vs Chasis Rígido 4WD)
    const maxArticulation = state.drivetrain === '4wd' ? 0.0 : state.jointMode === 'active' ? 0.46 : 0.24;
    const targetArtYaw = state.stickX * maxArticulation;
    state.articulationYaw = THREE.MathUtils.lerp(state.articulationYaw, targetArtYaw, Math.min(1, dt * 6.0));

    // 5. Cálculo de Torque, Pendiente, Despeje de Panza (Belly Clearance) y Velocidad
    const avgPitch = (state.frontPitch + state.rearPitch) * 0.5;
    // En modo 4WD con motores TT amarillos el torque en subida cae drásticamente (Punto 1 del análisis)
    const torqueFactor = state.drivetrain === '4wd' ? 0.52 : state.drivetrain === '6x6' ? 0.94 : 1.0;
    const maxSpeed = state.drivetrain === '4wd' ? 4.2 : 6.4;
    const slopeResistance = Math.sin(-avgPitch) * (state.drivetrain === '4wd' ? 6.8 : 2.6);

    let desiredSpeed = state.throttleInput * maxSpeed * torqueFactor - slopeResistance;
    if (state.brakeActive) {
      state.speed = THREE.MathUtils.lerp(state.speed, 0, Math.min(1, dt * 14));
    } else if (Math.abs(state.throttleInput) < 0.03) {
      state.speed = THREE.MathUtils.lerp(state.speed, 0, Math.min(1, dt * 4.5));
    } else {
      state.speed = THREE.MathUtils.lerp(state.speed, desiredSpeed, Math.min(1, dt * 3.8));
    }

    // Penalización si el chasis queda "empanzado" (High-Centered)
    if (state.highCentered) {
      state.speed *= 0.35;
    }

    // 6. Giro del Rover + Lazo Cerrado PID / SAS (Modo Estabilizado vs Manual Directo)
    const turnRate = (state.stickX * 0.95 + state.articulationYaw * 0.85) * (0.35 + Math.abs(state.speed) * 0.22);
    const dirSign = state.speed >= -0.05 ? 1 : -1;

    // Perturbación lateral del terreno irregular (desvía el chasis si el SAS está apagado)
    const terrainDrift = (state.frontRoll * 0.65 + Math.sin(state.z * 1.4) * 0.08) * (Math.abs(state.speed) * 0.32);

    if (Math.abs(state.stickX) > 0.04) {
      state.heading += turnRate * dirSign * dt;
      if (!state.sasEnabled) {
        state.heading += terrainDrift * dt;
      }
      state.targetHeadingSAS = state.heading;
    } else {
      if (state.sasEnabled) {
        // Corrección activa PID sobre rumbo con IMU MPU6050
        const headingError = state.targetHeadingSAS - state.heading;
        state.heading += (terrainDrift * 0.15 + headingError * 4.5) * dt;
      } else {
        // Modo Manual Directo: el terreno desvía el rover continuamente
        state.heading += terrainDrift * 1.45 * dt;
      }
    }

    // Avance en el plano XZ
    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;
    state.x = THREE.MathUtils.clamp(state.x, -82, 82);
    state.z = THREE.MathUtils.clamp(state.z, -82, 82);

    // 7. Evaluación de Contacto 3D Rueda por Rueda y Oscilación Independiente (Módulo Delantero vs Trasero)
    const wheelRadius = state.drivetrain === '4wd' ? 0.32 : 0.52;
    let frontLeftY = [], frontRightY = [], frontFrontY = [], frontBackY = [];
    let rearLeftY = [], rearRightY = [], rearFrontY = [], rearBackY = [];
    let groundedWheels = 0;
    let totalActiveWheels = 0;

    rover.wheels.forEach((w) => {
      if (!w.active) return;
      totalActiveWheels++;

      // Posición aproximada de cada rueda en el mundo
      const modZOffset = w.moduleName === 'front' ? 1.05 : -1.35;
      const localZ = modZOffset + w.currentZLocal;
      const localX = w.baseX;

      const cosH = Math.cos(state.heading);
      const sinH = Math.sin(state.heading);
      const wx = state.x + localX * cosH + localZ * sinH;
      const wz = state.z - localX * sinH + localZ * cosH;

      const groundH = terrain.getSurfaceHeightAt(wx, wz);
      const wheelHubTargetY = groundH + wheelRadius;

      if (w.moduleName === 'front') {
        if (w.isLeft) frontLeftY.push(wheelHubTargetY);
        else frontRightY.push(wheelHubTargetY);
        if (w.currentZLocal > 0) frontFrontY.push(wheelHubTargetY);
        else frontBackY.push(wheelHubTargetY);
      } else {
        if (w.isLeft) rearLeftY.push(wheelHubTargetY);
        else rearRightY.push(wheelHubTargetY);
        if (w.currentZLocal > 0) rearFrontY.push(wheelHubTargetY);
        else rearBackY.push(wheelHubTargetY);
      }

      w.lastGroundH = groundH;
      w.targetHubY = wheelHubTargetY;
    });

    const avg = (arr, fallback) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback);

    const fL = avg(frontLeftY, state.y);
    const fR = avg(frontRightY, state.y);
    const fF = avg(frontFrontY, (fL + fR) * 0.5);
    const fB = avg(frontBackY, (fL + fR) * 0.5);

    const rL = avg(rearLeftY, state.y);
    const rR = avg(rearRightY, state.y);
    const rF = avg(rearFrontY, (rL + rR) * 0.5);
    const rB = avg(rearBackY, (rL + rR) * 0.5);

    const frontHeight = (fL + fR) * 0.5;
    const rearHeight = (rL + rR) * 0.5;
    const targetRoverY = (frontHeight + rearHeight) * 0.5;

    state.y = THREE.MathUtils.lerp(state.y, targetRoverY, Math.min(1, dt * 12));

    // Pitch y Roll independientes para Módulo Delantero y Módulo Trasero
    const targetFrontPitch = THREE.MathUtils.clamp(Math.atan2(fB - fF, 1.1), -0.48, 0.48);
    const targetFrontRoll = THREE.MathUtils.clamp(Math.atan2(fR - fL, 2.16), -0.48, 0.48);

    const targetRearPitch = THREE.MathUtils.clamp(Math.atan2(rB - rF, 1.1), -0.48, 0.48);
    const targetRearRoll = THREE.MathUtils.clamp(Math.atan2(rR - rL, 2.16), -0.48, 0.48);

    state.frontPitch = THREE.MathUtils.lerp(state.frontPitch, targetFrontPitch, Math.min(1, dt * 10));
    state.frontRoll = THREE.MathUtils.lerp(state.frontRoll, targetFrontRoll, Math.min(1, dt * 10));

    // En modo 4WD rígido, ambos módulos comparten el mismo ángulo sin libertad en el fuelle
    if (state.drivetrain === '4wd') {
      state.rearPitch = state.frontPitch;
      state.rearRoll = state.frontRoll;
    } else {
      state.rearPitch = THREE.MathUtils.lerp(state.rearPitch, targetRearPitch, Math.min(1, dt * 10));
      state.rearRoll = THREE.MathUtils.lerp(state.rearRoll, targetRearRoll, Math.min(1, dt * 10));
    }

    // Aplicar transformaciones al Rover Root y a los dos Módulos Articulados
    rover.root.position.set(state.x, state.y, state.z);
    rover.root.rotation.y = state.heading;

    rover.frontModule.position.y = (frontHeight - state.y) * 0.85;
    rover.frontModule.rotation.y = state.articulationYaw * 0.55;
    rover.frontModule.rotation.x = state.frontPitch;
    rover.frontModule.rotation.z = state.frontRoll;

    rover.rearModule.position.y = (rearHeight - state.y) * 0.85;
    rover.rearModule.rotation.y = -state.articulationYaw * 0.55;
    rover.rearModule.rotation.x = state.rearPitch;
    rover.rearModule.rotation.z = state.rearRoll;

    // 8. Animar Suspensión Individual y Rotación de Tacos en cada Rueda
    const wheelSpinDelta = (state.speed / wheelRadius) * dt;
    rover.wheels.forEach((w) => {
      if (!w.active) {
        w.grounded = false;
        return;
      }
      w.spinGroup.rotation.x += wheelSpinDelta;

      const modY = w.moduleName === 'front' ? rover.frontModule.position.y : rover.rearModule.position.y;
      const hubRestWorldY = state.y + modY;
      const deltaY = w.targetHubY - hubRestWorldY;

      // Si el suelo está muy por debajo de la extensión máxima del amortiguador, la rueda queda en el aire
      if (deltaY < -0.22) {
        w.grounded = false;
        w.compression = -0.20;
      } else {
        w.grounded = true;
        groundedWheels++;
        w.compression = THREE.MathUtils.clamp(deltaY, -0.18, 0.24);
      }

      w.assembly.position.y = THREE.MathUtils.lerp(w.assembly.position.y, w.compression, Math.min(1, dt * 16));
      w.suspGroup.rotation.z = (w.isLeft ? -1 : 1) * w.compression * 0.85;
    });

    state.groundedCount = groundedWheels;
    state.activeWheelsCount = totalActiveWheels;

    // 9. Verificación de Despeje al Suelo de la Panza (Belly Clearance)
    const bellyGroundY = terrain.getSurfaceHeightAt(state.x, state.z);
    const chassisBottomWorldY = state.y - (state.drivetrain === '4wd' ? 0.19 : 0.04);
    state.bellyClearance = Math.max(0, chassisBottomWorldY - bellyGroundY);
    const wasHighCentered = state.highCentered;
    state.highCentered = state.bellyClearance < 0.045;
    if (state.highCentered && !wasHighCentered) {
      showBannerAlert('¡ALERTA DE INGENIERÍA: EMPANZAMIENTO DE CHASIS (BELLY CLEARANCE CRÍTICO)!', 'danger', 3000);
    }

    // 10. Actualizar Fuelle Central Articulado y Antenas
    const relPitch = state.frontPitch - state.rearPitch;
    const relRoll = state.frontRoll - state.rearRoll;
    rover.updateBellowsAndAntennas(state.articulationYaw, relPitch, relRoll, state.speed, dt, time);

    // 11. Actualizar Torreta Pan-Tilt 2-DoF y Estabilización de Horizonte FPV
    const yawRad = THREE.MathUtils.degToRad(state.turretYaw);
    let pitchRad = THREE.MathUtils.degToRad(-state.turretPitch);

    if (state.sasEnabled) {
      // Compensación activa de cabeceo y alabeo en la torreta para evitar Ciber-cinetosis
      pitchRad -= state.frontPitch * 0.65;
      rover.fpvCamera.rotation.z = -state.frontRoll * 0.65;
    } else {
      // Vibración cruda en Modo Manual Directo
      const shake = Math.sin(time * 34) * 0.012 * Math.abs(state.speed);
      pitchRad += shake;
      rover.fpvCamera.rotation.z = shake * 0.8;
    }

    rover.turretYawGroup.rotation.y = yawRad;
    rover.turretPitchGroup.rotation.x = pitchRad;

    // 12. Posicionar Cámara de 3ra Persona
    const camTarget = new THREE.Vector3(state.x, state.y + 0.85, state.z);
    const totalCamYaw = state.heading + Math.PI + camOrbitYaw;
    const hDist = camDistance * Math.cos(camOrbitPitch);
    const vDist = camDistance * Math.sin(camOrbitPitch);
    const desiredCamPos = new THREE.Vector3(
      camTarget.x + Math.sin(totalCamYaw) * hDist,
      camTarget.y + vDist,
      camTarget.z + Math.cos(totalCamYaw) * hDist
    );
    const groundAtCam = terrain.getSurfaceHeightAt(desiredCamPos.x, desiredCamPos.z);
    desiredCamPos.y = Math.max(desiredCamPos.y, groundAtCam + 0.45);

    thirdPersonCam.position.lerp(desiredCamPos, Math.min(1, dt * 12));
    thirdPersonCam.lookAt(camTarget);

    // 13. Actualizar Métricas Eléctricas y de Enlace RF (Diapositiva Evaluación Técnica)
    state.pwmPercent = Math.round(Math.min(100, Math.abs(state.throttleInput) * 100));
    const wheelFactor = state.drivetrain === '8x8' ? 1.35 : state.drivetrain === '6x6' ? 1.0 : 0.65;
    state.currentAmps = 1.6 + (state.pwmPercent / 100) * 14.5 * wheelFactor;
    state.batteryVolts = Math.max(13.2, 16.4 - state.currentAmps * 0.04);

    // Latencia Glass-to-Glass según configuración de enlace
    const rfNoiseEl = document.getElementById('fpv-rf-noise');
    if (state.rfLinkMode === '58ghz') {
      state.latencyMs = Math.round(12 + Math.random() * 4);
      state.fpsSim = 60;
      rfNoiseEl.style.opacity = '0.04';
    } else if (state.rfLinkMode === 'qvga') {
      state.latencyMs = Math.round(36 + Math.random() * 8);
      state.fpsSim = 30;
      rfNoiseEl.style.opacity = '0.08';
    } else if (state.rfLinkMode === 'vga') {
      state.latencyMs = Math.round(52 + Math.random() * 11);
      state.fpsSim = 18;
      rfNoiseEl.style.opacity = '0.16';
    } else {
      state.latencyMs = Math.round(115 + Math.random() * 35);
      state.fpsSim = 9;
      rfNoiseEl.style.opacity = '0.42';
    }
  }

  // =========================================================================
  // ACTUALIZACIÓN DEL HUD DE REALIDAD AUMENTADA Y PANELES TELEMÉTRICOS
  // =========================================================================
  function updateHUD() {
    // 1. Cinta de Brújula Superior y Rumbo
    const headingDeg = (((THREE.MathUtils.radToDeg(state.heading) % 360) + 360) % 360);
    const offsetPx = -(headingDeg / 15) * 42 - 42 * 12 + 155;
    compassStrip.style.transform = `translateX(${offsetPx}px)`;
    document.getElementById('heading-readout').textContent = `${Math.round(headingDeg).toString().padStart(3, '0')}°`;

    // 2. Retícula Central AR: Horizonte Artificial + Vector de Torreta Pan-Tilt
    const horizonGroup = document.getElementById('reticle-horizon-group');
    const rollDeg = THREE.MathUtils.radToDeg(state.frontRoll);
    const pitchPx = THREE.MathUtils.radToDeg(state.frontPitch) * 1.8;
    horizonGroup.setAttribute('transform', `translate(0, ${pitchPx.toFixed(1)}) rotate(${rollDeg.toFixed(1)}, 170, 170)`);

    // Indicador de desviación angular Pan-Tilt respecto al frente del chasis
    const turretIndicator = document.getElementById('reticle-turret-pip');
    const pipX = 170 - state.turretYaw * 0.75;
    const pipY = 170 - state.turretPitch * 0.95;
    turretIndicator.setAttribute('cx', pipX.toFixed(1));
    turretIndicator.setAttribute('cy', pipY.toFixed(1));

    document.getElementById('ar-turret-angles').textContent =
      `PAN-TILT YAW: ${state.turretYaw >= 0 ? '+' : ''}${Math.round(state.turretYaw)}° | PITCH: ${state.turretPitch >= 0 ? '+' : ''}${Math.round(state.turretPitch)}°`;

    // 3. Telémetro Frontal AR (HC-SR04 + ToF VL53L0X)
    const rangeBox = document.getElementById('ar-rangefinder');
    const minDist = Math.min(state.tofDistance, state.ultrasonicDistance);
    if (minDist < 1.2) {
      rangeBox.className = 'ar-floating-readout danger';
      rangeBox.textContent = `⚠ COLISIÓN: ${minDist.toFixed(2)} m (ALERTA)`;
    } else if (minDist < 2.8) {
      rangeBox.className = 'ar-floating-readout warning';
      rangeBox.textContent = `PROXIMIDAD: ${minDist.toFixed(2)} m (PRECAUCIÓN)`;
    } else {
      rangeBox.className = 'ar-floating-readout';
      rangeBox.textContent = `ToF LÁSER: ${state.tofDistance.toFixed(2)} m | DESPEJADO`;
    }

    // 4. Panel Izquierdo: Telemetría Cinemática, Eléctrica y Sensores
    document.getElementById('val-speed').textContent = `${Math.abs(state.speed).toFixed(2)} m/s`;
    document.getElementById('val-pwm').textContent = `${state.pwmPercent}% PWM`;
    document.getElementById('bar-pwm').style.width = `${state.pwmPercent}%`;

    document.getElementById('val-tof').textContent = `${state.tofDistance.toFixed(2)} m`;
    document.getElementById('val-ultrasonic').textContent = `${state.ultrasonicDistance.toFixed(2)} m`;

    const bellyEl = document.getElementById('val-clearance');
    bellyEl.textContent = `${(state.bellyClearance * 100).toFixed(0)} cm`;
    bellyEl.className = 'metric-value ' + (state.highCentered ? 'red' : state.bellyClearance < 0.12 ? 'amber' : 'green');

    const torsionDeg = Math.abs(THREE.MathUtils.radToDeg(state.frontRoll - state.rearRoll));
    document.getElementById('val-bellows-roll').textContent = `${torsionDeg.toFixed(1)}°`;
    document.getElementById('val-bellows-yaw').textContent = `${Math.round(THREE.MathUtils.radToDeg(state.articulationYaw))}°`;

    const latEl = document.getElementById('val-latency');
    latEl.textContent = `${state.latencyMs} ms (${state.fpsSim} FPS)`;
    latEl.className = 'metric-value ' + (state.latencyMs < 50 ? 'green' : state.latencyMs < 75 ? 'amber' : 'red');

    // Estado de contacto de cada rueda en la grilla
    rover.wheels.forEach((w) => {
      const pill = document.getElementById(`wheel-pill-${w.id}`);
      if (!pill) return;
      if (!w.active) {
        pill.className = 'wheel-pill disabled';
        pill.textContent = `${w.id}: OFF`;
      } else if (w.grounded) {
        pill.className = 'wheel-pill';
        pill.textContent = `${w.id}: OK`;
      } else {
        pill.className = 'wheel-pill airborne';
        pill.textContent = `${w.id}: AIRE`;
      }
    });

    // 5. Consola Inferior HOTAS (Logitech Extreme 3D Pro + Teclado)
    const hs = window.HotasController ? window.HotasController.getState() : null;
    const hcfg = window.HotasController ? window.HotasController.getConfig() : null;

    // Actualizar insignia de conexión en barra superior
    const connBtn = document.getElementById('btn-hotas-config');
    const connLabel = document.getElementById('hotas-conn-label');
    if (connBtn && connLabel && hs) {
      if (hs.connected) {
        connBtn.className = 'hud-btn hotas-badge connected';
        connLabel.textContent = hs.isLogitech3DPro
          ? '🕹️ LOGITECH 3D PRO: ACTIVO'
          : '🕹️ JOYSTICK USB: ACTIVO';
      } else {
        connBtn.className = 'hud-btn hotas-badge waiting';
        connLabel.textContent = '🕹️ LOGITECH 3D PRO: ESPERANDO USB';
      }
    }

    const throttlePct = state.throttleInput * 100;
    const handleTop = 50 - state.throttleInput * 44;
    document.getElementById('throttle-handle').style.top = `${handleTop}%`;
    const fillEl = document.getElementById('throttle-fill');
    if (throttlePct >= 0) {
      fillEl.style.bottom = '50%';
      fillEl.style.height = `${throttlePct * 0.45}%`;
      fillEl.style.background = 'var(--hud-orange)';
    } else {
      fillEl.style.bottom = `${50 + throttlePct * 0.45}%`;
      fillEl.style.height = `${Math.abs(throttlePct) * 0.45}%`;
      fillEl.style.background = 'var(--hud-amber)';
    }

    // Posición de la leva física Throttle Base en el Logitech Extreme 3D Pro
    const limitMarker = document.getElementById('throttle-limit-marker');
    const modeSub = document.getElementById('hotas-mode-sub');
    const limitSub = document.getElementById('hotas-limit-sub');
    if (hs && hcfg) {
      const sliderPct = Math.round((hs.connected && hs.throttleTouched ? 0.22 + 0.78 * hs.throttleSlider : 1.0) * 100);
      if (limitMarker) {
        limitMarker.style.bottom = `${hs.connected ? hs.throttleSlider * 94 : 94}%`;
      }
      if (modeSub) {
        modeSub.textContent =
          hcfg.throttleMode === 'hotas_cruise'
            ? `Modo: Crucero (${hs.cruiseReverse ? 'REV' : 'FWD'})`
            : 'Modo: Stick Y + Límite';
      }
      if (limitSub) {
        limitSub.textContent =
          hcfg.throttleMode === 'hotas_cruise'
            ? `Leva Base: ${Math.round(hs.throttleSlider * 100)}%`
            : `Techo Potencia: ${sliderPct}%`;
      }
    }

    document.getElementById('hotas-throttle-val').textContent =
      state.brakeActive ? 'FRENO [B1]' : `${throttlePct >= 0 ? '+' : ''}${Math.round(throttlePct)}% PWM`;

    // Stick de Dirección (X/Y) + Barra de Rotación de Puño (Twist Z)
    const stickDot = document.getElementById('drive-stick-dot');
    stickDot.style.left = `${50 - state.stickX * 38}%`;
    stickDot.style.top = `${50 - state.throttleInput * 38}%`;
    document.getElementById('hotas-steer-val').textContent = `GIRO: ${Math.round(-state.stickX * 100)}%`;

    const twistVal = hs && hs.connected ? hs.twistZ : 0;
    const twistDot = document.getElementById('twist-bar-dot');
    if (twistDot) {
      twistDot.style.left = `${50 + twistVal * 42}%`;
    }
    const twistReadout = document.getElementById('hotas-twist-val');
    if (twistReadout) {
      twistReadout.textContent = `Twist Z: ${twistVal >= 0 ? '+' : ''}${Math.round(twistVal * 100)}%`;
    }

    const dzRing = document.getElementById('stick-deadzone-ring');
    if (dzRing && hcfg) {
      const dSize = Math.max(6, Math.round(hcfg.deadzoneStick * 100 * 1.4));
      dzRing.style.width = `${dSize}%`;
      dzRing.style.height = `${dSize}%`;
    }

    // Gimbal de Torreta Pan-Tilt (POV Hat 8-Vías)
    const turretDot = document.getElementById('turret-stick-dot');
    turretDot.style.left = `${50 - (state.turretYaw / 135) * 38}%`;
    turretDot.style.top = `${50 - (state.turretPitch / 52) * 38}%`;
    document.getElementById('hotas-turret-val').textContent =
      `${Math.round(state.turretYaw)}° / ${Math.round(state.turretPitch)}°`;

    const hatDirEl = document.getElementById('hotas-hat-dir');
    if (hatDirEl && hs) {
      hatDirEl.textContent = `Hat: ${hs.hatDirectionLabel}`;
    }

    // Matriz de los 12 Botones del Logitech Extreme 3D Pro
    if (hs) {
      let activeBtnLabel = 'LISTO';
      document.querySelectorAll('[data-joybtn]').forEach((pill) => {
        const bNum = parseInt(pill.getAttribute('data-joybtn'), 10);
        const isPressed = !!(hs.connected && hs.buttonsPressed[bNum - 1]);
        pill.classList.toggle('pressed', isPressed);
        if (isPressed) activeBtnLabel = `BOTÓN ${bNum} ACTIVO`;
      });
      const btnReadout = document.getElementById('hotas-active-btn-readout');
      if (btnReadout) btnReadout.textContent = activeBtnLabel;
    }

    // 6. Si el Modal de Calibración del Logitech Extreme 3D Pro está abierto, actualizar telemetría cruda
    const hotasModal = document.getElementById('hotas-modal');
    if (hotasModal && !hotasModal.classList.contains('hidden') && hs && hcfg) {
      const strip = document.getElementById('hotas-modal-status-strip');
      const devName = document.getElementById('hotas-device-name');
      if (hs.connected) {
        strip.className = 'hotas-status-strip connected';
        devName.textContent = `✅ CONECTADO: ${hs.id} (Ejes: ${hs.axesRaw.length} | Botones: 12)`;
      } else {
        strip.className = 'hotas-status-strip';
        devName.textContent = '⏳ Esperando Logitech Extreme 3D Pro (Mové el stick o presioná el Gatillo B1)';
      }

      document.getElementById('calib-bar-x').style.width = `${50 + hs.stickX * 50}%`;
      document.getElementById('calib-bar-y').style.width = `${50 + hs.stickY * 50}%`;
      document.getElementById('calib-bar-twist').style.width = `${50 + hs.twistZ * 50}%`;
      document.getElementById('calib-bar-throttle').style.width = `${hs.throttleSlider * 100}%`;

      document.querySelectorAll('[data-learn]').forEach((btn) => {
        const key = btn.getAttribute('data-learn');
        const isLearning = hs.learningTarget === key;
        btn.classList.toggle('learning', isLearning);
        btn.textContent = isLearning ? '⚡ Mové eje...' : '🎯 Detectar';
      });

      // Sincronizar selectores si el modo aprendizaje acaba de capturar un eje
      if (!hs.learningTarget) {
        document.getElementById('cfg-axis-x').value = String(hcfg.axisX);
        document.getElementById('cfg-axis-y').value = String(hcfg.axisY);
        document.getElementById('cfg-axis-twist').value = String(hcfg.axisTwist);
        document.getElementById('cfg-axis-throttle').value = String(hcfg.axisThrottle);
      }

      const rawEl = document.getElementById('raw-axes-readout');
      if (rawEl) {
        if (hs.connected && hs.axesRaw.length > 0) {
          rawEl.textContent = hs.axesRaw
            .map((v, i) => `A[${i}]: ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
            .join(' | ');
        } else {
          rawEl.textContent = 'Sin señal USB activa (usando controles de teclado/mouse).';
        }
      }

      document.querySelectorAll('[data-btnrow]').forEach((row) => {
        const bNum = parseInt(row.getAttribute('data-btnrow'), 10);
        row.classList.toggle('active-row', !!(hs.connected && hs.buttonsPressed[bNum - 1]));
      });
    }
  }

  // =========================================================================
  // MÓDULO DE STREAMING VR WI-FI BAJO DEMANDA PARA CELULAR EN CASCO VR
  // (Desactivado por defecto: solo transmite cuando el usuario lo activa con el botón)
  // =========================================================================
  const vrStream = {
    active: false,         // OFF por defecto tal como fue solicitado
    serverReachable: false,
    camSource: 'fpv',      // 'fpv' (siempre 1ra persona) o 'mirror'
    quality: 'balanced',   // 'fast' (480x300), 'balanced' (600x375), 'hd' (768x480)
    allowGyro: true,
    urls: ['http://10.110.16.176:8090/vr'],
    clientsCount: 0,
    framesSent: 0,
    pushInFlight: false,
    lastCaptureTime: 0,
    canvas: document.createElement('canvas'),
    ctx: null
  };
  vrStream.canvas.width = 600;
  vrStream.canvas.height = 375;
  vrStream.ctx = vrStream.canvas.getContext('2d');

  function applyVrQualityPreset(preset) {
    vrStream.quality = preset;
    if (preset === 'fast') {
      vrStream.canvas.width = 480;
      vrStream.canvas.height = 300;
    } else if (preset === 'hd') {
      vrStream.canvas.width = 768;
      vrStream.canvas.height = 480;
    } else {
      vrStream.canvas.width = 600;
      vrStream.canvas.height = 375;
    }
  }

  async function refreshVrServerInfo() {
    try {
      const res = await fetch('http://localhost:8090/api/info', { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        vrStream.serverReachable = true;
        if (info.urls && info.urls.length) {
          vrStream.urls = info.urls;
        }
        vrStream.clientsCount = info.clientsCount || 0;
      }
    } catch (err) {
      vrStream.serverReachable = false;
    }
    updateVrWifiModalUI();
  }

  function updateVrWifiModalUI() {
    const topBtn = document.getElementById('btn-vr-wifi');
    const topLbl = document.getElementById('vr-wifi-label');
    if (topBtn && topLbl) {
      topBtn.classList.toggle('active', vrStream.active);
      topLbl.textContent = vrStream.active ? '🥽 VR WIFI: EN VIVO' : '🥽 VR WIFI: OFF';
    }

    const strip = document.getElementById('vr-wifi-status-strip');
    const title = document.getElementById('vr-wifi-state-title');
    const sub = document.getElementById('vr-wifi-state-sub');
    const mainBtn = document.getElementById('btn-toggle-vr-stream-main');
    const urlsBox = document.getElementById('vr-wifi-urls-box');
    const telEl = document.getElementById('vr-wifi-telemetry-readout');

    if (strip && title && sub && mainBtn) {
      if (vrStream.active) {
        strip.className = 'hotas-status-strip connected';
        title.textContent = '🟢 TRANSMITIENDO EN VIVO AL CASCO VR POR WI-FI';
        sub.textContent = vrStream.serverReachable
          ? 'Abrí la dirección de abajo en el navegador de tu celular y colocalo en el casco VR.'
          : '⚠ Ejecutá INICIAR_SIMULADOR.bat (o python wifi_vr_server.py) para habilitar el servidor Wi-Fi en el puerto 8090.';
        mainBtn.textContent = '⏹ DETENER STREAMING VR';
        mainBtn.className = 'hud-btn active';
      } else {
        strip.className = 'hotas-status-strip';
        title.textContent = '⏹ TRANSMISIÓN VR WI-FI DESACTIVADA (0% USO DE RED)';
        sub.textContent = 'El streaming está apagado por defecto. Pulsá el botón de la derecha (o la tecla K) cuando quieras transmitir al teléfono.';
        mainBtn.textContent = '▶ ACTIVAR STREAMING VR';
        mainBtn.className = 'hud-btn accent';
      }
    }

    if (urlsBox) {
      urlsBox.innerHTML = vrStream.urls
        .map(
          (u) => `
          <div class="vr-url-item">
            <span>📱 ${u}</span>
            <button class="learn-axis-btn" onclick="navigator.clipboard && navigator.clipboard.writeText('${u}')">📋 Copiar</button>
          </div>`
        )
        .join('');
    }

    if (telEl) {
      telEl.textContent = `Estado: ${vrStream.active ? 'TRANSMITIENDO' : 'APAGADO'} | Servidor 8090: ${
        vrStream.serverReachable ? 'ONLINE' : 'SIN CONEXIÓN'
      } | Celulares VR: ${vrStream.clientsCount} | Cuadros enviados: ${vrStream.framesSent}`;
    }
  }

  function setVrStreamActive(enable) {
    vrStream.active = !!enable;
    if (vrStream.active) {
      refreshVrServerInfo();
      showBannerAlert('🥽 STREAMING VR WI-FI ACTIVADO • ABRÍ /vr EN TU CELULAR', 'success', 3200);
    } else {
      fetch('http://localhost:8090/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      }).catch(() => {});
      showBannerAlert('⏹ STREAMING VR WI-FI DETENIDO', 'danger', 2000);
    }
    updateVrWifiModalUI();
  }

  function toggleVrWifiQuick() {
    const modal = document.getElementById('vr-wifi-modal');
    if (!vrStream.active) {
      setVrStreamActive(true);
      if (modal) modal.classList.remove('hidden');
    } else {
      setVrStreamActive(false);
    }
  }

  function openVrWifiModal() {
    const modal = document.getElementById('vr-wifi-modal');
    if (!modal) return;
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
      refreshVrServerInfo();
    }
  }

  const btnVrWifi = document.getElementById('btn-vr-wifi');
  if (btnVrWifi) btnVrWifi.addEventListener('click', toggleVrWifiQuick);
  const btnOpenVrSide = document.getElementById('btn-open-vr-wifi-panel');
  if (btnOpenVrSide) btnOpenVrSide.addEventListener('click', openVrWifiModal);
  const btnCloseVrModal = document.getElementById('btn-close-vr-wifi-modal');
  if (btnCloseVrModal) {
    btnCloseVrModal.addEventListener('click', () => {
      document.getElementById('vr-wifi-modal').classList.add('hidden');
    });
  }
  const btnToggleVrMain = document.getElementById('btn-toggle-vr-stream-main');
  if (btnToggleVrMain) {
    btnToggleVrMain.addEventListener('click', () => {
      setVrStreamActive(!vrStream.active);
    });
  }
  const selVrCam = document.getElementById('vr-cfg-cam-source');
  if (selVrCam) {
    selVrCam.addEventListener('change', (e) => {
      vrStream.camSource = e.target.value;
    });
  }
  const selVrQual = document.getElementById('vr-cfg-quality');
  if (selVrQual) {
    selVrQual.addEventListener('change', (e) => {
      applyVrQualityPreset(e.target.value);
    });
  }
  const chkVrGyro = document.getElementById('vr-cfg-allow-gyro');
  if (chkVrGyro) {
    chkVrGyro.addEventListener('change', (e) => {
      vrStream.allowGyro = e.target.checked;
    });
  }

  function captureAndPushVrFrame(now, w, h) {
    if (!vrStream.active || vrStream.pushInFlight) return;
    const intervalMs = vrStream.quality === 'fast' ? 35 : vrStream.quality === 'hd' ? 55 : 42;
    if (now - vrStream.lastCaptureTime < intervalMs) return;
    vrStream.lastCaptureTime = now;

    const camToStream = vrStream.camSource === 'fpv' ? rover.fpvCamera : state.cameraMode === 'fpv' ? rover.fpvCamera : thirdPersonCam;

    // Renderizar la cámara FPV para capturar el cuadro hacia el celular sin alterar el monitor de la PC
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(scene, camToStream);

    const cw = vrStream.canvas.width;
    const ch = vrStream.canvas.height;
    const ctx = vrStream.ctx;
    ctx.drawImage(renderer.domElement, 0, 0, cw, ch);

    // Dibujar retícula AR y horizonte artificial directamente sobre el frame FPV enviado al Casco VR
    const cx = cw * 0.5;
    const cy = ch * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.78)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(cw, ch) * 0.24, 0, Math.PI * 2);
    ctx.stroke();

    // Horizonte Artificial Dinámico (Roll & Pitch)
    ctx.save();
    ctx.translate(cx, cy + state.frontPitch * 45);
    ctx.rotate(state.frontRoll);
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.lineTo(-16, 0);
    ctx.moveTo(16, 0);
    ctx.lineTo(48, 0);
    ctx.stroke();
    ctx.restore();

    // Cruz central naranja SAR
    ctx.strokeStyle = '#ff7a29';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
    ctx.restore();

    const jpegQuality = vrStream.quality === 'fast' ? 0.6 : vrStream.quality === 'hd' ? 0.76 : 0.68;
    const frameDataUrl = vrStream.canvas.toDataURL('image/jpeg', jpegQuality);
    const headingDeg = Math.round(((THREE.MathUtils.radToDeg(state.heading) % 360) + 360) % 360)
      .toString()
      .padStart(3, '0');

    vrStream.pushInFlight = true;
    fetch('http://localhost:8090/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: true,
        fps: Math.round(1000 / intervalMs),
        frameDataUrl,
        telemetry: {
          heading: headingDeg,
          turretYaw: Math.round(state.turretYaw),
          turretPitch: Math.round(state.turretPitch),
          tof: state.tofDistance.toFixed(2),
          speed: Math.abs(state.speed).toFixed(2),
          clearance: (state.bellyClearance * 100).toFixed(0)
        }
      })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((resp) => {
        if (resp && resp.ok) {
          vrStream.serverReachable = true;
          vrStream.framesSent++;
          vrStream.clientsCount = resp.clientsCount || 0;
          if (vrStream.allowGyro && resp.headtrack && resp.headtrack.enabled) {
            state.turretYaw = THREE.MathUtils.clamp(resp.headtrack.yaw, -135, 135);
            state.turretPitch = THREE.MathUtils.clamp(resp.headtrack.pitch, -38, 52);
          }
          const modal = document.getElementById('vr-wifi-modal');
          if (modal && !modal.classList.contains('hidden')) {
            updateVrWifiModalUI();
          }
        }
      })
      .catch(() => {
        vrStream.serverReachable = false;
      })
      .finally(() => {
        vrStream.pushInFlight = false;
      });
  }

  // =========================================================================
  // RENDERIZADO PRINCIPAL Y VENTANA PICTURE-IN-PICTURE (PiP)
  // =========================================================================
  let lastFrameTime = performance.now();
  let lastFpvRenderTime = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    const elapsed = now * 0.001;

    updatePhysics(dt, elapsed);
    updateSensorsAndBeacons(elapsed);
    updateHUD();

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Si el botón de Streaming VR Wi-Fi está ACTIVO, capturar cuadro FPV hacia el celular
    if (vrStream.active) {
      captureAndPushVrFrame(now, w, h);
    }

    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.clear();

    const mainCam = state.cameraMode === 'fpv' ? rover.fpvCamera : thirdPersonCam;
    const pipCam = state.cameraMode === 'fpv' ? thirdPersonCam : rover.fpvCamera;

    // Si estamos en Wi-Fi congestionada en modo FPV, simulamos la caída de FPS (<10 FPS)
    const minFrameInterval = 1000 / state.fpsSim;
    if (state.cameraMode === 'fpv' && state.fpsSim < 45) {
      if (now - lastFpvRenderTime >= minFrameInterval) {
        renderer.render(scene, mainCam);
        lastFpvRenderTime = now;
      } else {
        renderer.render(scene, mainCam);
      }
    } else {
      renderer.render(scene, mainCam);
    }

    // Renderizar ventana secundaria Picture-in-Picture (esquina inferior derecha)
    if (state.pipEnabled) {
      const pipW = 290;
      const pipH = 195;
      const pipX = w - pipW - 16;
      const pipY = 16; // En coordenadas WebGL Y=0 es abajo

      pipCam.aspect = pipW / pipH;
      pipCam.updateProjectionMatrix();

      renderer.setViewport(pipX, pipY, pipW, pipH);
      renderer.setScissor(pipX, pipY, pipW, pipH);
      renderer.clearDepth();
      renderer.render(scene, pipCam);

      // Restaurar aspect ratio de la cámara usada en PiP
      pipCam.aspect = w / h;
      pipCam.updateProjectionMatrix();
    }
  }

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    thirdPersonCam.aspect = w / h;
    thirdPersonCam.updateProjectionMatrix();
    rover.fpvCamera.aspect = w / h;
    rover.fpvCamera.updateProjectionMatrix();
  });

  // Inicializar configuración por defecto y arrancar simulación
  setDrivetrain('8x8');
  rover.setLightsIntensity(1);
  requestAnimationFrame(animate);
})();
