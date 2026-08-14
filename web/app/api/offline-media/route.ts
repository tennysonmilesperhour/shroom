import { uploadBatchMedia } from "@/app/(app)/batches/[id]/media-actions";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) {
      return Response.json({ ok: false, message: "Cross-origin upload is not allowed." }, { status: 403 });
    }
  } catch {
    return Response.json({ ok: false, message: "Invalid upload origin." }, { status: 403 });
  }
  try {
    const result = await uploadBatchMedia(await request.formData());
    return Response.json(result, { status: result.ok ? 200 : 422 });
  } catch {
    return Response.json({ ok: false, message: "Could not sync queued photo." }, { status: 500 });
  }
}
