#pragma once
#include <Arduino.h>

// OTA (Fase 4 / R2): actualización de firmware por HTTPS, disparada por un comando
// `ota` desde el dashboard. El device descarga el .bin, lo escribe en la partición
// OTA inactiva, lo valida (MD5 opcional) y reinicia en la imagen nueva.
//
// SEGURIDAD: si la descarga se interrumpe o el MD5 no cuadra, NO cambia la
// partición de arranque → la unidad sigue viva en la imagen VIEJA (fail-safe).
// ⚠️ El rollback automático ante un crash de la imagen nueva (bootloader) NO está
// habilitado en esta v1 → validar cada build en una unidad física antes de
// publicarla a la flota. Ver docs/plan-ota.md.
//
// BLOQUEA (descarga ~1 MB + flasheo, decenas de s). Se llama desde la tarea de red.
// Devuelve false si falló (imagen vieja intacta). Si tiene éxito NO retorna: reinicia.
bool otaApplyFromUrl(const char* url, const char* expectedMd5 /* "" si no se valida */);
