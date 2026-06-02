import { NextResponse, type NextRequest } from "next/server";

// Auth gate is benched (in-house only). This is a pass-through for now.
// To re-enable auth: recreate the Supabase server client here, call
// supabase.auth.getUser(), and redirect unauthenticated requests to /login.
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
