"use server";

import { createServiceClient } from "@/utils/supabase/service";

export interface TraceShipment {
  order_number: string;
  customer: string;
  channel: string;
  product: string;
  quantity: number;
  fulfillment_date: string | null;
}

export interface TraceResult {
  ok: boolean;
  message?: string;
  data?: {
    strain: string | null;
    harvests: number;
    affected_orders: TraceShipment[];
  };
}

export async function traceLot(lot: string): Promise<TraceResult> {
  const code = lot.trim();
  if (!code) return { ok: false, message: "Pick a lot." };

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("recall_trace", { p_lot: code });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data };
}
