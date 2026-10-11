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
 * Proves the Phase 2 access rules for business records against a real database.
 *
 * Cast: Ana owns workspace A, with Max (manager), Mia (member) and Cleo
 * (client). Ben owns workspace B and has nothing to do with A.
 */
let ana: TestUser, max: TestUser, mia: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;
let companyA: string, contactA: string, projectA: string, taskA: string, itemA: string;

const TABLES = [
  "companies",
  "contacts",
  "contact_notes",
  "products_services",
  "projects",
  "tasks",
  "activities",
];

beforeAll(async () => {
  [ana, max, mia, cleo, ben] = await Promise.all(
    ["ana", "max", "mia", "cleo", "ben"].map((label) => createUser(`rec-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Records A");
  workspaceB = await createWorkspace(ben, "Records B");
  await addMember(ana, workspaceA, max, "manager");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, cleo, "client");

  const one = async <T>(
    query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ) => {
    const { data, error } = await query;
    if (error || !data?.[0]) throw new Error(`Fixture failed: ${error?.message}`);
    return data[0];
  };
  companyA = (
    await one(
      ana.client
        .from("companies")
        .insert({ workspace_id: workspaceA, name: "Kusina Lokal" })
        .select("id"),
    )
  ).id;
  contactA = (
    await one(
      ana.client
        .from("contacts")
        .insert({
          workspace_id: workspaceA,
          company_id: companyA,
          name: "Bianca Soriano",
          email: "bianca@a.test",
        })
        .select("id"),
    )
  ).id;
  projectA = (
    await one(
      ana.client
        .from("projects")
        .insert({
          workspace_id: workspaceA,
          name: "Ordering site",
          owner_id: ana.id,
          due_on: "2026-12-01",
        })
        .select("id"),
    )
  ).id;
  taskA = (
    await one(
      ana.client
        .from("tasks")
        .insert({
          workspace_id: workspaceA,
          project_id: projectA,
          title: "Review menu copy",
          assignee_id: ana.id,
          due_on: "2026-11-01",
        })
        .select("id"),
    )
  ).id;
  itemA = (
    await one(
      ana.client
        .from("products_services")
        .insert({
          workspace_id: workspaceA,
          name: "Page design",
          unit_price_minor: 1_200_000,
          currency: "PHP",
          unit: "page",
        })
        .select("id"),
    )
  ).id;
  await ana.client
    .from("contact_notes")
    .insert({ workspace_id: workspaceA, contact_id: contactA, body: "First note" });
});

afterAll(cleanUp);

describe("workspace isolation", () => {
  it("hides every business table from another workspace's owner", async () => {
    for (const table of TABLES) {
      const { data } = await ben.client.from(table).select("id").eq("workspace_id", workspaceA);
      expect(data, table).toEqual([]);
    }
  });

  it("hides every business table from an anonymous visitor", async () => {
    for (const table of TABLES) {
      const { data } = await anonymous().from(table).select("id");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("refuses writes into another workspace", async () => {
    const attempts = await Promise.all([
      ben.client.from("companies").insert({ workspace_id: workspaceA, name: "Intruder Co" }),
      ben.client
        .from("contacts")
        .insert({ workspace_id: workspaceA, name: "Intruder", email: "intruder@b.test" }),
      ben.client.from("projects").insert({
        workspace_id: workspaceA,
        name: "Intruder project",
        owner_id: ben.id,
        due_on: "2026-12-01",
      }),
      ben.client.from("tasks").insert({
        workspace_id: workspaceA,
        title: "Intruder task",
        assignee_id: ben.id,
        due_on: "2026-12-01",
      }),
      ben.client.from("products_services").insert({
        workspace_id: workspaceA,
        name: "Intruder item",
        unit_price_minor: 100,
        currency: "PHP",
        unit: "x",
      }),
      ben.client
        .from("contact_notes")
        .insert({ workspace_id: workspaceA, contact_id: contactA, body: "Intruder note" }),
    ]);
    for (const attempt of attempts) expect(attempt.error).not.toBeNull();
  });

  it("ignores edits to another workspace's records", async () => {
    const edits = await Promise.all([
      ben.client.from("companies").update({ name: "Renamed" }).eq("id", companyA).select("id"),
      ben.client.from("contacts").update({ name: "Renamed" }).eq("id", contactA).select("id"),
      ben.client.from("projects").update({ name: "Renamed" }).eq("id", projectA).select("id"),
      ben.client.from("tasks").update({ status: "done" }).eq("id", taskA).select("id"),
      ben.client
        .from("products_services")
        .update({ unit_price_minor: 1 })
        .eq("id", itemA)
        .select("id"),
    ]);
    for (const edit of edits) expect(edit.data ?? []).toEqual([]);
    const { data } = await admin.from("contacts").select("name").eq("id", contactA).single();
    expect(data?.name).toBe("Bianca Soriano");
  });

  it("cannot link a record to another workspace's company, contact or project", async () => {
    const contact = await ben.client.from("contacts").insert({
      workspace_id: workspaceB,
      company_id: companyA,
      name: "Linker",
      email: "linker@b.test",
    });
    const project = await ben.client.from("projects").insert({
      workspace_id: workspaceB,
      contact_id: contactA,
      name: "Linked",
      owner_id: ben.id,
      due_on: "2026-12-01",
    });
    const task = await ben.client.from("tasks").insert({
      workspace_id: workspaceB,
      project_id: projectA,
      title: "Linked",
      assignee_id: ben.id,
      due_on: "2026-12-01",
    });
    for (const attempt of [contact, project, task]) expect(attempt.error).not.toBeNull();
  });

  it("cannot move a record into another workspace", async () => {
    const move = await ana.client
      .from("contacts")
      .update({ workspace_id: workspaceB })
      .eq("id", contactA);
    expect(move.error).not.toBeNull();
  });
});

describe("roles", () => {
  it("lets a member read, add and edit contacts, companies and tasks", async () => {
    expect((await mia.client.from("contacts").select("id").eq("id", contactA)).data).toHaveLength(
      1,
    );
    const company = await mia.client
      .from("companies")
      .insert({ workspace_id: workspaceA, name: "Mia Co" })
      .select("id");
    expect(company.error).toBeNull();
    const contact = await mia.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Mia's contact", email: "mias-contact@a.test" })
      .select("id");
    expect(contact.error).toBeNull();
    const edit = await mia.client
      .from("contacts")
      .update({ phone: "0917 555 0100" })
      .eq("id", contactA)
      .select("id");
    expect(edit.data).toHaveLength(1);
  });

  it("stops a member archiving, but lets a manager archive and restore", async () => {
    const byMember = await mia.client
      .from("contacts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", contactA);
    expect(byMember.error?.message).toContain("forbidden_archive");

    const byManager = await max.client
      .from("contacts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", contactA)
      .select("id");
    expect(byManager.data).toHaveLength(1);
    const restored = await max.client
      .from("contacts")
      .update({ archived_at: null })
      .eq("id", contactA)
      .select("id");
    expect(restored.data).toHaveLength(1);
  });

  it("keeps projects and the catalog for managers and above", async () => {
    const project = await mia.client.from("projects").insert({
      workspace_id: workspaceA,
      name: "Member project",
      owner_id: mia.id,
      due_on: "2026-12-01",
    });
    const item = await mia.client.from("products_services").insert({
      workspace_id: workspaceA,
      name: "Member item",
      unit_price_minor: 100,
      currency: "PHP",
      unit: "x",
    });
    expect(project.error).not.toBeNull();
    expect(item.error).not.toBeNull();
    expect(
      (
        await mia.client
          .from("projects")
          .update({ name: "Hijacked" })
          .eq("id", projectA)
          .select("id")
      ).data,
    ).toEqual([]);

    const byManager = await max.client
      .from("projects")
      .insert({
        workspace_id: workspaceA,
        name: "Manager project",
        owner_id: max.id,
        due_on: "2026-12-01",
      })
      .select("id");
    expect(byManager.error).toBeNull();
  });

  it("lets a member edit only tasks they created or are assigned", async () => {
    const others = await mia.client
      .from("tasks")
      .update({ status: "done" })
      .eq("id", taskA)
      .select("id");
    expect(others.data).toEqual([]);

    const mine = await mia.client
      .from("tasks")
      .insert({
        workspace_id: workspaceA,
        title: "Mia's task",
        assignee_id: ana.id,
        due_on: "2026-11-05",
      })
      .select("id");
    expect(mine.error).toBeNull();
    const own = await mia.client
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("id", mine.data![0].id)
      .select("id");
    expect(own.data).toHaveLength(1);

    await ana.client.from("tasks").update({ assignee_id: mia.id }).eq("id", taskA);
    const assigned = await mia.client
      .from("tasks")
      .update({ status: "in_progress" })
      .eq("id", taskA)
      .select("id");
    expect(assigned.data).toHaveLength(1);
    expect(
      (await max.client.from("tasks").update({ priority: "high" }).eq("id", taskA).select("id"))
        .data,
    ).toHaveLength(1);
  });

  it("shows a client nothing and lets them write nothing", async () => {
    for (const table of TABLES) {
      const { data } = await cleo.client.from(table).select("id").eq("workspace_id", workspaceA);
      expect(data, table).toEqual([]);
    }
    const attempt = await cleo.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Client's contact", email: "clients@a.test" });
    expect(attempt.error).not.toBeNull();
  });
});

describe("integrity", () => {
  it("only assigns work to real, non-client members", async () => {
    const outsider = await ana.client.from("tasks").insert({
      workspace_id: workspaceA,
      title: "For Ben",
      assignee_id: ben.id,
      due_on: "2026-11-05",
    });
    expect(outsider.error?.message).toContain("assignee_not_a_member");
    const client = await ana.client.from("tasks").insert({
      workspace_id: workspaceA,
      title: "For Cleo",
      assignee_id: cleo.id,
      due_on: "2026-11-05",
    });
    expect(client.error?.message).toContain("assignee_not_a_member");
    const owner = await ana.client.from("projects").update({ owner_id: ben.id }).eq("id", projectA);
    expect(owner.error?.message).toContain("owner_not_a_member");
  });

  it("always records the caller as creator and note author", async () => {
    const company = await mia.client
      .from("companies")
      .insert({ workspace_id: workspaceA, name: "Forged Co", created_by: ana.id })
      .select("created_by")
      .single();
    expect(company.data?.created_by).toBe(mia.id);
    const note = await mia.client
      .from("contact_notes")
      .insert({
        workspace_id: workspaceA,
        contact_id: contactA,
        body: "Forged note",
        author_id: ana.id,
      })
      .select("author_id")
      .single();
    expect(note.data?.author_id).toBe(mia.id);
    expect(
      (await mia.client.from("companies").update({ created_by: ana.id }).eq("name", "Forged Co"))
        .error,
    ).not.toBeNull();
  });

  it("never deletes, and never lets a note be rewritten", async () => {
    await ana.client.from("contacts").delete().eq("id", contactA);
    await ana.client.from("tasks").delete().eq("id", taskA);
    expect((await admin.from("contacts").select("id").eq("id", contactA)).data).toHaveLength(1);
    expect((await admin.from("tasks").select("id").eq("id", taskA)).data).toHaveLength(1);
    const rewrite = await ana.client
      .from("contact_notes")
      .update({ body: "Rewritten" })
      .eq("contact_id", contactA);
    expect(rewrite.error).not.toBeNull();
  });

  it("rejects duplicate emails and company names, and invalid values", async () => {
    const email = await ana.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Second Bianca", email: "bianca@a.test" });
    expect(email.error?.code).toBe("23505");
    const name = await ana.client
      .from("companies")
      .insert({ workspace_id: workspaceA, name: "KUSINA LOKAL" });
    expect(name.error?.code).toBe("23505");
    const price = await ana.client.from("products_services").insert({
      workspace_id: workspaceA,
      name: "Free item",
      unit_price_minor: 0,
      currency: "PHP",
      unit: "x",
    });
    expect(price.error).not.toBeNull();
    const badEmail = await ana.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Bad", email: "not-an-email" });
    expect(badEmail.error).not.toBeNull();
  });

  it("allows the same email and company name in a different workspace", async () => {
    const contact = await ben.client
      .from("contacts")
      .insert({ workspace_id: workspaceB, name: "Other Bianca", email: "bianca@a.test" });
    const company = await ben.client
      .from("companies")
      .insert({ workspace_id: workspaceB, name: "Kusina Lokal" });
    expect([contact.error, company.error]).toEqual([null, null]);
  });
});

describe("activity feed", () => {
  it("is written by the database with the real actor", async () => {
    await max.client.from("tasks").update({ status: "done" }).eq("id", taskA);
    // Matched by its text, not by time: the database's clock is not the test's.
    const { data } = await ana.client
      .from("activities")
      .select("actor_id, kind, summary, project_id")
      .eq("workspace_id", workspaceA)
      .like("summary", "completed%");
    expect(data).toEqual([
      {
        actor_id: max.id,
        kind: "task",
        summary: "completed “Review menu copy”",
        project_id: projectA,
      },
    ]);
  });

  it("recorded the creation of each fixture", async () => {
    const { data } = await ana.client
      .from("activities")
      .select("summary")
      .eq("workspace_id", workspaceA);
    const summaries = data?.map((row) => row.summary) ?? [];
    for (const expected of [
      "added Kusina Lokal as a company",
      "added Bianca Soriano as a contact",
      "started project “Ordering site”",
      "added task “Review menu copy”",
      "added “Page design” to the catalog",
      "archived Bianca Soriano",
      "restored Bianca Soriano",
    ]) {
      expect(summaries, expected).toContain(expected);
    }
  });

  it("cannot be written or edited by anyone", async () => {
    const forged = await ana.client.from("activities").insert({
      workspace_id: workspaceA,
      kind: "contact",
      summary: "did something impressive",
      href: "/",
    });
    expect(forged.error).not.toBeNull();
    const edit = await ana.client
      .from("activities")
      .update({ summary: "edited" })
      .eq("workspace_id", workspaceA);
    expect(edit.error).not.toBeNull();
  });
});

describe("contact import", () => {
  const rows = [
    { name: "Imported One", email: "one@import.test", company: "Import Co", tags: ["Referral"] },
    {
      name: "Imported Two",
      email: "two@import.test",
      company: "import co",
      phone: "0917 555 0111",
      status: "lead",
    },
    { name: "Already There", email: "bianca@a.test" },
  ];

  it("imports new rows, reuses companies, skips existing emails and logs one line", async () => {
    const { data, error } = await mia.client.rpc("import_contacts", {
      target_workspace: workspaceA,
      rows,
    });
    expect(error).toBeNull();
    expect(data).toEqual({ imported: 2, skipped: [{ row: 3, reason: "email_exists" }] });

    const { data: imported } = await ana.client
      .from("contacts")
      .select("name, status, tags, source, company_id, created_by")
      .eq("workspace_id", workspaceA)
      .like("email", "%@import.test")
      .order("name");
    expect(
      imported?.map((row) => [row.name, row.status, row.tags, row.source, row.created_by]),
    ).toEqual([
      ["Imported One", "active", ["Referral"], "CSV import", mia.id],
      ["Imported Two", "lead", [], "CSV import", mia.id],
    ]);
    expect(imported?.[0].company_id).toBe(imported?.[1].company_id);

    const { data: feed } = await ana.client
      .from("activities")
      .select("summary")
      .eq("workspace_id", workspaceA)
      .like("summary", "%mport%");
    expect(feed).toEqual([{ summary: "imported 2 contacts from a CSV file" }]);
  });

  it("rolls back entirely when one row is invalid", async () => {
    const attempt = await mia.client.rpc("import_contacts", {
      target_workspace: workspaceA,
      rows: [
        { name: "Good Row", email: "good@rollback.test" },
        { name: "Bad Row", email: "not-an-email" },
      ],
    });
    expect(attempt.error).not.toBeNull();
    const { data } = await ana.client
      .from("contacts")
      .select("id")
      .eq("email", "good@rollback.test");
    expect(data).toEqual([]);
  });

  it("refuses outsiders, clients and oversized files", async () => {
    const outsider = await ben.client.rpc("import_contacts", {
      target_workspace: workspaceA,
      rows,
    });
    const client = await cleo.client.rpc("import_contacts", { target_workspace: workspaceA, rows });
    expect(outsider.error?.message).toContain("forbidden");
    expect(client.error?.message).toContain("forbidden");
    const tooMany = await ana.client.rpc("import_contacts", {
      target_workspace: workspaceA,
      rows: Array.from({ length: 501 }, (_, index) => ({
        name: `Row ${index}`,
        email: `row${index}@big.test`,
      })),
    });
    expect(tooMany.error?.message).toContain("invalid_rows");
  });
});
