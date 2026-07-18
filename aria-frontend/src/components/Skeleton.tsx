import type { CSSProperties } from "react";

interface Props {
  className?: string;
  style?: CSSProperties;
}

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
};

export function SkeletonLine({ className = "", style }: Props) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", height: 12, ...style }}
    />
  );
}

export function SkeletonCard({ className = "" }: Props) {
  return (
    <div className={className} style={{ ...card, padding: 16 }}>
      <SkeletonLine style={{ width: "75%", height: 16, marginBottom: 8 }} />
      <SkeletonLine style={{ width: "50%", height: 12 }} />
    </div>
  );
}

export function BriefingSkeleton() {
  return (
    <div style={{ ...card, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 16 }}>
        <div className="animate-pulse" style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", background: "var(--surface-2)" }} />
        <SkeletonLine style={{ width: 128, height: 12 }} />
      </div>
      <div className="flex flex-col" style={{ gap: 8 }}>
        <SkeletonLine style={{ width: "100%", height: 16 }} />
        <SkeletonLine style={{ width: "85%", height: 16 }} />
        <SkeletonLine style={{ width: "65%", height: 16 }} />
        <SkeletonLine style={{ width: "75%", height: 16, marginTop: 4 }} />
      </div>
    </div>
  );
}

export function FocusTaskSkeleton() {
  return (
    <div style={{ ...card, padding: 20 }}>
      <SkeletonLine style={{ width: 96, height: 12, marginBottom: 12 }} />
      <SkeletonLine style={{ width: "65%", height: 20, marginBottom: 8 }} />
      <SkeletonLine style={{ width: "50%", height: 12, marginBottom: 12 }} />
      <div className="flex" style={{ gap: 8 }}>
        <SkeletonLine style={{ width: 64, height: 20 }} />
        <SkeletonLine style={{ width: 80, height: 20 }} />
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center"
          style={{ ...card, borderRadius: "var(--radius-md)", padding: "12px 16px", gap: 12 }}
        >
          <div className="animate-pulse flex-shrink-0" style={{ width: 20, height: 20, borderRadius: "9999px", background: "var(--surface-2)" }} />
          <div className="flex-1">
            <SkeletonLine style={{ width: "75%", height: 16, marginBottom: 4 }} />
            <SkeletonLine style={{ width: "50%", height: 12 }} />
          </div>
          <SkeletonLine style={{ width: 64, height: 20 }} />
        </div>
      ))}
    </div>
  );
}
