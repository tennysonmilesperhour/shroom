import { NextResponse, type NextRequest } from "next/server";

// Open access: no auth gate. Pass every request through.
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
