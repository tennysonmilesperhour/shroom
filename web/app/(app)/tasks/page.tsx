import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card, Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { must } from "@/lib/query";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: number;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  batches: { id: number; lot_code: string } | null;
  rooms: { name: string } | null;
  staff: { name: string } | null;
}

const priorityTone = (p: string): BadgeTone =>
  p === "high" ? "red" : p === "low" ? "muted" : "amber";

const statusTone = (s: string): BadgeTone =>
  s === "done" ? "green" : s === "in_progress" ? "blue" : "muted";

export default async function TasksPage() {
  const supabase = createServiceClient();
  const tasks = await must<TaskRow[]>(
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date, batches(id,lot_code), rooms(name), staff(name)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<TaskRow[]>(),
    "load tasks",
  );

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: TaskRow) => t.status !== "done" && !!t.due_date && t.due_date < today;

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdueCount = open.filter(isOverdue).length;

  return (
    <>
      <div>
        <div className="eyebrow">Operation</div>
        <h1 className="section">Tasks</h1>
      </div>

      <div className="kpi-row">
        <Kpi label="Open tasks" countTo={open.length} feature />
        <Kpi label="Overdue" countTo={overdueCount} />
        <Kpi label="Completed" countTo={done.length} />
      </div>

      <Card title="Open tasks">
        {open.length === 0 ? (
          <div className="muted">Nothing open. Every task is done ✓</div>
        ) : (
          <table>
            <caption className="sr-only">Open tasks</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Batch</th>
                <th scope="col">Due</th>
                <th scope="col">Priority</th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div>{t.title}</div>
                    {(t.rooms?.name || t.staff?.name) && (
                      <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>
                        {[t.rooms?.name, t.staff?.name].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {t.batches ? (
                      <Link href={`/batches/${t.batches.id}`} className="row-anchor">
                        {t.batches.lot_code}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {t.due_date ? (
                      isOverdue(t) ? (
                        <Badge tone="red">{t.due_date} · overdue</Badge>
                      ) : (
                        <span className="num">{t.due_date}</span>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="Completed">
          <table>
            <caption className="sr-only">Completed tasks</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Batch</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {done.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.title}</td>
                  <td>
                    {t.batches ? (
                      <Link href={`/batches/${t.batches.id}`} className="row-anchor">
                        {t.batches.lot_code}
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
