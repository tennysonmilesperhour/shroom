"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessPassword, accessToken, safeEqual, safeNext } from "@/lib/access";

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = accessPassword();
  const next = safeNext(String(formData.get("next") ?? "/"));
  if (!password) redirect(next);

  const attempt = String(formData.get("password") ?? "");
  const [expected, given] = await Promise.all([accessToken(password), accessToken(attempt)]);
  if (!safeEqual(expected, given)) {
    // Slow down guessing without a stateful rate limiter.
    await new Promise((r) => setTimeout(r, 600));
    return "That password isn’t right.";
  }

  (await cookies()).set(ACCESS_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect(next);
}

