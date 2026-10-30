# 🚨 Simulador 3D USAR Rover "SAR RESCUE" • Edición Logitech Extreme 3D Pro HOTAS

![Concept Art USAR Rover](assets/concept-rover.jpg)

**Universidad Abierta Interamericana (UAI) • Robótica y Tecnologías Emergentes • Grupo 4 (Octubre 2026)**  
**Integrantes:** Arik Yelin • Santino Loray • Dusan Kegler • Ignacio De Giacomo  
**Carrera:** Ingeniería en Sistemas Informáticos  
**Hardware Soportado Nativamente:** Joystick **Logitech Extreme 3D Pro** (`USB VID: 046d / PID: c215`) + Teclado/Mouse en paralelo.

---

## 📋 Descripción del Proyecto

Este simulador interactivo 3D (**Gemelo Digital**) modela la evolución de la plataforma educativa base de la cátedra hacia un **Rover Especializado en Búsqueda y Rescate Urbano (USAR - Urban Search and Rescue)** para zonas de derrumbe y estructuras colapsadas, controlado directamente mediante un joystick **Logitech Extreme 3D Pro** utilizando la **Web Gamepad API** (con filtrado de zona muerta, curva exponencial y auto-detección de ejes DirectInput/HID).

### Características de Ingeniería Implementadas
1. **Integración Nativa con Joystick Logitech Extreme 3D Pro (`hotasController.js`)**:
   - **4 Ejes Analógicos con Zona Muerta + Curva Exponencial**:
     - **Stick Eje Y (Pitch)**: Avance y reversa proporcional de alta precisión.
     - **Stick Eje X (Roll)**: Quiebre del fuelle central articulado + asistencia por tracción diferencial.
     - **Eje Z Twist (Rotación de Puño / Rudder)**: Paneo horizontal rápido de la torreta Pan-Tilt y/o asistencia de dirección.
     - **Palanca Throttle en la Base (`Slider +/-`)**: Regulador físico del techo de potencia PWM (`22%` a `100%`) en modo directo, o acelerador continuo en **Modo Crucero HOTAS**.
   - **Mini-Stick Superior POV Hat de 8 Direcciones**: Control directo de la **Torreta Pan-Tilt 2-DoF** (*Yaw* y *Pitch* desacoplados del chasis).
   - **12 Botones Programados (`Botones 1 al 6` en empuñadura + `Botones 7 al 12` en la base ponderada)**: Control total del rover sin tocar el teclado.
   - **Centro de Calibración y Auto-Detección en Vivo (Tecla `J`)**: Permite inspeccionar la señal cruda de todos los ejes del navegador, invertir polaridades, ajustar zona muerta/curva exponencial y auto-detectar ejes con un clic.
2. **Chasis Bi-Modular Articulado con Fuelle Central ("Inspiración Colectivo Articulado")**:
   - **Módulo Delantero**: Instrumentación sensible, sensores frontales duales (**HC-SR04 + Óptico ToF VL53L0X / Micro-LiDAR**), reflectores LED de alta potencia, malacate (*winch*) y grilletes de rescate.
   - **Fuelle Central de 9 Segmentos**: Permite que el módulo delantero y el trasero oscilen de forma independiente en **cabeceo (*Pitch*)** y **balanceo/torsión (*Roll*)** copiando el terreno tridimensional, además de quebrar su cuerpo central en **dirección articulada (*Yaw*)**.
   - **Módulo Trasero**: Alojamiento de baterías pesadas LiPo/Li-Ion en valija estanca tipo Pelican, electrónica de potencia y 3 antenas con física dinámica para enlaces en **5.8 GHz Analógico**, **Sub-GHz** y **2.4 GHz UDP**.
3. **Comparativa de Tracción en Tiempo Real (`8x8 Concept` vs. `6x6 USAR` vs. `4WD Cátedra`)**:
   - Permite alternar en vivo (con el **Botón 7** de la base del joystick) entre las **8 ruedas sobredimensionadas**, la configuración **6x6 independiente**, y el **prototipo base 4WD de cátedra**.

---

## 🕹️ Mapa Oficial de Controles: Logitech Extreme 3D Pro

