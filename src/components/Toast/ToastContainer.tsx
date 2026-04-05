import { useToastStore } from '../../store/toastStore'

const matIcons: Record<string, string> = {
  success: 'check_circle',
  error:   'error',
  info:    'info',
  warning: 'warning',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="mat mat-sm" style={{ flexShrink: 0, marginTop: 1 }}>{matIcons[t.type] ?? 'info'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="toast-title">{t.title}</div>
            {t.message && <div className="toast-body">{t.message}</div>}
          </div>
          <button className="toast-close" onClick={() => removeToast(t.id)}>
            <span className="mat mat-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}
