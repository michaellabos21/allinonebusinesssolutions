import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/config/app";

/** Frame for the signed-out pages and first-run setup: one centred card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="font-display text-lg font-semibold">{PRODUCT_NAME}</p>
        <p className="text-caption text-muted-foreground">{PRODUCT_TAGLINE}</p>
        <main className="mt-6 rounded-lg border bg-card px-5 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
