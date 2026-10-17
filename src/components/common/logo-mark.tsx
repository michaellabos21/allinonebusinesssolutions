import Image from "next/image";

import mark from "@/app/icon.svg";

/** The Kasama Space mark, drawn from the same file as the favicon (app/icon.svg). */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={mark} alt="" aria-hidden unoptimized className={className} />;
}
