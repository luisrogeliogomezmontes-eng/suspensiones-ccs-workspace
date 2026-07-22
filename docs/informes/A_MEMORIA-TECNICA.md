# Memoria Técnica — Proyecto 1: Telemetría y Gestión Térmica/Energética (ESP32)

> **Documento A de 3.** Entregable formal (jefatura / cliente interno). Describe QUÉ se
> construyó, su fundamento y sus resultados. Para el CÓMO se llegó ahí ver
> [B_INFORME-PROCESO.md](B_INFORME-PROCESO.md); para operarlo ver [C_MANUAL-OPERACION.md](C_MANUAL-OPERACION.md).
>
> _Estado: borrador · Autor: Luis Rogelio Gómez · Última actualización: 2026-07-11_

---

## 1. Resumen ejecutivo
_(½ página, se escribe al final)_ Qué es el sistema, qué problema resuelve, resultado principal en una frase con números.

## 2. Contexto y objetivo
- **Problema**: proteger térmicamente y gestionar la energía de una unidad móvil (maleta de moto con Starlink + EcoFlow) durante operación.
- **Objetivos medibles**:
  1. Medir temperatura en tiempo real.
  2. Controlar ventilación (enfriamiento) automáticamente.
  3. Geolocalizar y correlacionar con datos térmicos.
  4. Regular la corriente de carga del EcoFlow para no drenar la batería de la moto.
  5. Visualizar todo (local y remoto).
- **Alcance / fuera de alcance**.

## 3. Arquitectura general del sistema
- Diagrama de bloques (MCU · sensores · actuadores · energía · telemetría · nube).
- Tabla de subsistemas y su función.

## 4. Fundamento físico-electrónico
_El "por qué funciona" de cada subsistema._
### 4.1 Medición de temperatura
- Principio del sensor (DHT22 / termopar), rango, precisión.
### 4.2 Control de ventilación por histéresis
- Por qué histéresis (evitar chattering del relé), banda ON/OFF, estado fail-safe.
### 4.3 Geolocalización GPS
- NMEA, UART, fix/HDOP/satélites.
### 4.4 Regulación de carga del EcoFlow (LVD con histéresis)
- Principio: la caída de voltaje del bus como proxy de "el alternador no da abasto".
- Relé como interruptor, umbrales 13.0/13.6V, fail-safe (NO = no cargar).
- **Estudio de eficiencia**: gráficas amperaje limitado vs RPM vs consumo (ver §6).

## 5. Diseño detallado (hardware)
- Pinout (tabla, refleja `firmware/config.h`).
- Esquemático (referencia al del manual C).
- Presupuesto de potencia y protecciones (fusible, flyback, divisor+clamp del ADC).
- BOM resumida (ver [docs/PRESUPUESTO.csv](../PRESUPUESTO.csv)).

## 6. Resultados y mediciones
- **Estudio de eficiencia de carga**: tabla y gráficas (RPM · amperaje limitado · consumo · autonomía).
- Desempeño térmico (temp vs tiempo con fan on/off).
- Métricas de telemetría (frecuencia, pérdida de datos, latencia).

## 7. Conclusiones
- Qué se validó, qué umbrales quedaron, límites encontrados.

## 8. Trabajo futuro
- MQTT, PCB, PID del fan, integración Starlink/EcoFlow, multi-dispositivo.

## Anexos
- A1: Pinout completo · A2: Esquemáticos · A3: Datos crudos del estudio de eficiencia.
