import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button, useToast } from '@/components/ui'

export function ShareLink({ joinCode, roomName }: { joinCode: string; roomName: string }) {
  const url = `${window.location.origin}/j/${joinCode}`
  const [copied, setCopied] = useState(false)
  const { error } = useToast()
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      error('Could not copy', 'Select the link and copy it manually.')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join “${roomName}” on whereto`, url })
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Invite friends</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Anyone with this link can join until voting starts.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy} className="flex-1 sm:flex-none">
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={share} className="flex-1 sm:flex-none">
              <Share2 /> Share
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
