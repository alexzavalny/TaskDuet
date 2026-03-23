import { useEffect, useState } from "react";
import { envError } from "./lib/env";
import { supabase } from "./lib/supabase";
import {
  formatDateInput,
  formatPeriodLabel,
  normalizePeriodAnchor,
  shiftPeriod,
} from "./lib/date";
import { groupTasksByOwner } from "./lib/tasks";
import type {
  PairMember,
  PeriodType,
  Profile,
  Task,
} from "./types/database";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string };

interface AppState {
  profile: Profile | null;
  pairMembers: PairMember[];
  memberProfiles: Profile[];
  tasks: Task[];
}

const periodOptions: PeriodType[] = ["day", "week", "month"];

const defaultState: AppState = {
  profile: null,
  pairMembers: [],
  memberProfiles: [],
  tasks: [],
};

export function App() {
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading",
  });
  const [appState, setAppState] = useState<AppState>(defaultState);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("day");
  const [anchorDate, setAnchorDate] = useState(() =>
    normalizePeriodAnchor(new Date(), "day"),
  );
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskOwnerId, setNewTaskOwnerId] = useState("");
  const [newTaskPeriod, setNewTaskPeriod] = useState<PeriodType>("day");
  const [newTaskDate, setNewTaskDate] = useState(formatDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionState({ status: "signed-out" });
      return;
    }

    const client = supabase;

    const syncSession = async () => {
      const { data, error: sessionError } = await client.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        setSessionState({ status: "signed-out" });
        return;
      }

      if (!data.session) {
        setSessionState({ status: "signed-out" });
        return;
      }

      setSessionState({
        status: "signed-in",
        userId: data.session.user.id,
      });
    };

    void syncSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setSessionState({ status: "signed-out" });
        setAppState(defaultState);
        return;
      }

      setSessionState({ status: "signed-in", userId: session.user.id });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionState.status !== "signed-in") {
      return;
    }

    void loadAppState(sessionState.userId);
  }, [sessionState]);

  useEffect(() => {
    setAnchorDate((currentAnchor) =>
      normalizePeriodAnchor(currentAnchor, selectedPeriod),
    );
  }, [selectedPeriod]);

  const loadAppState = async (userId: string) => {
    if (!supabase) {
      setError(envError);
      return;
    }

    const client = supabase;

    setLoading(true);
    setError(null);

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<Profile>();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (!profile) {
      setAppState(defaultState);
      setLoading(false);
      return;
    }

    if (!profile.active_pair_id) {
      setAppState({
        profile,
        pairMembers: [],
        memberProfiles: [],
        tasks: [],
      });
      setNewTaskOwnerId(profile.id);
      setLoading(false);
      return;
    }

    const { data: members, error: membersError } = await client
      .from("pair_members")
      .select("*")
      .eq("pair_id", profile.active_pair_id)
      .returns<PairMember[]>();

    if (membersError) {
      setError(membersError.message);
      setLoading(false);
      return;
    }

    const memberIds = members.map((member) => member.profile_id);

    const [{ data: profiles, error: membersProfileError }, { data: tasks, error: tasksError }] =
      await Promise.all([
        client.from("profiles").select("*").in("id", memberIds).returns<Profile[]>(),
        client
          .from("tasks")
          .select("*")
          .eq("pair_id", profile.active_pair_id)
          .order("created_at", { ascending: true })
          .returns<Task[]>(),
      ]);

    if (membersProfileError) {
      setError(membersProfileError.message);
      setLoading(false);
      return;
    }

    if (tasksError) {
      setError(tasksError.message);
      setLoading(false);
      return;
    }

    const sortedProfiles = [...profiles].sort((left, right) => {
      if (left.id === profile.id) {
        return -1;
      }

      if (right.id === profile.id) {
        return 1;
      }

      return left.display_name.localeCompare(right.display_name);
    });

    setAppState({
      profile,
      pairMembers: members,
      memberProfiles: sortedProfiles,
      tasks,
    });
    setNewTaskOwnerId(sortedProfiles[0]?.id ?? profile.id);
    setLoading(false);
  };

  const handleAuth = async () => {
    if (!supabase) {
      setError(envError);
      return;
    }

    const client = supabase;

    setLoading(true);
    setError(null);

    if (authMode === "sign-up") {
      const { error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim() || "Anonymous",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      }
    }

    setLoading(false);
  };

  const handleJoinPair = async () => {
    if (!supabase || sessionState.status !== "signed-in" || !inviteCodeInput.trim()) {
      return;
    }

    const client = supabase;

    setLoading(true);
    setError(null);

    const { error: rpcError } = await client.rpc("create_pair_with_invite", {
      invite_code_input: inviteCodeInput.trim().toUpperCase(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    await loadAppState(sessionState.userId);
    setInviteCodeInput("");
    setLoading(false);
  };

  const handleCreateTask = async () => {
    if (
      !supabase ||
      sessionState.status !== "signed-in" ||
      !appState.profile?.active_pair_id ||
      !newTaskTitle.trim() ||
      !newTaskOwnerId
    ) {
      return;
    }

    const client = supabase;

    setLoading(true);
    setError(null);

    const { error: taskError } = await client.from("tasks").insert({
      title: newTaskTitle.trim(),
      pair_id: appState.profile.active_pair_id,
      owner_profile_id: newTaskOwnerId,
      created_by: sessionState.userId,
      period_type: newTaskPeriod,
      period_anchor_date: normalizePeriodAnchor(newTaskDate, newTaskPeriod),
    });

    if (taskError) {
      setError(taskError.message);
      setLoading(false);
      return;
    }

    await loadAppState(sessionState.userId);
    setNewTaskTitle("");
    setLoading(false);
  };

  const toggleTask = async (task: Task) => {
    if (!supabase || sessionState.status !== "signed-in") {
      return;
    }

    const client = supabase;

    setLoading(true);
    setError(null);

    const nextCompleted = !task.completed;
    const { error: updateError } = await client
      .from("tasks")
      .update({
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await loadAppState(sessionState.userId);
    setLoading(false);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
  };

  const groupedTasks = groupTasksByOwner(
    appState.tasks,
    appState.memberProfiles,
    selectedPeriod,
    anchorDate,
  );

  if (sessionState.status === "loading") {
    return <Shell>Loading session...</Shell>;
  }

  if (sessionState.status === "signed-out") {
    return (
      <Shell>
        <section className="card auth-card">
          <div className="eyebrow">TaskDuet MVP</div>
          <h1>Shared planning for two people.</h1>
          <p className="muted">
            Sign in with email and password. New accounts create a profile with
            an invite code for pairing.
          </p>

          {envError && <p className="error">{envError}</p>}

          <div className="segmented">
            {(["sign-in", "sign-up"] as const).map((mode) => (
              <button
                key={mode}
                className={authMode === mode ? "active" : ""}
                onClick={() => setAuthMode(mode)}
                type="button"
              >
                {mode === "sign-in" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {authMode === "sign-up" && (
            <label>
              Display name
              <input
                onChange={(event) => setDisplayName(event.target.value)}
                type="text"
                value={displayName}
              />
            </label>
          )}

          <button className="primary" disabled={loading} onClick={handleAuth} type="button">
            {authMode === "sign-in" ? "Sign In" : "Create Account"}
          </button>

          {error && <p className="error">{error}</p>}
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">TaskDuet</div>
          <h1>
            {appState.profile
              ? `${appState.profile.display_name}'s shared tasks`
              : "Shared tasks"}
          </h1>
        </div>
        <div className="topbar-actions">
          <span className="status-pill">{loading ? "Syncing" : "Live"}</span>
          <button onClick={handleSignOut} type="button">
            Sign Out
          </button>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      {!appState.profile ? (
        <section className="card">
          <p>Profile not found. Create the matching `profiles` row in Supabase.</p>
        </section>
      ) : !appState.profile.active_pair_id ? (
        <section className="pair-grid">
          <article className="card">
            <div className="eyebrow">Your code</div>
            <div className="invite-code">{appState.profile.invite_code}</div>
            <p className="muted">
              Share this with your partner so they can join and create the pair.
            </p>
          </article>

          <article className="card">
            <div className="eyebrow">Join a pair</div>
            <label>
              Partner invite code
              <input
                onChange={(event) => setInviteCodeInput(event.target.value)}
                placeholder="ABC123"
                type="text"
                value={inviteCodeInput}
              />
            </label>
            <button className="primary" onClick={handleJoinPair} type="button">
              Join Pair
            </button>
          </article>
        </section>
      ) : (
        <>
          <section className="toolbar card">
            <div className="segmented">
              {periodOptions.map((period) => (
                <button
                  key={period}
                  className={selectedPeriod === period ? "active" : ""}
                  onClick={() => setSelectedPeriod(period)}
                  type="button"
                >
                  {period}
                </button>
              ))}
            </div>

            <div className="period-nav">
              <button
                onClick={() => setAnchorDate(shiftPeriod(anchorDate, selectedPeriod, -1))}
                type="button"
              >
                Previous
              </button>
              <strong>{formatPeriodLabel(anchorDate, selectedPeriod)}</strong>
              <button
                onClick={() => setAnchorDate(shiftPeriod(anchorDate, selectedPeriod, 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </section>

          <section className="card create-card">
            <div className="eyebrow">New task</div>
            <div className="form-row">
              <label>
                Title
                <input
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Take out trash"
                  type="text"
                  value={newTaskTitle}
                />
              </label>

              <label>
                Column owner
                <select
                  onChange={(event) => setNewTaskOwnerId(event.target.value)}
                  value={newTaskOwnerId}
                >
                  {appState.memberProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Period
                <select
                  onChange={(event) => setNewTaskPeriod(event.target.value as PeriodType)}
                  value={newTaskPeriod}
                >
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Anchor date
                <input
                  onChange={(event) => setNewTaskDate(event.target.value)}
                  type="date"
                  value={newTaskDate}
                />
              </label>

              <button className="primary" onClick={handleCreateTask} type="button">
                Add task
              </button>
            </div>
          </section>

          <section className="columns">
            {groupedTasks.map(({ profile, tasks }) => (
              <article className="card task-column" key={profile.id}>
                <div className="column-header">
                  <div>
                    <div className="eyebrow">Column</div>
                    <h2>{profile.display_name}</h2>
                  </div>
                  <span className="task-count">{tasks.length}</span>
                </div>

                <div className="task-list">
                  {tasks.length === 0 ? (
                    <p className="empty-state">No tasks visible for this period.</p>
                  ) : (
                    tasks.map((task) => (
                      <label
                        className={`task-item ${task.completed ? "completed" : ""}`}
                        key={task.id}
                      >
                        <input
                          checked={task.completed}
                          onChange={() => void toggleTask(task)}
                          type="checkbox"
                        />
                        <span>{task.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <div className="backdrop" />
      <div className="content">{children}</div>
    </main>
  );
}
