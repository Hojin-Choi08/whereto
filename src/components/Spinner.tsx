export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      {label}
    </div>
  )
}
