import { redirect } from "next/navigation";
import SporeMark from "@/components/SporeMark";
import { accessPassword, safeNext } from "@/lib/access";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Quantum Blue" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  if (!accessPassword()) redirect(dest);
  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <SporeMark size={34} />
          <span className="logo">Quantum Blue</span>
        </div>
        <p className="lead">Enter the operation password to continue.</p>
        <LoginForm next={dest} />
      </div>
    </main>
  );
}
