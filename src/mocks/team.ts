import type { TeamMember } from "./types";

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

/**
 * Default owner and assignee for demo records. These four people are fictional
 * and are not workspace members; the real team comes from the database.
 */
export const currentUser = teamMembers[0];
