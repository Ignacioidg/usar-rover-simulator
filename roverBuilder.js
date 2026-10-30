// roverBuilder.js - Construcción procedural detallada del Rover USAR Articulado "SAR RESCUE"
// Basado en el diseño conceptual y el análisis de ingeniería del Grupo 4 (UAI)

(function () {
  function createSideDecalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Fondo naranja industrial SAR con sutil gradiente metálico
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#e8662a');
    grad.addColorStop(0.55, '#d6521b');
    grad.addColorStop(1, '#a83c10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Líneas de paneles y remaches
    ctx.strokeStyle = 'rgba(20, 24, 28, 0.65)';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, 484, 228);
    ctx.beginPath();
    ctx.moveTo(180, 14);
    ctx.lineTo(180, 242);
    ctx.stroke();

    // Franja reflectiva superior amarillo/naranja
    ctx.fillStyle = '#facc15';
    ctx.fillRect(28, 26, 130, 18);
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(195, 26, 280, 16);

    // Texto "SAR RESCUE"
    ctx.fillStyle = '#181c20';
    ctx.font = '900 54px "Inter", "Arial Black", sans-serif';
    ctx.fillText('SAR', 215, 118);
    ctx.font = '800 28px "Inter", "Arial", sans-serif';
    ctx.fillText('RESCUE', 217, 152);

    // Franja inferior de peligro (amarillo / negro a 45°)
    ctx.save();
    ctx.beginPath();
    ctx.rect(24, 188, 464, 38);
    ctx.clip();
    ctx.fillStyle = '#eab308';
    ctx.fillRect(24, 188, 464, 38);
    ctx.fillStyle = '#14171a';
    for (let x = -40; x < 540; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 226);
      ctx.lineTo(x + 18, 226);
      ctx.lineTo(x + 38, 188);
      ctx.lineTo(x + 20, 188);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Desgaste sutil de polvo en el borde inferior
    const dustGrad = ctx.createLinearGradient(0, 180, 0, 256);
    dustGrad.addColorStop(0, 'rgba(120, 105, 90, 0)');
    dustGrad.addColorStop(1, 'rgba(110, 98, 84, 0.38)');
    ctx.fillStyle = dustGrad;
    ctx.fillRect(0, 180, 512, 76);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function createRearSideTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base naranja + panel técnico gris oscuro
    ctx.fillStyle = '#d4511a';
    ctx.fillRect(0, 0, 512, 256);

    // Franja reflectiva superior lima/amarilla y hazard en esquina
    ctx.fillStyle = '#d9f99d';
    ctx.fillRect(20, 20, 330, 18);

    // Hazard esquina superior derecha
    ctx.save();
    ctx.beginPath();
    ctx.rect(360, 18, 132, 22);
    ctx.clip();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(360, 18, 132, 22);
    ctx.fillStyle = '#18181b';
    for (let x = 340; x < 510; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x + 12, 40);
      ctx.lineTo(x + 24, 18);
      ctx.lineTo(x + 12, 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Panel gris grafito con rejillas de ventilación (louvers)
    ctx.fillStyle = '#272b30';
    ctx.fillRect(24, 54, 464, 145);
    ctx.strokeStyle = '#14171a';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 54, 464, 145);

    // Puerta de inspección izquierda con manija naranja
    ctx.strokeRect(42, 70, 130, 112);
    ctx.fillStyle = '#e8662a';
    ctx.fillRect(142, 112, 16, 32);

    // Rejillas de ventilación derechas
    ctx.fillStyle = '#111317';
    for (let y = 74; y <= 172; y += 14) {
      ctx.fillRect(205, y, 255, 7);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  function createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#18181b';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 128);
      ctx.lineTo(i + 16, 128);
      ctx.lineTo(i + 80, 0);
      ctx.lineTo(i + 64, 0);
      ctx.closePath();
      ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }

  function createUSARRover(scene) {
    const root = new THREE.Group();
    root.name = 'USAR_Rover_Root';

    // Materiales compartidos
    const orangePaintMat = new THREE.MeshStandardMaterial({
      color: 0xd9561e,
      roughness: 0.42,
      metalness: 0.18
    });
    const frontSideMat = new THREE.MeshStandardMaterial({
      map: createSideDecalTexture(),
      roughness: 0.45,
      metalness: 0.15
    });
    const rearSideMat = new THREE.MeshStandardMaterial({
      map: createRearSideTexture(),
      roughness: 0.48,
      metalness: 0.2
    });
    const darkArmorMat = new THREE.MeshStandardMaterial({
      color: 0x262a2e,
      roughness: 0.55,
      metalness: 0.45
    });
    const blackRubberMat = new THREE.MeshStandardMaterial({
      color: 0x17191c,
      roughness: 0.85,
      metalness: 0.08
    });
    const tireRubberMat = new THREE.MeshStandardMaterial({
      color: 0x242322,
      roughness: 0.88,
      metalness: 0.05
    });
    const rimMetalMat = new THREE.MeshStandardMaterial({
      color: 0x383c42,
      roughness: 0.4,
      metalness: 0.7
    });
    const yellowTTMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.1
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd4d8dd,
      roughness: 0.2,
      metalness: 0.9
    });
    const redAccentMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
      metalness: 0.2
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      map: createHazardTexture(),
      roughness: 0.4
    });
    const lensGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0a192f,
      emissive: 0x002b49,
      emissiveIntensity: 0.5,
      roughness: 0.08,
      metalness: 0.9
    });
    const ledEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4d6,
      emissiveIntensity: 2.5
    });

    // =========================================================
    // 1. MÓDULO DELANTERO (Instrumentación, Cabina, Sensores)
    // =========================================================
    const frontModule = new THREE.Group();
    frontModule.position.set(0, 0, 1.05);
    root.add(frontModule);

    // Cuerpo principal delantero con laterales texturizados "SAR RESCUE"
    const frontBodyGeo = new THREE.BoxGeometry(1.72, 0.68, 2.05);
    const frontBodyMaterials = [
      frontSideMat, // Derecha
      frontSideMat, // Izquierda
      orangePaintMat, // Arriba
      darkArmorMat, // Abajo
      orangePaintMat, // Frente
      darkArmorMat  // Atrás (conexión fuelle)
    ];
    const frontBodyMesh = new THREE.Mesh(frontBodyGeo, frontBodyMaterials);
    frontBodyMesh.position.set(0, 0.52, 0);
    frontBodyMesh.castShadow = true;
    frontBodyMesh.receiveShadow = true;
    frontModule.add(frontBodyMesh);

    // Capó biselado frontal y placa roja superior (como en el concept art)
    const hoodTopGeo = new THREE.BoxGeometry(1.48, 0.12, 0.85);
    const hoodTop = new THREE.Mesh(hoodTopGeo, orangePaintMat);
    hoodTop.position.set(0, 0.88, 0.42);
    hoodTop.rotation.x = 0.08;
    hoodTop.castShadow = true;
    frontModule.add(hoodTop);

    const redPatch = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.28), redAccentMat);
    redPatch.position.set(0, 0.94, 0.62);
    redPatch.rotation.x = 0.08;
    frontModule.add(redPatch);

    // Parrilla frontal blindada gris grafito con sensores HC-SR04 + ToF / Micro-LiDAR
    const grilleArmor = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.42, 0.16), darkArmorMat);
    grilleArmor.position.set(0, 0.54, 1.01);
    frontModule.add(grilleArmor);

    // Sensores frontales duales (HC-SR04 + ToF VL53L0X) en el centro de la parrilla
    const sensorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.24, 0.08), blackRubberMat);
    sensorHousing.position.set(0, 0.54, 1.08);
    frontModule.add(sensorHousing);

    [-0.14, 0.14].forEach((sx) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 20), chromeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(sx, 0.54, 1.11);
      frontModule.add(ring);

      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 16), lensGlassMat);
      core.rotation.x = Math.PI / 2;
      core.position.set(sx, 0.54, 1.115);
      frontModule.add(core);
    });

    // Faros LED dobles empotrados a cada lado del frente
    const headlightPositions = [-0.62, -0.45, 0.45, 0.62];
    headlightPositions.forEach((hx) => {
      const lampLens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), ledEmissiveMat);
      lampLens.rotation.x = Math.PI / 2;
      lampLens.position.set(hx, 0.53, 1.085);
      frontModule.add(lampLens);
    });

    // Paragolpes inferior, malacate (winch), grilletes en U y placa skid-plate acanalada
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.24, 0.28), orangePaintMat);
    frontBumper.position.set(0, 0.24, 1.02);
    frontModule.add(frontBumper);

    const winchBox = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.12), darkArmorMat);
    winchBox.position.set(0, 0.24, 1.14);
    frontModule.add(winchBox);

    const winchSlot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.06), chromeMat);
    winchSlot.position.set(0, 0.24, 1.19);
    frontModule.add(winchSlot);

    // Dos grilletes de rescate (ganchos U) en el paragolpes
    [-0.44, 0.44].forEach((tx) => {
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 10, 18), chromeMat);
      shackle.position.set(tx, 0.21, 1.18);
      frontModule.add(shackle);
    });

    // Placa protectora de bajos (Skid Plate) inclinada
    const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.68), darkArmorMat);
    skidPlate.position.set(0, 0.06, 0.85);
    skidPlate.rotation.x = -0.38;
    frontModule.add(skidPlate);

    // Cable de acero de remolque recorriendo el frente y los guardabarros (fiel a la imagen)
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.88, 0.56, -0.65),
      new THREE.Vector3(-0.89, 0.62, 0.35),
      new THREE.Vector3(-0.78, 0.44, 1.08),
      new THREE.Vector3(0, 0.36, 1.16),
      new THREE.Vector3(0.78, 0.44, 1.08),
      new THREE.Vector3(0.89, 0.62, 0.35),
      new THREE.Vector3(0.88, 0.56, -0.65)
    ]);
    const steelCableGeo = new THREE.TubeGeometry(cableCurve, 44, 0.032, 8, false);
    const steelCable = new THREE.Mesh(steelCableGeo, darkArmorMat);
    frontModule.add(steelCable);

    // Dos reflectores LED superiores sobre el capó
    const hoodSpotlights = [];
    [-0.56, 0.56].forEach((lx) => {
      const podGroup = new THREE.Group();
      podGroup.position.set(lx, 0.94, 0.56);
      const podBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.16), darkArmorMat);
      podGroup.add(podBody);
      const podLens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.04), ledEmissiveMat);
      podLens.position.z = 0.075;
      podGroup.add(podLens);
      frontModule.add(podGroup);
      hoodSpotlights.push(podLens);
    });

    // Manijas de agarre superiores del módulo delantero
    [-0.78, 0.78].forEach((hx) => {
      [-0.45, 0.25].forEach((hz) => {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.36), darkArmorMat);
        handle.position.set(hx, 0.9, hz);
        frontModule.add(handle);
      });
    });

    // Luz frontal solidaria al chasis
    const chassisSpotLight = new THREE.SpotLight(0xfff5e0, 2.2, 42, Math.PI / 4, 0.45, 1.3);
    chassisSpotLight.position.set(0, 0.92, 0.95);
    chassisSpotLight.target.position.set(0, 0.1, 14);
    chassisSpotLight.castShadow = true;
    chassisSpotLight.shadow.mapSize.width = 1024;
    chassisSpotLight.shadow.mapSize.height = 1024;
    frontModule.add(chassisSpotLight);
    frontModule.add(chassisSpotLight.target);

    // =========================================================
    // 2. TORRETA PAN-TILT 2-DoF (ESP32-CAM + Visión Estéreo/ToF + Iluminación Solidaria)
    // =========================================================
    const turretYawGroup = new THREE.Group();
    turretYawGroup.position.set(0, 0.92, 0.08);
    frontModule.add(turretYawGroup);

    // Pedestal circular de giro Yaw
    const yawBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 24), darkArmorMat);
    yawBase.position.y = 0.06;
    turretYawGroup.add(yawBase);

    // Horquilla en U de soporte Pan-Tilt con franjas hazard laterales
    const yokeBase = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.09, 0.28), darkArmorMat);
    yokeBase.position.y = 0.15;
    turretYawGroup.add(yokeBase);

    [-0.25, 0.25].forEach((yx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.26), darkArmorMat);
      arm.position.set(yx, 0.38, 0);
      arm.castShadow = true;
      turretYawGroup.add(arm);

      const hazardPatch = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), hazardMat);
      hazardPatch.position.set(yx > 0 ? yx + 0.046 : yx - 0.046, 0.26, 0);
      hazardPatch.rotation.y = yx > 0 ? Math.PI / 2 : -Math.PI / 2;
      turretYawGroup.add(hazardPatch);
    });

    // Grupo Pitch (Cabezal óptico basculante)
    const turretPitchGroup = new THREE.Group();
    turretPitchGroup.position.set(0, 0.48, 0);
    turretYawGroup.add(turretPitchGroup);

    const camHeadBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.32), darkArmorMat);
    camHeadBox.castShadow = true;
    turretPitchGroup.add(camHeadBox);

    // Lentes gemelos frontales (ESP32-CAM FPV + Lente ToF/Estéreo)
    [-0.1, 0.1].forEach((cx) => {
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 22), blackRubberMat);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(cx, 0, 0.15);
      turretPitchGroup.add(bezel);

      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.09, 20), lensGlassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(cx, 0, 0.155);
      turretPitchGroup.add(glass);
    });

    // Proyectores LED solidarios al Pan-Tilt (Recomendación #5 de Ingeniería)
    [-0.17, 0.17].forEach((lx) => {
      const ledRing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), ledEmissiveMat);
      ledRing.position.set(lx, 0.07, 0.16);
      turretPitchGroup.add(ledRing);
    });

    const turretSpotLight = new THREE.SpotLight(0xe0f7ff, 2.8, 50, Math.PI / 4.2, 0.35, 1.1);
    turretSpotLight.position.set(0, 0.04, 0.22);
    turretSpotLight.target.position.set(0, 0.0, 15);
    turretSpotLight.castShadow = true;
    turretPitchGroup.add(turretSpotLight);
    turretPitchGroup.add(turretSpotLight.target);

    // Cámara FPV de 1ra Persona montada directamente en el eje óptico de la torreta
    const fpvCamera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 260);
    fpvCamera.position.set(0, 0.04, 0.22);
    fpvCamera.rotation.y = Math.PI; // Mira hacia +Z local del rover
    turretPitchGroup.add(fpvCamera);

    // =========================================================
    // 3. FUELLE CENTRAL ARTICULADO ("Inspiración Colectivo Articulado")
    // =========================================================
    const bellowsGroup = new THREE.Group();
    root.add(bellowsGroup);

    const bellowsSlices = [];
    const numSlices = 9;
    for (let i = 0; i < numSlices; i++) {
      const isRidge = i % 2 === 0;
      const w = isRidge ? 1.46 : 1.32;
      const h = isRidge ? 0.66 : 0.56;
      const sliceGeo = new THREE.BoxGeometry(w, h, 0.11);
      const sliceMesh = new THREE.Mesh(sliceGeo, blackRubberMat);
      sliceMesh.castShadow = true;
      sliceMesh.receiveShadow = true;
      bellowsGroup.add(sliceMesh);
      bellowsSlices.push(sliceMesh);
    }

    // =========================================================
    // 4. MÓDULO TRASERO (Baterías LiPo, Electrónica de Potencia y Antenas RF)
    // =========================================================
    const rearModule = new THREE.Group();
    rearModule.position.set(0, 0, -1.35);
    root.add(rearModule);

    const rearBodyGeo = new THREE.BoxGeometry(1.68, 0.66, 1.92);
    const rearBodyMaterials = [
      rearSideMat,
      rearSideMat,
      orangePaintMat,
      darkArmorMat,
      darkArmorMat,
      orangePaintMat
    ];
    const rearBodyMesh = new THREE.Mesh(rearBodyGeo, rearBodyMaterials);
    rearBodyMesh.position.set(0, 0.52, 0);
    rearBodyMesh.castShadow = true;
    rearBodyMesh.receiveShadow = true;
    rearModule.add(rearBodyMesh);

    // Valija estanca superior tipo Pelican (Baterías LiPo y telemetría)
    const pelicanCase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.25, 1.25), darkArmorMat);
    pelicanCase.position.set(0, 0.96, -0.1);
    pelicanCase.castShadow = true;
    rearModule.add(pelicanCase);

    // Costillas y cierres de la valija Pelican
    for (let z = -0.5; z <= 0.35; z += 0.28) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.27, 0.04), blackRubberMat);
      rib.position.set(0, 0.96, z);
      rearModule.add(rib);
    }

    // 3 Antenas posteriores con resorte en la base (5.8 GHz Video, Sub-GHz Telemetría, 2.4 GHz Control)
    const antennas = [];
    const antSpecs = [
      { x: -0.45, z: -0.62, h: 1.38 },
      { x: 0.42, z: -0.58, h: 1.52 },
      { x: 0.56, z: -0.82, h: 1.15 }
    ];
    antSpecs.forEach((spec) => {
      const antPivot = new THREE.Group();
      antPivot.position.set(spec.x, 0.88, spec.z);

      // Base resorte gruesa
      const springBase = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.24, 12), blackRubberMat);
      springBase.position.y = 0.12;
      antPivot.add(springBase);

      // Varilla flexible de antena
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.022, spec.h, 10), blackRubberMat);
      whip.position.y = 0.2 + spec.h / 2;
      antPivot.add(whip);

      rearModule.add(antPivot);
      antennas.push(antPivot);
    });

    // Luces traseras rojas de posición/rescate
    [-0.62, 0.62].forEach((rx) => {
      const tailLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.09, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xdd1111, emissiveIntensity: 1.6 })
      );
      tailLight.position.set(rx, 0.56, -0.97);
      rearModule.add(tailLight);
    });

    // =========================================================
    // 5. RUEDAS SOBREDIMENSIONADAS DE TACO PROFUNDO Y SUSPENSIÓN COILOVER
    // =========================================================
    function buildWheelUnit(isLeft) {
      const wheelAssembly = new THREE.Group();

      // Brazo de suspensión oscilante (Wishbone) y espiral helicoidal (Coilover Shock)
      const suspGroup = new THREE.Group();
      const armGeo = new THREE.BoxGeometry(0.38, 0.06, 0.12);
      const upperArm = new THREE.Mesh(armGeo, darkArmorMat);
      upperArm.position.set(isLeft ? 0.18 : -0.18, 0.14, 0);
      suspGroup.add(upperArm);

      // Amortiguador + resorte helicoidal visible
      const shockStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 12), chromeMat);
      shockStrut.position.set(isLeft ? 0.15 : -0.15, 0.22, 0);
      shockStrut.rotation.z = isLeft ? -0.25 : 0.25;
      suspGroup.add(shockStrut);

      const coilSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.28, 12, 6, true), blackRubberMat);
      coilSpring.position.copy(shockStrut.position);
      coilSpring.rotation.copy(shockStrut.rotation);
      suspGroup.add(coilSpring);

      wheelAssembly.add(suspGroup);

      // Grupo que rota al avanzar (Neumático + Llanta + Tacos 3D)
      const spinGroup = new THREE.Group();
      wheelAssembly.add(spinGroup);

      const wheelRadius = 0.52;
      const wheelWidth = 0.44;

      // Banda principal del neumático
      const tireMain = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.94, wheelRadius * 0.94, wheelWidth, 28),
        tireRubberMat
      );
      tireMain.rotation.z = Math.PI / 2;
      tireMain.castShadow = true;
      tireMain.receiveShadow = true;
      spinGroup.add(tireMain);

      // Tacos agresivos 3D (Deep-Lug Off-Road Tread) alrededor de la circunferencia
      const numLugs = 18;
      for (let i = 0; i < numLugs; i++) {
        const angle = (i / numLugs) * Math.PI * 2;
        const lugLeft = new THREE.Mesh(new THREE.BoxGeometry(wheelWidth * 0.46, 0.075, 0.11), tireRubberMat);
        lugLeft.position.set(
          isLeft ? -wheelWidth * 0.21 : wheelWidth * 0.21,
          Math.cos(angle) * (wheelRadius - 0.02),
          Math.sin(angle) * (wheelRadius - 0.02)
        );
        lugLeft.rotation.x = -angle;
        lugLeft.rotation.y = 0.22;
        spinGroup.add(lugLeft);

        const lugRight = new THREE.Mesh(new THREE.BoxGeometry(wheelWidth * 0.46, 0.075, 0.11), tireRubberMat);
        const angleOffset = angle + Math.PI / numLugs;
        lugRight.position.set(
          isLeft ? wheelWidth * 0.21 : -wheelWidth * 0.21,
          Math.cos(angleOffset) * (wheelRadius - 0.02),
          Math.sin(angleOffset) * (wheelRadius - 0.02)
        );
        lugRight.rotation.x = -angleOffset;
        lugRight.rotation.y = -0.22;
        spinGroup.add(lugRight);
      }

      // Llanta reforzada (cambia a amarilla en modo 4WD Prototipo Cátedra)
      const rimMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.54, wheelRadius * 0.54, wheelWidth + 0.03, 20),
        rimMetalMat.clone()
      );
      rimMesh.rotation.z = Math.PI / 2;
      spinGroup.add(rimMesh);

      const hubCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, wheelWidth + 0.07, 14),
        darkArmorMat
      );
      hubCap.rotation.z = Math.PI / 2;
      spinGroup.add(hubCap);

      return {
        assembly: wheelAssembly,
        spinGroup: spinGroup,
        suspGroup: suspGroup,
        shockStrut: shockStrut,
        rimMesh: rimMesh,
        isLeft: isLeft
      };
    }

    // Creamos las 8 unidades de rueda (4 en módulo delantero, 4 en módulo trasero)
    // En modo 6x6 desactivamos 1 eje o reubicamos los 3 ejes; en modo 4WD dejamos 2 ejes con escala reducida
    const wheelDefs = [
      { id: 'FL1', module: 'front', isLeft: true, x: 1.08, zLocal: 0.58 },
      { id: 'FR1', module: 'front', isLeft: false, x: -1.08, zLocal: 0.58 },
      { id: 'FL2', module: 'front', isLeft: true, x: 1.08, zLocal: -0.52 },
      { id: 'FR2', module: 'front', isLeft: false, x: -1.08, zLocal: -0.52 },
      { id: 'RL1', module: 'rear', isLeft: true, x: 1.08, zLocal: 0.48 },
      { id: 'RR1', module: 'rear', isLeft: false, x: -1.08, zLocal: 0.48 },
      { id: 'RL2', module: 'rear', isLeft: true, x: 1.08, zLocal: -0.62 },
      { id: 'RR2', module: 'rear', isLeft: false, x: -1.08, zLocal: -0.62 }
    ];

    const wheels = wheelDefs.map((def) => {
      const unit = buildWheelUnit(def.isLeft);
      unit.id = def.id;
      unit.moduleName = def.module;
      unit.baseX = def.x;
      unit.baseZLocal = def.zLocal;
      unit.currentZLocal = def.zLocal;
      unit.active = true;
      unit.grounded = true;
      unit.compression = 0;
      unit.assembly.position.set(def.x, 0, def.zLocal);

      if (def.module === 'front') {
        frontModule.add(unit.assembly);
      } else {
        rearModule.add(unit.assembly);
      }
      return unit;
    });

    // Función para cambiar en tiempo real entre 6x6 (Recomendado), 8x8 (Concept Art) y 4WD (Prototipo Cátedra)
    function setDrivetrainConfig(mode) {
      wheels.forEach((w) => {
        w.rimMesh.material.color.setHex(mode === '4wd' ? 0xfacc15 : 0x383c42);
        const scale = mode === '4wd' ? 0.62 : 1.0;
        w.spinGroup.scale.set(scale, scale, scale);
      });

      if (mode === '8x8') {
        // 4 ejes activos (2 adelante, 2 atrás, exacto a la imagen conceptual)
        wheels.forEach((w) => {
          w.active = true;
          w.assembly.visible = true;
          w.currentZLocal = w.baseZLocal;
          w.assembly.position.z = w.currentZLocal;
        });
      } else if (mode === '6x6') {
        // 3 ejes activos (6x6 equilibrado: 2 ejes en módulo delantero + 1 eje centralizado en módulo trasero)
        wheels.forEach((w) => {
          if (w.id === 'RL1' || w.id === 'RR1') {
            w.active = false;
            w.assembly.visible = false;
          } else if (w.id === 'RL2' || w.id === 'RR2') {
            w.active = true;
            w.assembly.visible = true;
            w.currentZLocal = -0.15;
            w.assembly.position.z = w.currentZLocal;
          } else {
            w.active = true;
            w.assembly.visible = true;
            w.currentZLocal = w.baseZLocal;
            w.assembly.position.z = w.currentZLocal;
          }
        });
      } else if (mode === '4wd') {
        // Prototipo base de cátedra: 4 ruedas pequeñas TT amarillas y menor despeje al suelo
        wheels.forEach((w) => {
          if (w.id === 'FL2' || w.id === 'FR2' || w.id === 'RL1' || w.id === 'RR1') {
            w.active = false;
            w.assembly.visible = false;
          } else {
            w.active = true;
            w.assembly.visible = true;
            w.currentZLocal = w.id.startsWith('F') ? 0.42 : -0.42;
            w.assembly.position.z = w.currentZLocal;
          }
        });
      }
    }

    // Actualizar interpolación 3D del fuelle central entre el módulo delantero y el trasero
    function updateBellowsAndAntennas(artYaw, artPitch, artRoll, speed, dt, time) {
      const startPos = new THREE.Vector3(0, 0.52, -0.02);
      frontModule.localToWorld(startPos);
      root.worldToLocal(startPos);

      const endPos = new THREE.Vector3(0, 0.52, 0.94);
      rearModule.localToWorld(endPos);
      root.worldToLocal(endPos);

      for (let i = 0; i < numSlices; i++) {
        const t = (i + 0.5) / numSlices;
        const slice = bellowsSlices[i];
        slice.position.lerpVectors(startPos, endPos, t);

        // Curvatura suave del fuelle en Yaw, Pitch y Roll
        slice.rotation.y = frontModule.rotation.y * (1 - t) + rearModule.rotation.y * t;
        slice.rotation.x = frontModule.rotation.x * (1 - t) + rearModule.rotation.x * t;
        slice.rotation.z = frontModule.rotation.z * (1 - t) + rearModule.rotation.z * t;
      }

      // Oscilación física de las 3 antenas traseras
      antennas.forEach((ant, idx) => {
        const freq = 6.5 + idx * 1.9;
        const swayX = -speed * 0.045 + Math.sin(time * freq + idx) * (0.02 + Math.abs(speed) * 0.015);
        const swayZ = Math.cos(time * (freq * 0.85) + idx * 2) * (0.018 + Math.abs(artYaw) * 0.08);
        ant.rotation.x = THREE.MathUtils.lerp(ant.rotation.x, swayX, Math.min(1, dt * 10));
        ant.rotation.z = THREE.MathUtils.lerp(ant.rotation.z, swayZ, Math.min(1, dt * 10));
      });
    }

    function setLightsIntensity(level) {
      // level: 0 = Off, 1 = Normal, 2 = High Power USAR
      const chassisInt = level === 0 ? 0 : level === 1 ? 2.2 : 4.2;
      const turretInt = level === 0 ? 0 : level === 1 ? 2.8 : 5.5;
      chassisSpotLight.intensity = chassisInt;
      turretSpotLight.intensity = turretInt;
      ledEmissiveMat.emissiveIntensity = level === 0 ? 0.15 : level === 1 ? 2.4 : 4.5;
    }

    scene.add(root);

    return {
      root,
      frontModule,
      rearModule,
      bellowsGroup,
      turretYawGroup,
      turretPitchGroup,
      fpvCamera,
      chassisSpotLight,
      turretSpotLight,
      wheels,
      setDrivetrainConfig,
      updateBellowsAndAntennas,
      setLightsIntensity
    };
  }

  window.RoverBuilder = {
    createUSARRover
  };
})();
