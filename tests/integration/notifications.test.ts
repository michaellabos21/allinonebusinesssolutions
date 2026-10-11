import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type TestUser,
  addMember,
  admin,
  anonymous,
  cleanUp,
  createUser,
  createWorkspace,
} from "./helpers";

/**
 * Proves the notification rules against a real database: what creates one,
 * who receives it, the switches that turn each kind off, and that people only
 * see and change their own.
 *
 * Cast: Ana owns workspace A with Max (manager), Mia and Leo (members) and
 * Cleo (client). Ben owns workspace B.
 */
let ana: TestUser, max: TestUser, mia: TestUser, leo: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;

const isoDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function saveTask(
  user: TestUser,
  fields: Record<string, unknown>,
  assignees: string[] | null,
  task: string | null = null,
) {
  const { data, error } = await user.client.rpc("save_task", {
    target_workspace: workspaceA,
    target_task: task,
    fields,
    assignee_ids: assignees,
  });
  expect(error).toBeNull();
  return data as string;
}

/** Everything a person has been sent, newest first, read as that person. */
async function inbox(user: TestUser, workspace = workspaceA) {
  const { data, error } = await user.client
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspace)
    .order("created_at", { ascending: false });
  expect(error).toBeNull();
  return data!;
}
const about = async (user: TestUser, column: string, id: string) =>
  (await inbox(user)).filter((row) => row[column] === id);

async function comment(user: TestUser, task: string, body: string, mentions: string[] = []) {
  const { data, error } = await user.client
    .from("task_comments")
    .insert({ workspace_id: workspaceA, task_id: task, body, mentions })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

const setSwitch = (user: TestUser, column: string, on: boolean) =>
  user.client
    .from("profiles")
    .update({ [column]: on })
    .eq("id", user.id);

beforeAll(async () => {
  [ana, max, mia, leo, cleo, ben] = await Promise.all(
    ["ana", "max", "mia", "leo", "cleo", "ben"].map((label) => createUser(`notify-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Notify A");
  workspaceB = await createWorkspace(ben, "Notify B");
  await addMember(ana, workspaceA, max, "manager");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, leo, "member");
  await addMember(ana, workspaceA, cleo, "client");
  // Tests compare dates in UTC.
  await admin.from("workspaces").update({ timezone: "UTC" }).in("id", [workspaceA, workspaceB]);
});

afterAll(cleanUp);

describe("tasks", () => {
  it("tells people they were assigned, but not the person assigning", async () => {
    const task = await saveTask(ana, { title: "Logo concepts" }, [ana.id, mia.id]);
    const [note] = await about(mia, "task_id", task);
    expect(note).toMatchObject({
      kind: "task_assigned",
      actor_id: ana.id,
      body: "Logo concepts",
      href: `/work/tasks/${task}`,
      read_at: null,
    });
    expect(note.title).toContain("assigned you a task");
    expect(await about(ana, "task_id", task)).toEqual([]);

    await saveTask(ana, {}, [ana.id, mia.id, leo.id], task);
    expect((await about(leo, "task_id", task)).map((row) => row.kind)).toEqual(["task_assigned"]);
    // Mia was already on it, so nothing new for her.
    expect(await about(mia, "task_id", task)).toHaveLength(1);
  });

  it("tells people mentioned in a comment, and everyone else on the task", async () => {
    const task = await saveTask(max, { title: "Brand guide" }, [mia.id, leo.id]);
    const id = await comment(mia, task, "Draft is up, @Leo please check", [leo.id]);

    const leoNotes = (await about(leo, "task_id", task)).filter(
      (row) => row.kind !== "task_assigned",
    );
    expect(leoNotes).toHaveLength(1);
    expect(leoNotes[0]).toMatchObject({
      kind: "task_mentioned",
      body: "Draft is up, @Leo please check",
      href: `/work/tasks/${task}#comment-${id}`,
    });
    // Max created the task, so he hears about the comment.
    expect((await about(max, "task_id", task)).map((row) => row.kind)).toEqual(["task_comment"]);
    // The author hears nothing about their own comment.
    expect(
      (await about(mia, "task_id", task)).filter((row) => row.kind !== "task_assigned"),
    ).toEqual([]);
  });

  it("only tells people newly mentioned when a comment is edited", async () => {
    const task = await saveTask(ana, { title: "Edits" }, [mia.id]);
    const id = await comment(mia, task, "cc @Leo", [leo.id]);
    await mia.client
      .from("task_comments")
      .update({ body: "cc @Leo @Max", mentions: [leo.id, max.id] })
      .eq("id", id);
    expect((await about(leo, "task_id", task)).map((row) => row.kind)).toEqual(["task_mentioned"]);
    expect((await about(max, "task_id", task)).map((row) => row.kind)).toEqual(["task_mentioned"]);
  });

  it("respects each person's switches", async () => {
    await setSwitch(leo, "notify_task_assigned", false);
    await setSwitch(leo, "notify_mentions", false);
    const task = await saveTask(ana, { title: "Quiet" }, [leo.id]);
    await comment(ana, task, "@Leo see this", [leo.id]);
    expect(await about(leo, "task_id", task)).toEqual([]);
    await setSwitch(leo, "notify_task_assigned", true);
    await setSwitch(leo, "notify_mentions", true);
  });

  it("reminds assignees on the day a task is due, once", async () => {
    const task = await saveTask(ana, { title: "Due now", dueOn: isoDate() }, [mia.id]);
    const later = await saveTask(ana, { title: "Due later", dueOn: isoDate(3) }, [mia.id]);
    const done = await saveTask(ana, { title: "Done", dueOn: isoDate(), status: "done" }, [mia.id]);
    for (let i = 0; i < 2; i++) {
      expect(
        (await mia.client.rpc("refresh_notifications", { target_workspace: workspaceA })).error,
      ).toBeNull();
    }
    const due = (await inbox(mia)).filter((row) => row.kind === "task_due");
    expect(due.filter((row) => row.task_id === task)).toHaveLength(1);
    expect(due.some((row) => row.task_id === later || row.task_id === done)).toBe(false);
    // Only for the caller: Leo isn't on it, Ana didn't ask.
    expect((await inbox(ana)).some((row) => row.kind === "task_due")).toBe(false);
  });

  it("goes when its task is deleted", async () => {
    const task = await saveTask(ana, { title: "Short-lived" }, [mia.id]);
    expect(await about(mia, "task_id", task)).toHaveLength(1);
    await admin.from("tasks").delete().eq("id", task);
    expect(await about(mia, "task_id", task)).toEqual([]);
  });
});

