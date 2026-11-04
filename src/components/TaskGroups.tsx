"use client";

import { useActionState } from "react";
import type { ListView } from "@/db/schema";
import { deleteGroupAction, saveGroupAction } from "@/lib/actions/tasks";
import type { GroupIcon } from "@/lib/group-icons";
import { AppIcon } from "./AppIcon";
import { CollectionDialog, type Trigger } from "./CollectionDialog";

type Editable = { id: string; name: string; color: string; icon: GroupIcon; view: ListView };

const STARTERS: Omit<Editable, "id">[] = [
  { name: "Personal", color: "#7262ea", icon: "star", view: "list" },
  { name: "Business", color: "#2a78d6", icon: "briefcase", view: "board" },
  { name: "Education", color: "#1baf7a", icon: "graduation", view: "list" },
  { name: "Family", color: "#eb6834", icon: "family", view: "list" },
];

// Create (no `group`) or edit a task group.
export function GroupDialog(p: { group?: Editable; trigger: Trigger }) {
  return <CollectionDialog {...p} item={p.group} noun="group" save={saveGroupAction} remove={deleteGroupAction} withView />;
}

// Shown when there are no groups yet: one tap creates a common group.
export function TaskStart() {
  const [state, action, pending] = useActionState(saveGroupAction, {});
  return (
    <div className="card space-y-4 text-center">
      <div className="flex justify-center"><AppIcon name="tasks" size={56} /></div>
      <div>
        <p className="font-medium">Group your tasks</p>
        <p className="text-sm text-ink-3">A group holds tasks — e.g. Business, Education, Family. Start with one:</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((g) => (
          <form key={g.name} action={action}>
            {Object.entries(g).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <button disabled={pending} className="btn btn-ghost pl-1.5">
              <AppIcon name={g.icon} size={26} color={g.color} /> {g.name}
            </button>
          </form>
        ))}
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
