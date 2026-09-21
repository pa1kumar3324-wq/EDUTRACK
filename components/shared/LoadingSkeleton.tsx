import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StudentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatStripSkeleton() {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
