import { randomUUID } from "node:crypto";

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
 * Proves who can see and change profile and contact photos, using real
 * storage: the bucket's rules (`private.photo_access`) and the path checks on
 * `profiles.avatar_path` and `contacts.photo_path`.
 *
 * Cast: Ana owns workspace A, with Mia (member) and Cleo (client). Ben owns
 * workspace B and shares nothing with them.
 */
let ana: TestUser, mia: TestUser, cleo: TestUser, ben: TestUser;
let workspaceA: string, workspaceB: string;
let contactA: string, contactB: string;
const uploaded: string[] = [];

// A 1×1 transparent PNG.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);
const png = () => new Blob([PNG], { type: "image/png" });

async function upload(user: TestUser, path: string, file: Blob = png()) {
  const result = await user.client.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (!result.error) uploaded.push(path);
  return result;
}
const download = (user: TestUser, path: string) =>
  user.client.storage.from("avatars").download(path);
const userPath = (user: TestUser) => `users/${user.id}/${randomUUID()}.png`;
const contactPath = (workspace: string, contact: string) =>
  `${workspace}/contacts/${contact}/${randomUUID()}.png`;

beforeAll(async () => {
  [ana, mia, cleo, ben] = await Promise.all(
    ["ana", "mia", "cleo", "ben"].map((label) => createUser(`photo-${label}`)),
  );
  workspaceA = await createWorkspace(ana, "Photos A");
  workspaceB = await createWorkspace(ben, "Photos B");
  await addMember(ana, workspaceA, mia, "member");
  await addMember(ana, workspaceA, cleo, "client");
  const insert = async (user: TestUser, workspace: string, email: string) =>
    (
      await user.client
        .from("contacts")
        .insert({ workspace_id: workspace, name: "Rosa Lim", email })
        .select("id")
        .single()
    ).data!.id as string;
  contactA = await insert(ana, workspaceA, "rosa@photos-a.test");
  contactB = await insert(ben, workspaceB, "rosa@photos-b.test");
});

afterAll(async () => {
  if (uploaded.length) await admin.storage.from("avatars").remove(uploaded);
  await cleanUp();
});

describe("profile photos", () => {
  it("are visible to teammates, not to outsiders or the public", async () => {
    const path = userPath(ana);
    expect((await upload(ana, path)).error).toBeNull();

    expect((await download(ana, path)).data).not.toBeNull();
    expect((await download(mia, path)).data).not.toBeNull();
    expect((await download(cleo, path)).data).not.toBeNull();
    expect((await download(ben, path)).data).toBeNull();
    const visitor = anonymous();
    expect((await visitor.storage.from("avatars").download(path)).data).toBeNull();
  });

  it("can only be added or removed by their owner", async () => {
    expect((await upload(mia, userPath(ana))).error).not.toBeNull();

    const path = userPath(ana);
    await upload(ana, path);
    await mia.client.storage.from("avatars").remove([path]);
    expect((await download(ana, path)).data).not.toBeNull();
  });

  it("are recorded only under the person's own folder", async () => {
    const own = userPath(ana);
    const { error } = await ana.client
      .from("profiles")
      .update({ avatar_path: own })
      .eq("id", ana.id);
    expect(error).toBeNull();

    const someoneElses = await ana.client
      .from("profiles")
      .update({ avatar_path: userPath(mia) })
      .eq("id", ana.id);
    expect(someoneElses.error?.code).toBe("23514");

    const notAPhoto = await ana.client
      .from("profiles")
      .update({ avatar_path: `users/${ana.id}/${randomUUID()}.svg` })
      .eq("id", ana.id);
    expect(notAPhoto.error?.code).toBe("23514");
  });
});

describe("contact photos", () => {
  it("are visible to the workspace's team but not to clients or outsiders", async () => {
    const path = contactPath(workspaceA, contactA);
    expect((await upload(mia, path)).error).toBeNull();

    expect((await download(ana, path)).data).not.toBeNull();
    expect((await download(mia, path)).data).not.toBeNull();
    expect((await download(cleo, path)).data).toBeNull();
    expect((await download(ben, path)).data).toBeNull();
  });

  it("can't be added by a client, an outsider, or for another workspace's contact", async () => {
    expect((await upload(cleo, contactPath(workspaceA, contactA))).error).not.toBeNull();
    expect((await upload(ben, contactPath(workspaceA, contactA))).error).not.toBeNull();
    // Ana's workspace, but Ben's contact.
    expect((await upload(ana, contactPath(workspaceA, contactB))).error).not.toBeNull();
  });

  it("must be stored under the contact's own workspace and id", async () => {
    const own = await ana.client
      .from("contacts")
      .update({ photo_path: contactPath(workspaceA, contactA) })
      .eq("id", contactA)
      .select("id");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const wrongWorkspace = await ana.client
      .from("contacts")
      .update({ photo_path: contactPath(workspaceB, contactA) })
      .eq("id", contactA);
    expect(wrongWorkspace.error?.code).toBe("23514");

    const clientEdit = await cleo.client
      .from("contacts")
      .update({ photo_path: null })
      .eq("id", contactA)
      .select("id");
    expect(clientEdit.data ?? []).toHaveLength(0);
  });
});

describe("the bucket", () => {
  it("refuses malformed paths and files that aren't images", async () => {
    expect((await upload(ana, `users/not-a-uuid/${randomUUID()}.png`)).error).not.toBeNull();
    expect((await upload(ana, `${randomUUID()}.png`)).error).not.toBeNull();
    const text = new Blob(["hello"], { type: "text/plain" });
    expect((await upload(ana, userPath(ana), text)).error).not.toBeNull();
  });

  it("is private", async () => {
    const { data } = await admin.storage.getBucket("avatars");
    expect(data?.public).toBe(false);
    expect(data?.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
