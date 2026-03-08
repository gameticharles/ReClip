import { useState, useRef, useEffect } from 'react';

interface PinLockProps {
    onUnlock: () => void;
}

export default function PinLock({ onUnlock }: PinLockProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isSetup, setIsSetup] = useState(false);
    const [confirmPin, setConfirmPin] = useState('');
    const [setupStage, setSetupStage] = useState<'enter' | 'confirm'>('enter');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const stored = localStorage.getItem('pinLock');
        setIsSetup(!!stored);
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const storedPin = localStorage.getItem('pinLock');

        if (!isSetup) {
            // Setup mode
            if (setupStage === 'enter') {
                if (pin.length < 4) {
                    setError('PIN must be at least 4 digits');
                    return;
                }
                setConfirmPin(pin);
                setPin('');
                setSetupStage('confirm');
                setError('');
            } else {
                if (pin !== confirmPin) {
                    setError('PINs do not match');
                    setPin('');
                    setSetupStage('enter');
                    return;
                }
                localStorage.setItem('pinLock', btoa(pin));
                onUnlock();
            }
        } else {
            // Unlock mode
            if (btoa(pin) === storedPin) {
                onUnlock();
            } else {
                setError('Incorrect PIN');
                setPin('');
            }
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--bg-app, #0f0f1a)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
        }}>
            <div style={{
                textAlign: 'center',
                maxWidth: '320px',
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
                <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>
                    {!isSetup ? (setupStage === 'enter' ? 'Set Up PIN Lock' : 'Confirm Your PIN') : 'Enter PIN'}
                </h2>
                <p style={{ margin: '0 0 24px', fontSize: '0.85rem', opacity: 0.5 }}>
                    {!isSetup
                        ? setupStage === 'enter'
                            ? 'Choose a PIN to protect your clipboard'
                            : 'Enter the same PIN again'
                        : 'Enter your PIN to unlock ReClip'
                    }
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="password"
                        value={pin}
                        onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPin(val);
                            setError('');
                        }}
                        maxLength={8}
                        placeholder="••••"
                        style={{
                            width: '150px',
                            padding: '12px',
                            fontSize: '1.5rem',
                            textAlign: 'center',
                            letterSpacing: '0.5em',
                            background: 'var(--bg-card, #1e1e2e)',
                            border: error ? '2px solid #ef4444' : '2px solid var(--border-color, rgba(128,128,128,0.2))',
                            borderRadius: '12px',
                            color: 'inherit',
                            outline: 'none',
                        }}
                    />

                    {error && (
                        <div style={{
                            color: '#ef4444',
                            fontSize: '0.8rem',
                            marginTop: '8px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginTop: '20px' }}>
                        <button
                            type="submit"
                            style={{
                                padding: '10px 32px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--accent-color, #6366f1)',
                                color: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {!isSetup ? (setupStage === 'enter' ? 'Next' : 'Set PIN') : 'Unlock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
