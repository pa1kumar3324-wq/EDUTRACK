import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-secondary via-secondary/50 to-secondary bg-[length:700px_100%]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
