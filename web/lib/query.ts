// Tiny ergonomic wrapper for Supabase server-side reads.
//
// Usage:
//   const batches = await must(
//     supabase.from("batches").select("*"),
//     "load batches"
//   );
//
// If the query fails, throws — caught by app/(app)/error.tsx. If the data is
// null (shouldn't happen on success but PostgREST can return it), returns
// an empty array of the inferred type.

interface SupabaseLike<T> {
  data: T | null;
  error: { message: string } | null;
}

export async function must<T>(
  query: PromiseLike<SupabaseLike<T>>,
  label: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to ${label}: ${error.message}`);
  }
  // Most table reads return [] when empty, not null — but views and .single()
  // calls can return null. Callers that want non-null can narrow at the call site.
  return (data ?? ([] as unknown as T));
}

// For .single() calls that genuinely allow null (e.g., "no row found").
export async function maybe<T>(
  query: PromiseLike<SupabaseLike<T>>,
  label: string,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    // PGRST116 = "no rows" from .single() — that's a legitimate null, not an error.
    if (error.message.includes("0 rows") || error.message.includes("PGRST116")) {
      return null;
    }
    throw new Error(`Failed to ${label}: ${error.message}`);
  }
  return data;
}
