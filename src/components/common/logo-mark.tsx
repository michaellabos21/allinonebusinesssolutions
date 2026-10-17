import Image from "next/image";

import mark from "@/app/icon.svg";
import { PRODUCT_NAME } from "@/config/app";

/**
 * The Kasama Space mark, drawn from the same file as the favicon (app/icon.svg).
 * It sits inside links that already name the product, so screen readers skip it;
 * the alt text is for search engines and image search.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image src={mark} alt={`${PRODUCT_NAME} logo`} aria-hidden unoptimized className={className} />
  );
}
