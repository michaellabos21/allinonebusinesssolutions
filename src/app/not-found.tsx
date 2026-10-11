import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <EmptyState
        icon={Compass}
        title="That page doesn’t exist"
        description="The link may be out of date. The overview has everything that is built so far."
        action={
          <Button asChild variant="outline">
            <Link href="/">Go to overview</Link>
          </Button>
        }
        className="py-20"
      />
    </div>
  );
}
