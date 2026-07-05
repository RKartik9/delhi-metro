"use client";

/** Static key explaining station glyphs and layout categories. */
export default function Legend() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ui-faint)]">
        Legend
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[var(--ui-muted)]">
        <Item swatch={<Dot ring />}>Interchange</Item>
        <Item swatch={<Dot />}>Station</Item>
        <Item swatch={<Bar className="bg-sky-400" />}>Elevated</Item>
        <Item swatch={<Bar className="bg-amber-400" />}>At grade</Item>
        <Item swatch={<Bar className="bg-fuchsia-400" />}>Underground</Item>
      </div>
    </div>
  );
}

function Item({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {swatch}
      <span className="truncate">{children}</span>
    </div>
  );
}

function Dot({ ring = false }: { ring?: boolean }) {
  return (
    <span className="relative grid h-3 w-3 shrink-0 place-items-center">
      <span className="h-2 w-2 rounded-full bg-white" />
      {ring && (
        <span className="absolute inset-0 rounded-full border border-white/70" />
      )}
    </span>
  );
}

function Bar({ className }: { className: string }) {
  return <span className={`h-1.5 w-3 shrink-0 rounded-full ${className}`} />;
}
