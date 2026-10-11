import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Only the two shapes of path the app writes; anything else is not found. */
const PHOTO_PATH =
  /^(?:users\/[0-9a-f-]{36}|[0-9a-f-]{36}\/contacts\/[0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const CONTENT_TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/**
 * Serves a profile or contact photo. The file is fetched with the viewer's
 * own session, so the storage rules decide whether they may see it; anyone
 * else gets a 404. Each upload gets a new random file name, so a fetched
 * photo never changes and the browser may keep it.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const name = (await params).path.join("/");
  const match = PHOTO_PATH.exec(name);
  if (!match) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("avatars").download(name);
  if (error || !data) return new Response(null, { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPE[match[1] as keyof typeof CONTENT_TYPE],
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
