import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Nav from "@/components/Nav";
import SporeMark from "@/components/SporeMark";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="top">
        <div className="brand">
          <SporeMark />
          <span className="logo">Quantum Blue</span>
        </div>
        <div className="sub">Mycology OS</div>
        <div className="spacer" />
        <div className="who">{user.email}</div>
        <form action="/auth/signout" method="post">
          <button className="link" type="submit">
            sign out
          </button>
        </form>
      </header>
      <Nav />
      <main>{children}</main>
    </>
  );
}
