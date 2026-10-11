/**
 * Profile and contact photos. Files sit in the private "avatars" bucket and
 * are served by the app at /photos/<path> using the viewer's own session, so
 * the bucket's rules decide who can see each one (see
 * supabase/migrations/20261011000005_photos.sql).
 *
 * Shared by the browser (to check and shrink a photo before upload) and the
 * server (to check it again), so the limits are defined once.
 */

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** The most the server accepts. The browser shrinks photos well below this first. */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Photos are stored as squares of this many pixels. */
export const PHOTO_SIZE = 256;

export const PHOTO_EXTENSION: Record<PhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const isPhotoType = (type: string): type is PhotoType =>
  (PHOTO_TYPES as readonly string[]).includes(type);

/** Where the app serves a stored photo, or null when there is none. */
export const photoUrl = (path: string | null | undefined) => (path ? `/photos/${path}` : null);
