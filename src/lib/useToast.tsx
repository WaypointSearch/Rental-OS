'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react'

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'lead'

export interface Toast {
  id: string
  type: ToastType
  title: string
  body?: string
  duration?: number // ms, default 4500
}

interface ToastContextValue {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  push: () => {},
  dismiss: () => {},
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [{ ...t, id }, ...prev].slice(0, 5)) // max 5
      const duration = t.duration ?? 4500
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

// ── Visual stack ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ToastType, { bg: string; accent: string; icon: string }> = {
  success: { bg: '#1a7f3711', accent: '#3fb950', icon: '✓' },
  info:    { bg: '#0550ae11', accent: '#388bfd', icon: 'i' },
  warning: { bg: '#d2992211', accent: '#e3b341', icon: '!' },
  error:   { bg: '#e24b4a11', accent: '#e24b4a', icon: '✕' },
  lead:    { bg: '#a371f711', accent: '#a371f7', icon: '◈' },
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 56,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        width: 'min(380px, calc(100vw - 2rem))',
      }}
    >
      {toasts.map((t) => {
        const col = TYPE_COLORS[t.type]
        return (
          <div
            key={t.id}
            style={{
              background: 'var(--sf, #fff)',
              border: `0.5px solid ${col.accent}44`,
              borderLeft: `3px solid ${col.accent}`,
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              pointerEvents: 'all',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
              animation: 'slideUp .2s ease',
            }}
            onClick={() => onDismiss(t.id)}
          >
            {/* Icon dot */}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: col.bg,
                color: col.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {col.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--tx, #1f2328)',
                  marginBottom: t.body ? 2 : 0,
                }}
              >
                {t.title}
              </div>
              {t.body && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--mt, #636c76)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t.body}
                </div>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(t.id) }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--mt, #636c76)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )
      })}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