describe("money", () => {
  let invoice: string;

  beforeAll(async () => {
    const { data: contact } = await ana.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Rina Cruz", email: "rina@notify.test" })
      .select("id")
      .single();
    const { data } = await ana.client.rpc("save_invoice_draft", {
      target_workspace: workspaceA,
      target_invoice: null,
      header: { contactId: contact!.id, issuedOn: isoDate(), dueOn: isoDate(15) },
      items: [{ description: "Design", quantityMilli: 1000, unitPriceMinor: 100_000 }],
    });
    invoice = data as string;
    expect((await ana.client.rpc("issue_invoice", { target_invoice: invoice })).error).toBeNull();
  });

  const pay = (amount: number) =>
    max.client.rpc("record_payment", {
      target_invoice: invoice,
      amount,
      paid: isoDate(),
      pay_method: "cash",
      pay_reference: "",
      pay_note: "",
    });

  it("tells finance managers about payments, but not members or clients", async () => {
    expect((await pay(40_000)).error).toBeNull();
    const [part] = await about(ana, "invoice_id", invoice);
    expect(part).toMatchObject({ kind: "invoice_paid", href: `/money/invoices/${invoice}` });
    expect(part.title).toMatch(/^Payment recorded on INV-\d{4}$/);
    expect(part.body).toBe("PHP 400.00 from Rina Cruz");

    expect((await pay(60_000)).error).toBeNull();
    const [full] = await about(ana, "invoice_id", invoice);
    expect(full.title).toMatch(/^INV-\d{4} is paid in full$/);
    // Max recorded both payments.
    expect(await about(max, "invoice_id", invoice)).toEqual([]);
    expect(await about(mia, "invoice_id", invoice)).toEqual([]);
    expect((await inbox(cleo)).some((row) => row.kind === "invoice_paid")).toBe(false);
  });

  it("tells finance managers once when an issued invoice is overdue", async () => {
    const { data: contact } = await ana.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Late Payer", email: "late@notify.test" })
      .select("id")
      .single();
    const { data: late } = await ana.client.rpc("save_invoice_draft", {
      target_workspace: workspaceA,
      target_invoice: null,
      header: { contactId: contact!.id, issuedOn: isoDate(), dueOn: isoDate(15) },
      items: [{ description: "Retainer", quantityMilli: 1000, unitPriceMinor: 50_000 }],
    });
    await ana.client.rpc("issue_invoice", { target_invoice: late });
    await admin
      .from("invoices")
      .update({ issued_on: isoDate(-20), due_on: isoDate(-5) })
      .eq("id", late);

    for (const user of [max, max, mia]) {
      await user.client.rpc("refresh_notifications", { target_workspace: workspaceA });
    }
    const overdue = await about(max, "invoice_id", late as string);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].kind).toBe("invoice_overdue");
    expect(overdue[0].body).toBe("PHP 500.00 owed by Late Payer");
    expect(await about(mia, "invoice_id", late as string)).toEqual([]);
  });
});

