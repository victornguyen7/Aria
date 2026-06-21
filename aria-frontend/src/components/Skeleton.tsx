interface Props {
  className?: string;
}

export function SkeletonLine({ className = "" }: Props) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard({ className = "" }: Props) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${className}`}>
      <SkeletonLine className="h-4 w-3/4 mb-2" />
      <SkeletonLine className="h-3 w-1/2" />
    </div>
  );
}

export function BriefingSkeleton() {
  return (
    <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-full bg-gray-800 animate-pulse" />
        <SkeletonLine className="h-3 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
        <SkeletonLine className="h-4 w-4/6" />
        <SkeletonLine className="h-4 w-3/4 mt-1" />
      </div>
    </div>
  );
}

export function FocusTaskSkeleton() {
  return (
    <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5">
      <SkeletonLine className="h-3 w-24 mb-3" />
      <SkeletonLine className="h-5 w-2/3 mb-2" />
      <SkeletonLine className="h-3 w-1/2 mb-3" />
      <div className="flex gap-2">
        <SkeletonLine className="h-5 w-16 rounded-full" />
        <SkeletonLine className="h-5 w-20" />
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div className="w-5 h-5 rounded-full bg-gray-800 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <SkeletonLine className="h-4 w-3/4 mb-1" />
            <SkeletonLine className="h-3 w-1/2" />
          </div>
          <SkeletonLine className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