| Control Físico (Logitech Extreme 3D Pro) | Equivalente Teclado | Acción en el Rover USAR |
| :--- | :--- | :--- |
| **Stick Eje Y** *(Empujar / Tirar)* | **`W`** / **`S`** | **Aceleración / Reversa** proporcional con curva exponencial |
| **Palanca Throttle Base (`+` / `-`)** | **`R`** / **`F`** | **Límite de Potencia PWM** (`22%–100%`) o **Gases Continuos (Modo Crucero)** |
| **Stick Eje X** *(Izquierda / Derecha)* | **`A`** / **`D`** | **Dirección Articulada** del fuelle central + tracción diferencial |
| **Eje Z Twist** *(Rotación de Puño)* | **`Q`** / **`E`** | **Paneo Horizontal de Torreta** + asistencia de giro (configurable en `J`) |
| **POV Hat 8-Vías** *(Mini-Stick Cabezal)* | **`Flechas ↑ ↓ ← →`** | **Torreta Pan-Tilt 2-DoF** (*Yaw* y *Pitch* desacoplados del chasis) |
| **Botón 1 (Gatillo / Trigger)** | **`Espacio`** | **Freno de Emergencia** y corte instantáneo a `0% PWM` |
| **Botón 2 (Pulgar Lateral)** | **`X`** o **`C`** | **Centrar Torreta Pan-Tilt** (`0°, 0°`) / Invertir marcha en modo Crucero |
| **Botón 3 (Cabezal Sup. Izquierdo)** | **`V`** | Alternar vista **1ra Persona (FPV VR)** ↔ **3ra Persona (Exterior)** |
| **Botón 4 (Cabezal Sup. Derecho)** | **`G`** | Alternar **Modo Estabilizado (PID / SAS)** ↔ **Modo Manual Directo** |
| **Botón 5 (Cabezal Inf. Izquierdo)** | **`L`** | Ciclar potencia de **Reflectores LED** (`OFF` → `NORMAL` → `MAX USAR`) |
| **Botón 6 (Cabezal Inf. Derecho)** | **`T`** | Activar / Desactivar escáner láser 3D **ToF / Micro-LiDAR** |
| **Botón 7 (Base Fila 1 Izq.)** | Click HUD | Alternar tracción en vivo: **`8x8 Concept` → `6x6 USAR` → `4WD Cátedra`** |
| **Botón 8 (Base Fila 1 Der.)** | **`M`** | Alternar articulación del fuelle: **Activa (Servo)** ↔ **Pasiva (3D)** |
| **Botón 9 (Base Fila 2 Izq.)** | **`N`** | Alternar iluminación: **Luz Diurna** ↔ **Derrumbe Oscuro / Nocturno** |
| **Botón 10 (Base Fila 2 Der.)** | **`P`** | Mostrar / Ocultar ventana secundaria **Picture-in-Picture (PiP)** |
| **Botón 11 (Base Fila 3 Izq.)** | **`1`** **`2`** **`3`** **`4`** | **Teletransportar** secuencialmente entre las 4 zonas de ensayo |
| **Botón 12 (Base Fila 3 Der.)** | **`0`** / **`Backspace`** | Alternar **Modo Throttle (`Stick Y` ↔ `Crucero HOTAS`)** y nivelar chasis |
| — | **`K`** | **Activar / Desactivar Streaming VR por Wi-Fi hacia el Celular** (Apagado por defecto) |
| — | **`J`** | Abrir el **Centro de Calibración y Diagnóstico Logitech Extreme 3D Pro** |
| — | **`H`** | Abrir el **Manual de Ingeniería y Controles** |

---

## 🥽 Cómo Usar el Streaming por Wi-Fi en el Casco VR con Celular

1. Ejecutá **[`INICIAR_SIMULADOR.bat`](file:///C:/Users/Navegador/Desktop/Nueva%20carpeta/usar-rover-simulator/INICIAR_SIMULADOR.bat)** en la PC (inicia automáticamente el servidor local [`wifi_vr_server.py`](file:///C:/Users/Navegador/Desktop/Nueva%20carpeta/usar-rover-simulator/wifi_vr_server.py) en el puerto `8090` y abre el simulador).
2. Por defecto, **la transmisión Wi-Fi está DESACTIVADA (`🥽 VR WIFI: OFF`)** para no consumir recursos ni red mientras no se usa.
3. Cuando quieras transmitir al casco VR, hacé clic en el botón superior **`🥽 VR WIFI: OFF`** (o presioná la tecla **`K`**):
   - Se abrirá el panel con la dirección IP local de tu PC (por ejemplo, `http://10.110.16.176:8090/vr` o `http://192.168.43.1:8090/vr`).
4. En el celular (conectado a la misma red Wi-Fi o al Hotspot de la PC), abrí esa dirección en Chrome o Safari:
   - Se cargará el visor **[`vr.html`](file:///C:/Users/Navegador/Desktop/Nueva%20carpeta/usar-rover-simulator/vr.html)** en **Modo Casco VR Estereoscópico (2 Ojos Side-by-Side)** con ajuste de distancia interpupilar (`IPD + / -`), pantalla completa y opción para mover la torreta Pan-Tilt con el **giroscopio del teléfono**.

---

## 🚀 Cómo Ejecutarlo

1. Conectá el joystick **Logitech Extreme 3D Pro** a un puerto USB de tu PC.
2. Hacé **doble clic sobre `INICIAR_SIMULADOR.bat`** o directamente sobre **`index.html`**.
3. Una vez abierta la ventana del navegador, **presioná el Gatillo (Botón 1) o mové el stick** para que el navegador habilite el dispositivo USB: el indicador superior cambiará a verde (**`🕹️ LOGITECH 3D PRO: ACTIVO`**).
4. Si querés personalizar la sensibilidad, invertir algún eje o verificar los 12 botones en vivo, presioná la tecla **`J`** o hacé clic en el botón **`🕹️ LOGITECH 3D PRO`** arriba a la derecha.
