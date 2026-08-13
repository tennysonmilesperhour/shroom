import Link from "next/link";
import { createServiceClient } from "@/utils/supabase/service";
import { Kpi, Card, Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { must } from "@/lib/query";
import RowActions from "@/components/RowActions";
import CompleteTaskButton from "@/components/CompleteTaskButton";
import AddPanel from "@/components/AddPanel";
import AddTaskForm from "./AddTaskForm";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  batch_id: number | null;
  room_id: number | null;
  assigned_to: number | null;
  completion_action: string;
  completion_stage: string | null;
  completion_room_id: number | null;
  batches: { id: number; lot_code: string } | null;
  rooms: { name: string } | null;
  staff: { name: string } | null;
}

interface BatchOptionRow {
  id: number;
  lot_code: string;
}

interface RoomOptionRow {
  id: number;
  name: string;
}

interface StaffOptionRow {
  id: number;
  name: string;
}

const priorityTone = (p: string): BadgeTone =>
  p === "high" ? "red" : p === "low" ? "muted" : "amber";

const statusTone = (s: string): BadgeTone =>
  s === "done" ? "green" : s === "in_progress" ? "blue" : "muted";

export default async function TasksPage() {
  const supabase = createServiceClient();
  const [tasks, batchOpts, roomOpts, staffOpts] = await Promise.all([
    must<TaskRow[]>(
      supabase
        .from("tasks")
        .select(
          "id,title,description,status,priority,due_date,batch_id,room_id,assigned_to,completion_action,completion_stage,completion_room_id, batches(id,lot_code), rooms!tasks_room_id_fkey(name), staff(name)",
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .returns<TaskRow[]>(),
      "load tasks",
    ),
    must<BatchOptionRow[]>(
      supabase.from("batches").select("id,lot_code").order("lot_code"),
      "load batch options",
    ),
    must<RoomOptionRow[]>(
      supabase.from("rooms").select("id,name").order("name"),
      "load room options",
    ),
    must<StaffOptionRow[]>(
      supabase.from("staff").select("id,name").order("name"),
      "load staff options",
    ),
  ]);

  const taskOptions = {
    batch_id: batchOpts.map((b) => ({ value: String(b.id), label: b.lot_code })),
    room_id: roomOpts.map((r) => ({ value: String(r.id), label: r.name })),
    assigned_to: staffOpts.map((s) => ({ value: String(s.id), label: s.name })),
    completion_room_id: roomOpts.map((r) => ({ value: String(r.id), label: r.name })),
  };

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: TaskRow) => t.status !== "done" && !!t.due_date && t.due_date < today;

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdueCount = open.filter(isOverdue).length;
  const completionLabel = (task: TaskRow) => {
    if (task.completion_action === "advance_stage") return "Completing advances the batch";
    if (task.completion_action === "set_stage") {
      return `Completing sets batch to ${(task.completion_stage ?? "target stage").replace(/_/g, " ")}`;
    }
    if (task.completion_action === "move_room") {
      const target = roomOpts.find((room) => room.id === task.completion_room_id)?.name ?? "target room";
      return `Completing moves batch to ${target}`;
    }
    return null;
  };

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

      <AddPanel label="Add task or automation" buttonLabel="Add task">
        <AddTaskForm
          batches={batchOpts.map((batch) => ({ value: String(batch.id), label: batch.lot_code }))}
          rooms={roomOpts.map((room) => ({ value: String(room.id), label: room.name }))}
        />
      </AddPanel>

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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="task-title-row">
                      <CompleteTaskButton taskId={t.id} title={t.title} />
                      <div>{t.title}</div>
                    </div>
                    {(t.rooms?.name || t.staff?.name) && (
                      <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>
                        {[t.rooms?.name, t.staff?.name].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {completionLabel(t) && (
                      <div className="task-automation-note">↳ {completionLabel(t)}</div>
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
                  <td className="actions-col">
                    <RowActions
                      entity="task"
                      id={t.id}
                      label={t.title}
                      initial={{
                        title: t.title,
                        description: t.description,
                        batch_id: t.batch_id,
                        room_id: t.room_id,
                        assigned_to: t.assigned_to,
                        due_date: t.due_date,
                        status: t.status,
                        priority: t.priority,
                        completion_action: t.completion_action,
                        completion_stage: t.completion_stage,
                        completion_room_id: t.completion_room_id,
                      }}
                      options={taskOptions}
                    />
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
                <th scope="col" className="actions-col"><span className="sr-only">Actions</span></th>
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
                  <td className="actions-col">
                    <RowActions
                      entity="task"
                      id={t.id}
                      label={t.title}
                      initial={{
                        title: t.title,
                        description: t.description,
                        batch_id: t.batch_id,
                        room_id: t.room_id,
                        assigned_to: t.assigned_to,
                        due_date: t.due_date,
                        status: t.status,
                        priority: t.priority,
                        completion_action: t.completion_action,
                        completion_stage: t.completion_stage,
                        completion_room_id: t.completion_room_id,
                      }}
                      options={taskOptions}
                    />
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
