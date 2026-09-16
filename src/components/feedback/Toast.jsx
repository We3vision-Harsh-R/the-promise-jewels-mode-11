import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { classNames } from '@/utils/helpers.js'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback(
    (message, { tone = 'success', duration = 3200 } = {}) => {
      const id = ++idRef.current
      setToasts((t) => [...t, { id, message, tone }])
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 w-[calc(100%-2.5rem)] max-w-sm">
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ message, tone, onDismiss }) {
  const ref = useRef(null)
  const enter = useCallback((node) => {
    ref.current = node
    if (node) gsap.fromTo(node, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out' })
  }, [])

  const Icon = tone === 'error' ? AlertCircle : CheckCircle2

  return (
    <div
      ref={enter}
      className={classNames(
        'flex items-center gap-3 rounded-md border bg-white px-4 py-3 shadow-card',
        tone === 'error' ? 'border-rose/30' : 'border-emerald/20'
      )}
    >
      <Icon size={18} className={tone === 'error' ? 'text-rose' : 'text-emerald'} />
      <p className="flex-1 text-sm text-ink-800">{message}</p>
      <button onClick={onDismiss} className="text-ink-400 hover:text-ink-900">
        <X size={15} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
