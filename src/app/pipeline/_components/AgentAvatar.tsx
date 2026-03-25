'use client'

import { useState, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'

interface AgentAvatarProps {
  userId: string
  email: string
  size?: number
  existingUrl?: string | null
  readOnly?: boolean
  onUploaded?: (url: string) => void
}

function initials(email: string): string {
  return email.split('@')[0].split(/[._-]/).map((s) => s[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

export function AgentAvatar({ userId, email, size = 32, existingUrl, readOnly = false, onUploaded }: AgentAvatarProps) {
  const supabase = getSupabase()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existingUrl ?? null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || readOnly) return
    setUploading(true)
    const path = `avatars/${userId}.jpg`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setAvatarUrl(url)
      onUploaded?.(url)
    }
    setUploading(false)
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        onClick={() => !readOnly && fileRef.current?.click()}
        title={readOnly ? email : 'Click to change photo'}
        style={{
          width: size, height: size, borderRadius: '50%',
          background: avatarUrl ? 'transparent' : '#0550ae22',
          color: '#4d9fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.32, fontWeight: 600,
          cursor: readOnly ? 'default' : 'pointer',
          overflow: 'hidden',
          border: '0.5px solid rgba(77,159,255,0.25)',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : uploading ? (
          <span style={{ fontSize: size * 0.28 }}>…</span>
        ) : (
          initials(email)
        )}
      </div>
      {!readOnly && (
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      )}
    </div>
  )
}
