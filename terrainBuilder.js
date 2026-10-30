// terrainBuilder.js - Escenario de Derrumbe Urbano (USAR) con Física de Losas Inclinadas,
// Escombros, Hierros Retorcidos (Rebar), Túnel Colapsado y Balizas de Rescate

(function () {
  function createConcreteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#8b8982';
    ctx.fillRect(0, 0, 512, 512);

    // Moteado de hormigón y polvo de demolición
    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const v = 105 + Math.floor(Math.random() * 65);
      ctx.fillStyle = `rgb(${v}, ${v - 3}, ${v - 8})`;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    // Grietas estructurales
    ctx.strokeStyle = 'rgba(45, 42, 38, 0.55)';
    ctx.lineWidth = 2;
    for (let c = 0; c < 12; c++) {
      ctx.beginPath();
      let cx = Math.random() * 512;
      let cy = Math.random() * 512;
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 6; s++) {
        cx += (Math.random() - 0.5) * 70;
        cy += (Math.random() - 0.5) * 70;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function createUSARTerrain(scene) {
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);

    const concreteTex = createConcreteTexture();
    const groundTex = concreteTex.clone();
    groundTex.repeat.set(36, 36);
    groundTex.needsUpdate = true;

    const concreteMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.9,
      metalness: 0.05
    });

    const darkConcreteMat = new THREE.MeshStandardMaterial({
      color: 0x67655f,
      map: concreteTex,
      roughness: 0.92,
      metalness: 0.08
    });

    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x9e472a,
      roughness: 0.88,
      metalness: 0.04
    });

    const rebarMat = new THREE.MeshStandardMaterial({
      color: 0x3b302a,
      roughness: 0.6,
      metalness: 0.75
    });

    const slabColliders = [];
    const sensorMeshes = [];

    // Función de altura del terreno base continuo (ondulaciones suaves de polvo y escombro)
    function getBaseGroundHeight(x, z) {
      const distFromOrigin = Math.hypot(x, z);
      const gentleWave =
        Math.sin(x * 0.07) * Math.cos(z * 0.07) * 0.18 +
        Math.sin(x * 0.22 + z * 0.19) * 0.06;
      // Mantener zona de inicio relativamente nivelada debajo de las losas principales
      const flatten = Math.min(1, distFromOrigin / 8.0);
      return gentleWave * flatten;
    }

    // Malla del suelo base de 180m x 180m
    const groundGeo = new THREE.PlaneGeometry(180, 180, 120, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getBaseGroundHeight(vx, vz));
    }
    groundGeo.computeVertexNormals();

    const groundMesh = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({
        map: groundTex,
        color: 0x999287,
        roughness: 0.95,
        metalness: 0.02
      })
    );
    groundMesh.receiveShadow = true;
    terrainGroup.add(groundMesh);
    sensorMeshes.push(groundMesh);

    // Helper para agregar losas de hormigón transitables con soporte de inclinación 3D (Yaw, Pitch, Roll)
    function addWalkableSlab(x, y, z, w, h, d, rotY = 0, pitchX = 0, rollZ = 0, mat = concreteMat) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(pitchX, rotY, rollZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      terrainGroup.add(mesh);
      sensorMeshes.push(mesh);

      slabColliders.push({
        x,
        y,
        z,
        halfW: w * 0.5,
        halfH: h * 0.5,
        halfD: d * 0.5,
        cosY: Math.cos(-rotY),
        sinY: Math.sin(-rotY),
        pitchX,
        rollZ
      });

      return mesh;
    }

    // Helper para decorar losas con hierros retorcidos (rebar) y ladrillos rotos
    function scatterRubbleAround(cx, cz, radius, countBricks = 16, countRebar = 6) {
      const brickGeo = new THREE.BoxGeometry(0.34, 0.16, 0.18);
      for (let i = 0; i < countBricks; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const bx = cx + Math.cos(angle) * r;
        const bz = cz + Math.sin(angle) * r;
        const by = getSurfaceHeightAt(bx, bz) + 0.07;

        const isCinder = i % 3 === 0;
        const bMesh = new THREE.Mesh(
          isCinder ? new THREE.BoxGeometry(0.45, 0.22, 0.24) : brickGeo,
          isCinder ? darkConcreteMat : brickMat
        );
        bMesh.position.set(bx, by, bz);
        bMesh.rotation.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.5
        );
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        terrainGroup.add(bMesh);
        sensorMeshes.push(bMesh);
      }

      // Varillas de hierro retorcidas (Rebar)
      for (let j = 0; j < countRebar; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const rx = cx + Math.cos(angle) * r;
        const rz = cz + Math.sin(angle) * r;
        const ry = getSurfaceHeightAt(rx, rz);

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, -0.6),
          new THREE.Vector3(0.12, 0.22, -0.15),
          new THREE.Vector3(-0.15, 0.12, 0.35),
          new THREE.Vector3(0.08, 0.32, 0.75)
        ]);
        const rebarGeo = new THREE.TubeGeometry(curve, 12, 0.018, 6, false);
        const rebarMesh = new THREE.Mesh(rebarGeo, rebarMat);
        rebarMesh.position.set(rx, ry, rz);
        rebarMesh.rotation.y = Math.random() * Math.PI * 2;
        rebarMesh.castShadow = true;
        terrainGroup.add(rebarMesh);
      }
    }

    // =========================================================================
    // ZONA 1: LOSAS DE HORMIGÓN COLAPSADAS (Escenario Imagen Conceptual - [0, 0])
    // =========================================================================
    // Losa base escalonada bajo el rover en el inicio (permite ver el trabajo del fuelle)
    addWalkableSlab(0, 0.14, -1.2, 4.6, 0.32, 4.2, 0.08, 0.03, -0.04);
    addWalkableSlab(0.2, 0.26, 2.2, 4.4, 0.36, 3.8, -0.06, -0.05, 0.07);

    // Secuencia de placas quebradas hacia adelante (+Z) con pendientes cruzadas (torsión 3D)
    addWalkableSlab(-0.9, 0.32, 6.2, 3.8, 0.42, 4.4, 0.12, 0.08, 0.11);
    addWalkableSlab(1.2, 0.38, 9.8, 3.9, 0.45, 4.5, -0.14, -0.06, -0.12);
    addWalkableSlab(0.0, 0.48, 13.8, 4.8, 0.48, 4.6, 0.04, 0.09, 0.05);
    addWalkableSlab(0.1, 0.25, 17.8, 4.5, 0.38, 4.2, -0.05, -0.09, -0.04);

    // Grandes bloques de mampostería caídos a los costados de la Zona 1 (como en el render conceptual)
    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.2, 7.5), darkConcreteMat);
    wallLeft.position.set(-5.8, 1.8, 4.5);
    wallLeft.rotation.set(0.18, 0.25, -0.32);
    wallLeft.castShadow = true;
    wallLeft.receiveShadow = true;
    terrainGroup.add(wallLeft);
    sensorMeshes.push(wallLeft);

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.6, 6.2), concreteMat);
    wallRight.position.set(6.2, 1.5, 8.0);
    wallRight.rotation.set(-0.14, -0.3, 0.22);
    wallRight.castShadow = true;
    wallRight.receiveShadow = true;
    terrainGroup.add(wallRight);
    sensorMeshes.push(wallRight);

    scatterRubbleAround(0, 6, 11, 42, 18);

    // =========================================================================
    // ZONA 2: ZANJA SÍSMICA Y PUENTE DE LOSAS ([-24, 20])
    // Demuestra por qué un 6x6 / 8x8 articulado supera grietas donde un 4WD cae
    // =========================================================================
    // Rampa de subida
    addWalkableSlab(-24, 0.42, 10, 5.2, 0.4, 5.8, 0, 0.14, 0);
    // Primera meseta antes de la grieta
    addWalkableSlab(-24, 0.82, 15.2, 5.0, 0.5, 4.8, 0, 0, 0);
    // Grieta de 1.05m y segunda meseta
    addWalkableSlab(-24, 0.82, 21.0, 5.0, 0.5, 4.8, 0, 0, 0.04);
    // Segunda grieta oblicua y tercera meseta
    addWalkableSlab(-24, 0.82, 26.8, 5.0, 0.5, 4.8, 0.05, -0.03, -0.05);
    // Rampa de bajada
    addWalkableSlab(-24, 0.42, 32.2, 5.2, 0.4, 5.8, 0, -0.14, 0);

    scatterRubbleAround(-24, 21, 9, 25, 10);

    // =========================================================================
    // ZONA 3: RAMPA DE HORMIGÓN DE GRAN PENDIENTE Y ESCOMBROS ASIMÉTRICOS ([24, 20])
    // Ideal para evaluar Torque + Modo Estabilizado (PID / SAS) vs Modo Manual
    // =========================================================================
    addWalkableSlab(24, 0.65, 11.5, 5.6, 0.4, 7.5, 0, 0.18, 0.03);
    addWalkableSlab(24, 1.65, 18.2, 5.6, 0.5, 6.8, 0, 0.12, -0.05);
    addWalkableSlab(24, 2.15, 24.5, 6.2, 0.5, 6.4, 0, 0.0, 0.0);
    // Obstáculos asimétricos sobre la rampa para desviar el chasis
    addWalkableSlab(22.7, 1.25, 15.0, 1.8, 0.32, 2.1, 0.2, 0.12, 0.08, darkConcreteMat);
    addWalkableSlab(25.2, 1.95, 20.0, 1.9, 0.34, 2.2, -0.15, 0.08, -0.1, darkConcreteMat);
    // Rampa de descenso
    addWalkableSlab(24, 1.15, 31.2, 5.6, 0.45, 7.8, 0, -0.22, 0);

    scatterRubbleAround(24, 22, 10, 28, 12);

    // =========================================================================
    // ZONA 4: ESTRUCTURA COLAPSADA / TÚNEL OSCURO DE RESCATE ([0, 44])
    // Requiere reflectores LED solidarios al Pan-Tilt (Tecla L) y LiDAR/ToF (Tecla T)
    // =========================================================================
    // Piso irregular dentro del edificio colapsado
    addWalkableSlab(0, 0.22, 38, 9.0, 0.35, 10.0, 0, 0.02, -0.02, darkConcreteMat);
    addWalkableSlab(0, 0.28, 48, 9.0, 0.38, 10.5, 0, -0.02, 0.03, darkConcreteMat);
    addWalkableSlab(-1.4, 0.48, 43.5, 2.6, 0.35, 3.2, 0.25, 0.06, 0.09);
    addWalkableSlab(1.6, 0.52, 47.5, 2.5, 0.36, 3.0, -0.2, -0.05, -0.08);

    // Paredes laterales y techo colapsado del túnel (generan sombra profunda real)
    const tunnelLeftWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.6, 22), darkConcreteMat);
    tunnelLeftWall.position.set(-4.8, 2.2, 44);
    tunnelLeftWall.castShadow = true;
    tunnelLeftWall.receiveShadow = true;
    terrainGroup.add(tunnelLeftWall);
    sensorMeshes.push(tunnelLeftWall);

    const tunnelRightWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.6, 22), darkConcreteMat);
    tunnelRightWall.position.set(4.8, 2.2, 44);
    tunnelRightWall.castShadow = true;
    tunnelRightWall.receiveShadow = true;
    terrainGroup.add(tunnelRightWall);
    sensorMeshes.push(tunnelRightWall);

    const tunnelRoof1 = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.9, 12), concreteMat);
    tunnelRoof1.position.set(0, 4.3, 41);
    tunnelRoof1.rotation.z = -0.05;
    tunnelRoof1.castShadow = true;
    tunnelRoof1.receiveShadow = true;
    terrainGroup.add(tunnelRoof1);
    sensorMeshes.push(tunnelRoof1);

    const tunnelRoof2 = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.9, 11), darkConcreteMat);
    tunnelRoof2.position.set(0, 4.0, 50.5);
    tunnelRoof2.rotation.z = 0.07;
    tunnelRoof2.castShadow = true;
    tunnelRoof2.receiveShadow = true;
    terrainGroup.add(tunnelRoof2);
    sensorMeshes.push(tunnelRoof2);

    // Columnas internas para esquivar con teleoperación FPV + sensores HC-SR04 / ToF
    [
      { x: -1.8, z: 40.5 },
      { x: 1.9, z: 45.2 },
      { x: -1.5, z: 50.0 }
    ].forEach((col) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 4.2, 0.95), concreteMat);
      pillar.position.set(col.x, 2.1, col.z);
      pillar.rotation.z = (Math.random() - 0.5) * 0.14;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      terrainGroup.add(pillar);
      sensorMeshes.push(pillar);
    });

    scatterRubbleAround(0, 45, 8, 30, 14);

    // =========================================================================
    // 4 BALIZAS / OBJETIVOS DE BÚSQUEDA Y RESCATE (Misión USAR)
    // =========================================================================
    const beaconSpecs = [
      {
        id: 'B1',
        name: 'Señal Térmica Sobreviviente #1',
        x: 0.4,
        z: 14.2,
        color: 0xff5500
      },
      {
        id: 'B2',
        name: 'Caja Negra Sísmica (Zanja)',
        x: -24.0,
        z: 26.8,
        color: 0x00f0ff
      },
      {
        id: 'B3',
        name: 'Transpondedor Rampa Alta',
        x: 24.0,
        z: 24.5,
        color: 0xfacc15
      },
      {
        id: 'B4',
        name: 'Víctima Atrapada (Túnel Oscuro)',
        x: 0.2,
        z: 51.8,
        color: 0x10b981
      }
    ];

    // Función exacta de altura superficial (considera suelo base + todas las losas 3D inclinadas)
    function getSurfaceHeightAt(x, z) {
      let maxH = getBaseGroundHeight(x, z);

      for (let i = 0; i < slabColliders.length; i++) {
        const s = slabColliders[i];
        const dx = x - s.x;
        const dz = z - s.z;
        // Transformar al marco local horizontal de la losa
        const lx = dx * s.cosY - dz * s.sinY;
        const lz = dx * s.sinY + dz * s.cosY;

        const margin = 0.26; // Rampa suave de borde para que el neumático trepe el escalón progresivamente
        if (Math.abs(lx) <= s.halfW + margin && Math.abs(lz) <= s.halfD + margin) {
          const clampedX = THREE.MathUtils.clamp(lx, -s.halfW, s.halfW);
          const clampedZ = THREE.MathUtils.clamp(lz, -s.halfD, s.halfD);

          // Altura superior de la losa considerando su Pitch y Roll
          const slabTop =
            s.y +
            s.halfH -
            clampedZ * Math.tan(s.pitchX) +
            clampedX * Math.tan(s.rollZ);

          // Factor de chaflán en los bordes
          const overX = Math.max(0, Math.abs(lx) - s.halfW) / margin;
          const overZ = Math.max(0, Math.abs(lz) - s.halfD) / margin;
          const edgeBlend = 1 - Math.max(overX, overZ);

          const blendedH = THREE.MathUtils.lerp(maxH, slabTop, edgeBlend);
          if (blendedH > maxH) {
            maxH = blendedH;
          }
        }
      }

      return maxH;
    }

    const beacons = beaconSpecs.map((b) => {
      const by = getSurfaceHeightAt(b.x, b.z);
      const group = new THREE.Group();
      group.position.set(b.x, by, b.z);

      const podMat = new THREE.MeshStandardMaterial({
        color: b.color,
        emissive: b.color,
        emissiveIntensity: 1.8,
        roughness: 0.2
      });
      const podMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.45, 16), podMat);
      podMesh.position.y = 0.24;
      group.add(podMesh);

      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 28),
        new THREE.MeshBasicMaterial({ color: b.color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.06;
      group.add(ringMesh);

      const beaconLight = new THREE.PointLight(b.color, 1.5, 9);
      beaconLight.position.y = 0.8;
      group.add(beaconLight);

      terrainGroup.add(group);
      sensorMeshes.push(podMesh);

      return {
        ...b,
        y: by + 0.35,
        group,
        podMat,
        ringMesh,
        found: false
      };
    });

    return {
      terrainGroup,
      sensorMeshes,
      beacons,
      getSurfaceHeightAt
    };
  }

  window.TerrainBuilder = {
    createUSARTerrain
  };
})();
