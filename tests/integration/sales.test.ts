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
 * Proves the Phase 3 rules for leads, deals, pipeline stages and public lead
 * forms against a real database.
 *
 * Cast: Ana owns workspace A, with Max (manager), Mia (member) and Cleo
 * (client). Ben owns workspace B and has nothing to do with A.
 */
let ana: TestUser, max: TestUser, mia: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;
let stages: { id: string; name: string; kind: string }[];
let openStage: string, wonStage: string, lostStage: string;
let formToken: string, formId: string;

const TABLES = ["pipeline_stages", "leads", "deals", "lead_forms", "lead_form_submissions"];

const stageNamed = (name: string) => stages.find((stage) => stage.name === name)!.id;

async function newLead(user: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("leads")
    .insert({ workspace_id: workspaceA, name: "Lead Person", ...fields })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function newDeal(user: TestUser, fields: Record<string, unknown> = {}) {
  return user.client
    .from("deals")
    .insert({
      workspace_id: workspaceA,
      name: "Website rebuild",
      owner_id: user.id,
      stage_id: openStage,
      amount_minor: 5_000_000,
      expected_close_on: "2026-12-15",
      ...fields,
    })
    .select("id, currency, closed_on")
    .single();
}

beforeAll(async () => {
  [ana, max, mia, cleo, ben] = await Promise.all(
    ["ana", "max", "mia", "cleo", "ben"].map((label) => createUser(`sales-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Sales A");
  workspaceB = await createWorkspace(ben, "Sales B");
  await addMember(ana, workspaceA, max, "manager");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, cleo, "client");

  const { data } = await ana.client
    .from("pipeline_stages")
    .select("id, name, kind")
    .eq("workspace_id", workspaceA)
    .order("position");
  stages = data ?? [];
  openStage = stageNamed("Discovery");
  wonStage = stageNamed("Won");
  lostStage = stageNamed("Lost");

  const form = await max.client
    .from("lead_forms")
    .insert({
      workspace_id: workspaceA,
      name: "Website enquiry",
      consent_text: "You may contact me about my enquiry.",
    })
    .select("id, token")
    .single();
  if (form.error) throw new Error(form.error.message);
  formId = form.data.id;
  formToken = form.data.token;
});

afterAll(cleanUp);

describe("pipeline stages", () => {
  it("gives every new workspace six default stages", () => {
    expect(stages.map((stage) => [stage.name, stage.kind])).toEqual([
      ["Discovery", "open"],
      ["Qualified", "open"],
      ["Proposal", "open"],
      ["Negotiation", "open"],
      ["Won", "won"],
      ["Lost", "lost"],
    ]);
  });

  it("lets managers add, rename and reorder stages, but not members", async () => {
    const added = await max.client
      .from("pipeline_stages")
      .insert({ workspace_id: workspaceA, name: "Demo booked", position: 9, kind: "open" })
      .select("id")
      .single();
    expect(added.error).toBeNull();

    const byMember = await mia.client
      .from("pipeline_stages")
      .insert({ workspace_id: workspaceA, name: "Sneaky", position: 9 });
    expect(byMember.error).not.toBeNull();

    const renamedByMember = await mia.client
      .from("pipeline_stages")
      .update({ name: "Renamed" })
      .eq("id", openStage)
      .select("id");
    expect(renamedByMember.data).toEqual([]);

    const order = [added.data!.id, ...stages.map((stage) => stage.id)];
    expect(
      (await mia.client.rpc("set_stage_order", { target_workspace: workspaceA, stage_ids: order }))
        .error,
    ).not.toBeNull();
    expect(
      (await max.client.rpc("set_stage_order", { target_workspace: workspaceA, stage_ids: order }))
        .error,
    ).toBeNull();
    const { data } = await ana.client
      .from("pipeline_stages")
      .select("name")
      .eq("workspace_id", workspaceA)
      .is("archived_at", null)
      .order("position")
      .limit(2);
    expect(data?.map((row) => row.name)).toEqual(["Demo booked", "Discovery"]);

    // A list missing a stage is refused.
    expect(
      (
        await max.client.rpc("set_stage_order", {
          target_workspace: workspaceA,
          stage_ids: order.slice(1),
        })
      ).error?.message,
    ).toContain("invalid_stage_list");

    await max.client
      .from("pipeline_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", added.data!.id);
  });

  it("always keeps a won and a lost stage, and never archives a stage with live deals", async () => {
    const archiveWon = await ana.client
      .from("pipeline_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", wonStage);
    expect(archiveWon.error?.message).toContain("pipeline_needs_open_won_lost");

    const deal = await newDeal(ana, { stage_id: stageNamed("Qualified"), name: "Holds a stage" });
    expect(deal.error).toBeNull();
    const archiveBusy = await ana.client
      .from("pipeline_stages")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", stageNamed("Qualified"));
    expect(archiveBusy.error?.message).toContain("stage_has_deals");
  });
});

describe("workspace isolation", () => {
  it("hides every sales table from another workspace's owner, a client and the public", async () => {
    await newLead(ana, { name: "Private Lead" });
    for (const reader of [ben.client, cleo.client, anonymous()]) {
      for (const table of TABLES) {
        const { data } = await reader.from(table).select("id").eq("workspace_id", workspaceA);
        expect(data ?? [], `${table}`).toEqual([]);
      }
    }
  });

  it("refuses leads and deals written into another workspace or linked across workspaces", async () => {
    const lead = await ben.client.from("leads").insert({ workspace_id: workspaceA, name: "Nope" });
    expect(lead.error).not.toBeNull();

    const { data: stageB } = await ben.client
      .from("pipeline_stages")
      .select("id")
      .eq("workspace_id", workspaceB)
      .eq("kind", "open")
      .limit(1)
      .single();
    // A deal in A cannot sit in B's stage.
    const crossStage = await newDeal(ana, { stage_id: stageB!.id });
    expect(crossStage.error).not.toBeNull();
    // Nor be owned by someone outside A.
    const outsider = await newDeal(ana, { owner_id: ben.id });
    expect(outsider.error?.message).toContain("owner_not_a_member");
    // Nor be owned by a client.
    const client = await newDeal(ana, { owner_id: cleo.id });
    expect(client.error?.message).toContain("owner_not_a_member");
  });
});

describe("deals", () => {
  it("stores amounts in minor units with the workspace currency by default", async () => {
    const { data, error } = await newDeal(mia);
    expect(error).toBeNull();
    expect(data?.currency).toBe("PHP");
    expect(data?.closed_on).toBeNull();
    const bad = await newDeal(mia, { currency: "pesos" });
    expect(bad.error).not.toBeNull();
    const negative = await newDeal(mia, { amount_minor: -1 });
    expect(negative.error).not.toBeNull();
  });

  it("needs a reason to lose a deal, and sets the close date when it closes", async () => {
    const { data } = await newDeal(mia, { name: "Closing deal" });
    const id = data!.id;

    const noReason = await mia.client.from("deals").update({ stage_id: lostStage }).eq("id", id);
    expect(noReason.error?.message).toContain("lost_reason_required");

    const lost = await mia.client
      .from("deals")
      .update({ stage_id: lostStage, lost_reason: "Went with a cheaper agency" })
      .eq("id", id)
      .select("closed_on, lost_reason")
      .single();
    expect(lost.error).toBeNull();
    expect(lost.data?.closed_on).not.toBeNull();

    const reopened = await mia.client
      .from("deals")
      .update({ stage_id: openStage })
      .eq("id", id)
      .select("closed_on, lost_reason")
      .single();
    expect(reopened.data).toEqual({ closed_on: null, lost_reason: "" });
  });

  it("logs stage, value and owner changes in the deal's history with the real actor", async () => {
    const { data } = await newDeal(mia, { name: "History deal", amount_minor: 100_000 });
    const id = data!.id;
    await mia.client
      .from("deals")
      .update({ stage_id: stageNamed("Proposal") })
      .eq("id", id);
    await mia.client.from("deals").update({ amount_minor: 250_050 }).eq("id", id);
    await mia.client.from("deals").update({ owner_id: max.id }).eq("id", id);
    await mia.client.from("deals").update({ stage_id: wonStage }).eq("id", id);

    const { data: history } = await ana.client
      .from("activities")
      .select("actor_id, summary")
      .eq("deal_id", id)
      .order("created_at");
    expect(history?.map((row) => row.summary)).toEqual([
      "opened the deal “History deal” at Discovery, PHP 1,000.00",
      "moved “History deal” to Proposal",
      "changed the value of “History deal” from PHP 1,000.00 to PHP 2,500.50",
      "handed “History deal” to Test sales-max",
      "won the deal “History deal”",
    ]);
    expect(new Set(history?.map((row) => row.actor_id))).toEqual(new Set([mia.id]));
  });

  it("lets members edit but only managers archive, and never deletes", async () => {
    const { data } = await newDeal(mia, { name: "Archive me" });
    const id = data!.id;
    const byMember = await mia.client
      .from("deals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(byMember.error?.message).toContain("forbidden_archive");
    const byManager = await max.client
      .from("deals")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(byManager.error).toBeNull();

    await ana.client.from("deals").delete().eq("id", id);
    const { data: still } = await admin.from("deals").select("id").eq("id", id);
    expect(still).toHaveLength(1);
  });

  it("shows clients no deals and lets them change none", async () => {
    const { data } = await newDeal(ana, { name: "Not for clients" });
    const edit = await cleo.client
      .from("deals")
      .update({ name: "Hacked" })
      .eq("id", data!.id)
      .select("id");
    expect(edit.data ?? []).toEqual([]);
    const add = await newDeal(cleo);
    expect(add.error).not.toBeNull();
  });
});

describe("lead conversion", () => {
  const convert = (user: TestUser, lead: string, overrides: Record<string, unknown> = {}) =>
    user.client.rpc("convert_lead", {
      target_lead: lead,
      existing_contact: null,
      create_deal: true,
      deal_name: "Converted deal",
      deal_amount_minor: 750_000,
      deal_stage: null,
      deal_close_on: null,
      ...overrides,
    });

  it("creates a contact, a company and a deal in the first open stage", async () => {
    const lead = await newLead(mia, {
      name: "Rosa Lim",
      email: "rosa@harbor.test",
      company_name: "Harbor Bakery",
      source: "Referral",
    });
    const { data, error } = await convert(mia, lead);
    expect(error).toBeNull();
    expect(data.reusedContact).toBe(false);

    const { data: contact } = await ana.client
      .from("contacts")
      .select("name, email, source, company_id, companies(name, type)")
      .eq("id", data.contactId)
      .single();
    expect(contact).toMatchObject({
      name: "Rosa Lim",
      email: "rosa@harbor.test",
      source: "Referral",
      companies: { name: "Harbor Bakery", type: "prospect" },
    });

    const { data: deal } = await ana.client
      .from("deals")
      .select("name, contact_id, company_id, stage_id, amount_minor, lead_id, owner_id")
      .eq("id", data.dealId)
      .single();
    expect(deal).toMatchObject({
      name: "Converted deal",
      contact_id: data.contactId,
      company_id: contact!.company_id,
      amount_minor: 750_000,
      lead_id: lead,
      owner_id: mia.id,
    });
    const firstOpen = (
      await ana.client
        .from("pipeline_stages")
        .select("id")
        .eq("workspace_id", workspaceA)
        .eq("kind", "open")
        .is("archived_at", null)
        .order("position")
        .limit(1)
        .single()
    ).data!.id;
    expect(deal?.stage_id).toBe(firstOpen);

    const { data: converted } = await ana.client
      .from("leads")
      .select("status, converted_contact_id, converted_deal_id")
      .eq("id", lead)
      .single();
    expect(converted).toEqual({
      status: "converted",
      converted_contact_id: data.contactId,
      converted_deal_id: data.dealId,
    });
  });

  it("reuses a contact with the same email instead of creating a duplicate", async () => {
    const lead = await newLead(mia, { name: "Rosa Again", email: "rosa@harbor.test" });
    const { data, error } = await convert(mia, lead, { create_deal: false });
    expect(error).toBeNull();
    expect(data.reusedContact).toBe(true);
    expect(data.dealId).toBeNull();
    const { data: matches } = await ana.client
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceA)
      .eq("email", "rosa@harbor.test");
    expect(matches).toHaveLength(1);
  });

  it("uses the contact the user chose", async () => {
    const { data: chosen } = await ana.client
      .from("contacts")
      .insert({ workspace_id: workspaceA, name: "Chosen One", email: "chosen@a.test" })
      .select("id")
      .single();
    const lead = await newLead(mia, { name: "Different Name", email: "other@a.test" });
    const { data } = await convert(mia, lead, { existing_contact: chosen!.id, create_deal: false });
    expect(data.contactId).toBe(chosen!.id);
    const { data: none } = await ana.client
      .from("contacts")
      .select("id")
      .eq("email", "other@a.test");
    expect(none).toEqual([]);
  });

  it("refuses to convert twice, to use another workspace's contact, or to fake a conversion", async () => {
    const lead = await newLead(mia, { name: "Once Only", email: "once@a.test" });
    expect((await convert(mia, lead, { create_deal: false })).error).toBeNull();
    expect((await convert(mia, lead)).error?.message).toContain("already_converted");

    const { data: foreign } = await ben.client
      .from("contacts")
      .insert({ workspace_id: workspaceB, name: "Foreign", email: "foreign@b.test" })
      .select("id")
      .single();
    const other = await newLead(mia, { name: "Cross", email: "cross@a.test" });
    expect((await convert(mia, other, { existing_contact: foreign!.id })).error?.message).toContain(
      "contact_not_found",
    );

    expect((await convert(ben, other)).error?.message).toContain("not_found");
    expect((await convert(cleo, other)).error?.message).toContain("not_found");

    const faked = await mia.client.from("leads").update({ status: "converted" }).eq("id", other);
    expect(faked.error).not.toBeNull();
    const reopened = await mia.client.from("leads").update({ status: "new" }).eq("id", lead);
    expect(reopened.error?.message).toContain("convert_with_function");
  });

  it("needs an email to create a new contact", async () => {
    const lead = await newLead(mia, { name: "No Email" });
    expect((await convert(mia, lead)).error?.message).toContain("email_required");
  });
});

describe("public lead form", () => {
  const visitor = anonymous();
  const submit = (payload: Record<string, unknown>, client = "visitor-1", token = formToken) =>
    visitor.rpc("submit_lead_form", { form_token: token, payload, client_key: client });
  const valid = {
    name: "Web Visitor",
    email: "visitor@web.test",
    company: "Visitor Co",
    message: "Can you quote a logo?",
    consent: "true",
  };

  it("shows only the form's own wording to the public", async () => {
    const { data, error } = await visitor.rpc("get_lead_form", { form_token: formToken });
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        form_name: "Website enquiry",
        business_name: "Sales A",
        intro: "",
        consent_text: "You may contact me about my enquiry.",
      },
    ]);
    const missing = await visitor.rpc("get_lead_form", { form_token: "not-a-token" });
    expect(missing.data).toEqual([]);
  });

  it("creates an unowned lead in the form's workspace and a feed line", async () => {
    const { data, error } = await submit(valid);
    expect(error).toBeNull();
    expect(data).toBe("Thanks, we’ll be in touch soon.");

    const { data: lead } = await ana.client
      .from("leads")
      .select("workspace_id, name, email, company_name, source, notes, owner_id, form_id, status")
      .eq("email", "visitor@web.test")
      .single();
    expect(lead).toEqual({
      workspace_id: workspaceA,
      name: "Web Visitor",
      email: "visitor@web.test",
      company_name: "Visitor Co",
      source: "Form: Website enquiry",
      notes: "Can you quote a logo?",
      owner_id: null,
      form_id: formId,
      status: "new",
    });
    const { data: feed } = await ana.client
      .from("activities")
      .select("actor_id, summary")
      .eq("workspace_id", workspaceA)
      .like("summary", "New enquiry from Web Visitor%");
    expect(feed).toEqual([
      {
        actor_id: null,
        summary: "New enquiry from Web Visitor through the form “Website enquiry”",
      },
    ]);
  });

  it("rejects bad input, missing consent, unknown or inactive forms", async () => {
    expect((await submit({ ...valid, email: "nope" }, "visitor-2")).error?.message).toContain(
      "invalid_submission",
    );
    expect((await submit({ ...valid, consent: "" }, "visitor-2")).error?.message).toContain(
      "invalid_submission",
    );
    expect((await submit({ ...valid, name: "" }, "visitor-2")).error?.message).toContain(
      "invalid_submission",
    );
    expect((await submit(valid, "visitor-2", "unknown")).error?.message).toContain(
      "form_not_found",
    );

    await max.client.from("lead_forms").update({ active: false }).eq("id", formId);
    expect((await submit(valid, "visitor-2")).error?.message).toContain("form_not_found");
    await max.client.from("lead_forms").update({ active: true }).eq("id", formId);
  });

  it("ignores any workspace id the visitor sends", async () => {
    await submit({ ...valid, email: "smuggle@web.test", workspace_id: workspaceB }, "visitor-3");
    const { data } = await admin
      .from("leads")
      .select("workspace_id")
      .eq("email", "smuggle@web.test")
      .single();
    expect(data?.workspace_id).toBe(workspaceA);
  });

  it("limits each visitor to three submissions in ten minutes", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await submit({ ...valid, email: `burst${i}@web.test` }, "burst")).error).toBeNull();
    }
    expect(
      (await submit({ ...valid, email: "burst3@web.test" }, "burst")).error?.message,
    ).toContain("rate_limited");
    // Another visitor is unaffected.
    expect((await submit({ ...valid, email: "calm@web.test" }, "calm")).error).toBeNull();
  });

  it("gives the public no direct access to the tables or to other functions", async () => {
    const insert = await visitor.from("leads").insert({ workspace_id: workspaceA, name: "Direct" });
    expect(insert.error).not.toBeNull();
    const forms = await visitor.from("lead_forms").select("token");
    expect(forms.data ?? []).toEqual([]);
    const conversion = await visitor.rpc("convert_lead", {
      target_lead: formId,
      existing_contact: null,
      create_deal: false,
      deal_name: "",
      deal_amount_minor: 0,
      deal_stage: null,
      deal_close_on: null,
    });
    expect(conversion.error).not.toBeNull();
  });

  it("does not let anyone change a form's token", async () => {
    const { error } = await max.client
      .from("lead_forms")
      .update({ token: "guessable" })
      .eq("id", formId);
    expect(error?.message).toContain("immutable_column");
  });
});
