'use client';

export function StubView({ title, note }: { title: string; note: string }) {
  return (
    <div className="stub">
      <span className="stub-title">{title}</span>
      <p className="stub-note">{note}</p>
    </div>
  );
}
