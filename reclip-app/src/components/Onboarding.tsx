import { useState } from 'react';

interface OnboardingProps {
    onComplete: () => void;
}

const steps = [
    {
        icon: '📋',
        title: 'Welcome to ReClip!',
        description: 'Your advanced clipboard manager. Everything you copy is automatically saved and organized.',
    },
    {
        icon: '⌨️',
        title: 'Quick Paste',
        description: 'Use Ctrl+1 through Ctrl+9 to paste recent clips instantly. Arrow keys navigate the clip list, Enter to paste.',
    },
    {
        icon: '🔍',
        title: 'Global Search',
        description: 'Press Ctrl+K to search across clips, snippets, and notes all at once.',
    },
    {
        icon: '✂️',
        title: 'Snippets & Notes',
        description: 'Save frequently used text as snippets. Organize notes and reminders in the Organizer tab.',
    },
    {
        icon: '🎨',
        title: 'Color Tools',
        description: 'Analyze colors, create palettes, check accessibility — all built directly into the app.',
    },
    {
        icon: '🔐',
        title: 'Privacy First',
        description: 'Sensitive content is auto-detected and deleted. Use Incognito Mode to pause capture entirely.',
    },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [exiting, setExiting] = useState(false);

    const isLast = currentStep === steps.length - 1;
    const step = steps[currentStep];

    const handleComplete = () => {
        setExiting(true);
        setTimeout(() => {
            localStorage.setItem('onboardingComplete', 'true');
            onComplete();
        }, 300);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: exiting ? 0 : 1,
            transition: 'opacity 0.3s ease',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'var(--bg-card, #1e1e2e)',
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
                textAlign: 'center',
            }}>
                {/* Step indicator dots */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: '24px',
                }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{
                            width: i === currentStep ? '20px' : '6px',
                            height: '6px',
                            borderRadius: '3px',
                            background: i === currentStep
                                ? 'var(--accent-color, #6366f1)'
                                : 'rgba(128,128,128,0.3)',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>

                {/* Icon */}
                <div style={{
                    fontSize: '3rem',
                    marginBottom: '16px',
                }}>
                    {step.icon}
                </div>

                {/* Title */}
                <h2 style={{
                    margin: '0 0 12px',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                }}>
                    {step.title}
                </h2>

                {/* Description */}
                <p style={{
                    margin: '0 0 28px',
                    fontSize: '0.9rem',
                    opacity: 0.7,
                    lineHeight: 1.5,
                }}>
                    {step.description}
                </p>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'center',
                }}>
                    {currentStep > 0 && (
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            style={{
                                padding: '8px 20px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color, rgba(128,128,128,0.3))',
                                background: 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                            }}
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={isLast ? handleComplete : () => setCurrentStep(prev => prev + 1)}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--accent-color, #6366f1)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                        }}
                    >
                        {isLast ? 'Get Started' : 'Next'}
                    </button>
                </div>

                {/* Skip */}
                {!isLast && (
                    <button
                        onClick={handleComplete}
                        style={{
                            marginTop: '16px',
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            opacity: 0.4,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                        }}
                    >
                        Skip tour
                    </button>
                )}
            </div>
        </div>
    );
}
