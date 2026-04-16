'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { AgwsAgent } from '@prisma/client'

interface AgentFormProps {
  agent?: AgwsAgent | null
  open: boolean
  onClose: () => void
}

export function AgentForm({ agent, open, onClose }: AgentFormProps) {
  const router = useRouter()
  const isEditing = !!agent

  const [form, setForm] = useState({
    name: agent?.name ?? '',
    slug: agent?.slug ?? '',
    description: agent?.description ?? '',
    shortTagline: agent?.shortTagline ?? '',
    brandColor: agent?.brandColor ?? '#7c3aed',
    adapterType: agent?.adapterType ?? 'openclaw',
    adapterConfig: agent?.adapterConfig
      ? JSON.stringify(agent.adapterConfig, null, 2)
      : '{\n  "gatewayUrl": "",\n  "authToken": ""\n}',
    capabilities: agent?.capabilities.join(', ') ?? '',
    ownerTeam: agent?.ownerTeam ?? '',
    sortOrder: String(agent?.sortOrder ?? 0),
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async () => {
    setError(null)

    let adapterConfigParsed: Record<string, unknown> | undefined
    if (form.adapterConfig.trim()) {
      try {
        adapterConfigParsed = JSON.parse(form.adapterConfig)
      } catch {
        setError('Adapter config is not valid JSON')
        return
      }
    }

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      shortTagline: form.shortTagline.trim() || undefined,
      brandColor: form.brandColor.trim() || undefined,
      adapterType: form.adapterType,
      adapterConfig: adapterConfigParsed,
      capabilities: form.capabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      ownerTeam: form.ownerTeam.trim() || undefined,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    }

    setIsSaving(true)
    try {
      const url = isEditing ? `/api/admin/agents/${agent!.id}` : '/api/admin/agents'
      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? `Request failed with status ${res.status}`)
        return
      }

      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${agent!.name}` : 'Add Agent'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="Friday" />
          </div>
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input value={form.slug} onChange={set('slug')} placeholder="friday" />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Tagline</Label>
            <Input value={form.shortTagline} onChange={set('shortTagline')} placeholder="Marketing AI" />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={set('description')} placeholder="What this agent does..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Brand Color</Label>
            <div className="flex gap-2">
              <Input
                value={form.brandColor}
                onChange={set('brandColor')}
                placeholder="#7c3aed"
                className="flex-1"
              />
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => setForm((p) => ({ ...p, brandColor: e.target.value }))}
                className="h-9 w-9 rounded border border-white/10 bg-transparent cursor-pointer p-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adapter Type *</Label>
            <Select
              value={form.adapterType}
              onValueChange={(v) => setForm((p) => ({ ...p, adapterType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openclaw">OpenClaw</SelectItem>
                <SelectItem value="mock">Mock (dev)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Adapter Config (JSON)</Label>
            <Textarea
              value={form.adapterConfig}
              onChange={set('adapterConfig')}
              rows={5}
              className="font-mono text-xs"
              placeholder='{"gatewayUrl": "...", "authToken": "..."}'
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Capabilities (comma-separated)</Label>
            <Input
              value={form.capabilities}
              onChange={set('capabilities')}
              placeholder="marketing, content, email"
            />
          </div>

          <div className="space-y-2">
            <Label>Owner Team</Label>
            <Input value={form.ownerTeam} onChange={set('ownerTeam')} placeholder="Marketing" />
          </div>

          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Input type="number" value={form.sortOrder} onChange={set('sortOrder')} placeholder="0" />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !form.name || !form.slug}>
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
