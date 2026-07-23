"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, DEFAULT_DEVICE_ID, FORCE_DEMO } from "./supabase/client";

// Espeja el enum command_type del esquema (0001 + 0011 `ota`).
export type CommandType =
  | "fan_mode"
  | "setpoint"
  | "hysteresis"
  | "power_cycle"
  | "reboot"
  | "ota"; // actualización remota de firmware (payload: {url, md5?, version?})

export interface Command {
  id: string;
  ts: string;
  type: CommandType;
  payload: Record<string, unknown>;
  ack_ts: string | null;
}

// Inserta un comando (RLS: solo operator+). Devuelve error legible si falla.
export async function sendCommand(
  sb: SupabaseClient,
  deviceId: string,
  type: CommandType,
  payload: Record<string, unknown>
): Promise<{ error?: string }> {
  const { error } = await sb
    .from("commands")
    .insert({ device_id: deviceId, type, payload });
  return { error: error?.message };
}

// Últimos comandos del device (con estado de ack), en vivo.
export function useCommands(
  deviceId = DEFAULT_DEVICE_ID,
  limit = 15
): { commands: Command[]; supabase: SupabaseClient | null } {
  const supabase = FORCE_DEMO ? null : getSupabase();
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    const load = () =>
      supabase
        .from("commands")
        .select("*")
        .eq("device_id", deviceId)
        .order("ts", { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          if (alive && data) setCommands(data as Command[]);
        });

    load();

    const channel = supabase
      .channel(`commands:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commands", filter: `device_id=eq.${deviceId}` },
        () => load()
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, deviceId, limit]);

  return { commands, supabase };
}
