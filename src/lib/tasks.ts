import { isTaskVisibleForPeriod } from "./date";
import type { PeriodType, Profile, Task } from "../types/database";

export const groupTasksByOwner = (
  tasks: Task[],
  members: Profile[],
  selectedPeriod: PeriodType,
  anchorDate: string,
) =>
  members.map((member) => ({
    profile: member,
    tasks: tasks
      .filter(
        (task) =>
          task.owner_profile_id === member.id &&
          task.period_type === selectedPeriod &&
          isTaskVisibleForPeriod(
            task.period_anchor_date,
            task.completed,
            task.completed_at,
            anchorDate,
            selectedPeriod,
          ),
      )
      .sort((left, right) => {
        if (left.completed !== right.completed) {
          return Number(left.completed) - Number(right.completed);
        }

        return left.created_at.localeCompare(right.created_at);
      }),
  }));
