import { useState, useEffect, useCallback } from 'react';

interface Toast {
    id: string;
    message: string;
    action?: { label: string; onClick: () => void };
    duration?: number;
}

interface ToastContainerProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
        }}>
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const [progress, setProgress] = useState(100);
    const duration = toast.duration || 5000;

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                const next = prev - (100 / (duration / 50));
                if (next <= 0) {
                    clearInterval(interval);
                    onDismiss(toast.id);
                    return 0;
                }
                return next;
            });
        }, 50);
        return () => clearInterval(interval);
    }, [toast.id, duration, onDismiss]);

    return (
        <div style={{
            background: 'var(--bg-card, #1e1e2e)',
            border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
            borderRadius: '12px',
            padding: '10px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '250px',
            maxWidth: '400px',
            overflow: 'hidden',
            position: 'relative',
        }}>
            <span style={{ fontSize: '0.85rem', flex: 1 }}>{toast.message}</span>
            {toast.action && (
                <button
                    onClick={() => {
                        toast.action!.onClick();
                        onDismiss(toast.id);
                    }}
                    style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--accent-color, #6366f1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {toast.action.label}
                </button>
            )}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                width: `${progress}%`,
                background: 'var(--accent-color, #6366f1)',
                transition: 'width 0.05s linear',
                borderRadius: '0 0 12px 12px',
            }} />
        </div>
    );
}

// Hook for managing toasts
export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, options?: { action?: Toast['action']; duration?: number }) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, ...options }]);
        return id;
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, dismissToast };
}