describe("leads", () => {
  it("tells the team when a lead arrives through a form, not when added by hand", async () => {
    const { data: form } = await max.client
      .from("lead_forms")
      .insert({ workspace_id: workspaceA, name: "Website enquiry" })
      .select("id, token")
      .single();
    const visitor = anonymous();
    const submitted = await visitor.rpc("submit_lead_form", {
      form_token: form!.token,
      payload: { name: "Web Visitor", email: "visitor@notify.test", company: "Visitor Co" },
      client_key: "notify-visitor",
    });
    expect(submitted.error).toBeNull();

    for (const user of [ana, max, mia, leo]) {
      const leads = (await inbox(user)).filter((row) => row.kind === "lead_new");
      expect(leads).toHaveLength(1);
      expect(leads[0]).toMatchObject({
        title: "New lead from “Website enquiry”",
        body: "Web Visitor · Visitor Co",
        href: "/crm/leads",
        actor_id: null,
      });
    }
    expect((await inbox(cleo)).some((row) => row.kind === "lead_new")).toBe(false);

    await mia.client.from("leads").insert({ workspace_id: workspaceA, name: "Walk-in" });
    expect((await inbox(ana)).filter((row) => row.kind === "lead_new")).toHaveLength(1);
  });
});

describe("access", () => {
  it("lets people mark only their own notifications read", async () => {
    const task = await saveTask(ana, { title: "Mark me" }, [mia.id]);
    const [note] = await about(mia, "task_id", task);

    await leo.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", note.id);
    expect((await about(mia, "task_id", task))[0].read_at).toBeNull();

    const { error } = await mia.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", note.id);
    expect(error).toBeNull();
    expect((await about(mia, "task_id", task))[0].read_at).not.toBeNull();
  });

  it("allows no other change, and no direct inserts or deletes", async () => {
    const [note] = await inbox(mia);
    expect(
      (await mia.client.from("notifications").update({ title: "Changed" }).eq("id", note.id)).error,
    ).not.toBeNull();
    expect(
      (
        await mia.client.from("notifications").insert({
          workspace_id: workspaceA,
          user_id: mia.id,
          kind: "task_due",
          title: "Fake",
          href: "/",
        })
      ).error,
    ).not.toBeNull();
    await mia.client.from("notifications").delete().eq("id", note.id);
    expect((await inbox(mia)).some((row) => row.id === note.id)).toBe(true);
  });

  it("shows nothing to other workspaces, visitors, or people who left", async () => {
    expect(await inbox(ben, workspaceA)).toEqual([]);
    expect(
      (await ben.client.rpc("refresh_notifications", { target_workspace: workspaceA })).error,
    ).toBeNull();
    const visitor = await anonymous().from("notifications").select("id");
    expect(visitor.data ?? []).toEqual([]);

    expect((await inbox(leo)).length).toBeGreaterThan(0);
    await admin
      .from("workspace_memberships")
      .update({ status: "removed" })
      .eq("workspace_id", workspaceA)
      .eq("user_id", leo.id);
    expect(await inbox(leo)).toEqual([]);
    const task = await saveTask(ana, { title: "After leaving" }, [mia.id]);
    await comment(ana, task, "@Leo are you there?", [leo.id]);
    expect(
      (await admin.from("notifications").select("id").eq("user_id", leo.id).eq("task_id", task))
        .data,
    ).toEqual([]);
  });
});
