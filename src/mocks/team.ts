import type { Invitation, TeamMember, Workspace } from "./types";

export const teamMembers: TeamMember[] = [
  {
    id: "u1",
    name: "Mara Dalisay",
    email: "mara@dalisaystudio.example",
    title: "Studio director",
    role: "Owner",
  },
  {
    id: "u2",
    name: "Paolo Reyes",
    email: "paolo@dalisaystudio.example",
    title: "Web lead",
    role: "Admin",
  },
  {
    id: "u3",
    name: "Jenna Lim",
    email: "jenna@dalisaystudio.example",
    title: "Brand designer",
    role: "Member",
  },
  {
    id: "u4",
    name: "Tomas Villareal",
    email: "tomas@dalisaystudio.example",
    title: "Production designer",
    role: "Member",
  },
];

/** The signed-in person in the prototype. There is no real authentication. */
export const currentUser = teamMembers[0];

export const workspaces: Workspace[] = [
  { id: "w1", name: "Dalisay Studio", plan: "Studio plan" },
  { id: "w2", name: "Dalisay Events", plan: "Starter plan" },
  { id: "w3", name: "Mara's sandbox", plan: "Free plan" },
];

export const invitations: Invitation[] = [
  { id: "inv-1", email: "carmi@dalisaystudio.example", role: "Member", invitedOn: "2026-10-08" },
];
