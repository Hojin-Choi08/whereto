import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui'

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">Where to?</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start a room, share the link, and everyone adds what they&apos;re in the mood for. Then pick a café together.
      </p>
      <Link to="/new" className={buttonVariants({ size: 'lg' })}>Start a room</Link>
      <p className="text-xs text-muted-foreground">Got an invite link? Just open it to join.</p>
    </div>
  )
}
