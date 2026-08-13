"use client";

import EntityForm from "@/components/EntityForm";
import { ChoiceField, RecentSelect } from "@/components/TapFields";
import { addTask } from "@/app/(app)/tasks/actions";
import { STAGE_LABEL, STAGE_ORDER } from "@/lib/stages";
import type { Option } from "@/lib/entities";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
];

const COMPLETION_ACTIONS = [
  { value: "none", label: "Just complete" },
  { value: "advance_stage", label: "Advance batch" },
  { value: "set_stage", label: "Set batch stage" },
  { value: "move_room", label: "Move batch room" },
];

export default function AddTaskForm({
  batches,
  rooms,
}: {
  batches: Option[];
  rooms: Option[];
}) {
  const stages = STAGE_ORDER.map((stage) => ({ value: stage, label: STAGE_LABEL[stage] }));
  return (
    <EntityForm action={addTask} submitLabel="Add task">
      <div className="full">
        <label htmlFor="task-title">Task</label>
        <input id="task-title" name="title" required placeholder="Mist fruiting room, check pins, move batch…" />
      </div>
      <div className="full">
        <label htmlFor="task-description">Notes</label>
        <textarea id="task-description" name="description" rows={2} />
      </div>
      <div>
        <label htmlFor="task-batch">Linked batch</label>
        <RecentSelect id="task-batch" name="batch_id" storageKey="task-batch" options={batches} emptyLabel="No batch" />
      </div>
      <div>
        <label htmlFor="task-room">Work room</label>
        <RecentSelect id="task-room" name="room_id" storageKey="task-room" options={rooms} emptyLabel="No room" />
      </div>
      <div>
        <label htmlFor="task-due">Due date</label>
        <input id="task-due" name="due_date" type="date" />
      </div>
      <div>
        <label>Priority</label>
        <ChoiceField name="priority" options={PRIORITIES} defaultValue="med" required ariaLabel="Task priority" />
      </div>
      <div className="full">
        <label>When the task is completed</label>
        <ChoiceField name="completion_action" options={COMPLETION_ACTIONS} defaultValue="none" required ariaLabel="Task completion action" />
      </div>
      <div className="full">
        <label>Stage target</label>
        <ChoiceField name="completion_stage" options={stages} defaultValue="fruiting" required ariaLabel="Completion stage target" />
      </div>
      <div className="full">
        <label htmlFor="task-completion-room">Room target</label>
        <RecentSelect id="task-completion-room" name="completion_room_id" storageKey="task-completion-room" options={rooms} emptyLabel="Choose room when using Move batch room" />
        <p className="muted form-help">Stage and room targets are only used by the matching completion action.</p>
      </div>
    </EntityForm>
  );
}
