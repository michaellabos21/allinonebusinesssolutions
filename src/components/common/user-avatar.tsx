import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** A person's photo, or their initials when there is no photo or it can't load. */
export function UserAvatar({
  name,
  photoPath,
  className,
}: {
  name: string;
  /** Stored photo path; omit or pass null for initials. */
  photoPath?: string | null;
  className?: string;
}) {
  const src = photoUrl(photoPath);
  return (
    <Avatar className={cn("size-7", className)}>
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
