import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="top">
        <div className="logo">
          Shroom<span>OS</span>
        </div>
        <div className="sub">Quantum Blue Mycology</div>
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
