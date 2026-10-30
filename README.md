# 🚨 Simulador 3D USAR Rover "SAR RESCUE" • Teleoperación FPV & HOTAS

![Concept Art USAR Rover](assets/concept-rover.jpg)

**Universidad Abierta Interamericana (UAI) • Robótica y Tecnologías Emergentes • Grupo 4 (Octubre 2026)**  
**Integrantes:** Arik Yelin • Santino Loray • Dusan Kegler • Ignacio De Giacomo  
**Carrera:** Ingeniería en Sistemas Informáticos

---

## 📋 Descripción del Proyecto

Este simulador interactivo 3D (**Gemelo Digital**) modela la evolución de la plataforma educativa base de la cátedra hacia un **Rover Especializado en Búsqueda y Rescate Urbano (USAR - Urban Search and Rescue)** para zonas de derrumbe y estructuras colapsadas.

### Características de Ingeniería Implementadas
1. **Chasis Bi-Modular Articulado con Fuelle Central ("Inspiración Colectivo Articulado")**:
   - **Módulo Delantero**: Instrumentación sensible, sensores frontales duales (**HC-SR04 + Óptico ToF VL53L0X / Micro-LiDAR**), reflectores LED de alta potencia, malacate (*winch*), grilletes de rescate y cable de acero perimetral.
   - **Fuelle Central de 9 Segmentos**: Permite que el módulo delantero y el trasero oscilen de forma independiente en **cabeceo (*Pitch*)** y **balanceo/torsión (*Roll*)** copiando el terreno tridimensional, además de quebrar su cuerpo central en **dirección articulada (*Yaw*)** para doblar sin depender únicamente del derrape (*skid-steering*).
   - **Módulo Trasero**: Alojamiento de baterías pesadas LiPo/Li-Ion en valija estanca tipo Pelican, electrónica de potencia y 3 antenas con física dinámica para enlaces en **5.8 GHz Analógico**, **Sub-GHz** y **2.4 GHz UDP**.
2. **Comparativa de Tracción en Tiempo Real (`8x8 Concept` vs. `6x6 USAR` vs. `4WD Cátedra`)**:
   - Permite alternar en vivo entre las **8 ruedas sobredimensionadas** del arte conceptual, la configuración recomendada **6x6 independiente**, y el **prototipo base 4WD de cátedra** (ruedas amarillas TT chicas y chasis rígido) para comprobar empíricamente la regla del 50% de radio de rueda y el riesgo de **empanzamiento (*belly clearance*)**.
3. **Visión Activa Desacoplada (Torreta Pan-Tilt 2-DoF) + HUD de Realidad Aumentada**:
   - Alternancia instantánea entre **1ra Persona Inmersiva (Visor VR FPV)** y **3ra Persona Orbital**, con monitor secundario **Picture-in-Picture (PiP)** en esquina.
   - **Iluminación LED solidaria al Pan-Tilt**: Los proyectores de la torreta iluminan exactamente hacia donde mira el operador en entornos de derrumbe oscuro.
4. **Modos de Control Manual Directo vs. Estabilizado (PID / SAS con IMU MPU6050)**:
   - Simulación del lazo cerrado inercial que corrige automáticamente las perturbaciones laterales de los escombros y estabiliza el horizonte visual para prevenir la **Ciber-cinetosis (*Cybersickness*)** manteniendo la latencia *Glass-to-Glass* por debajo de los **50 ms**.

---

## 🚀 Cómo Ejecutarlo en Cualquier Computadora

El proyecto es **100% autónomo y multiplataforma** (no requiere instalar motores pesados ni compilar código):

- **Opción 1 (Directa - Sin instalaciones):**  
  Descargá o cloná el repositorio y hacé **doble clic sobre `index.html`** (o sobre `INICIAR_SIMULADOR.bat` en Windows). Se abrirá directamente en cualquier navegador moderno (Chrome, Edge, Firefox, Brave, Safari).
- **Opción 2 (Con Servidor Local opcional en Node.js):**  
  ```bash
  node server.js
  ```
  Y abrí `http://localhost:8090` en tu navegador.

---

## 🎮 Controles de Teclado (Mapeo Virtual HOTAS + Visor VR)

| Tecla / Entrada | Acción en el Rover USAR |
| :--- | :--- |
| **`W`** / **`S`** | **Aceleración / Reversa** proporcional con rampa exponencial |
| **`R`** / **`F`** *(o `Shift` / `Ctrl`)* | **Palanca de Gases HOTAS Fija**: incrementa o reduce el *throttle* mantenido (`-100%` a `+100%`) |
| **`A`** / **`D`** | **Stick de Dirección**: quiebre del fuelle articulado central + tracción diferencial |
| **`Espacio`** | **Freno de Emergencia** y corte de potencia a `0% PWM` |
| **`Flechas ↑ ↓ ← →`** *(o arrastrar Mouse)* | **Torreta Pan-Tilt 2-DoF** (*Yaw* y *Pitch* desacoplados del chasis, simulando el visor VR) |
| **`X`** o **`C`** | **Centrar Torreta Pan-Tilt** al frente del chasis (`0°, 0°`) |
| **`V`** | Alternar vista **1ra Persona (FPV VR)** ↔ **3ra Persona (Exterior)** |
| **`P`** | Mostrar / Ocultar ventana secundaria **Picture-in-Picture (PiP)** |
| **`G`** | Alternar **Modo Estabilizado (PID / SAS)** vs. **Modo Manual Directo** |
| **`L`** | Ciclar potencia de **Reflectores LED** (Apagados → Normal → Máxima Potencia USAR) |
| **`N`** | Alternar entre **Luz Diurna** y **Derrumbe Oscuro / Nocturno** |
| **`T`** | Activar escáner láser 3D **Time-of-Flight (ToF) / Micro-LiDAR** |
| **`M`** | Alternar articulación del fuelle entre **Activa (Servo)** y **Pasiva (Amortiguada 3D)** |
| **`1`** **`2`** **`3`** **`4`** | Teletransportar a las 4 zonas de ensayo (`1`: Losas, `2`: Zanja, `3`: Rampa, `4`: Túnel Oscuro) |
| **`H`** | Abrir el **Manual de Ingeniería y Controles** dentro del simulador |
