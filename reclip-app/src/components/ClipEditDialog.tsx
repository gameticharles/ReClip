import React, { useState, useEffect } from 'react';

interface ClipEditDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newContent: string) => Promise<void>;
    initialContent: string;
    isDark?: boolean;
}

const ClipEditDialog: React.FC<ClipEditDialogProps> = ({ isOpen, onClose, onSave, initialContent }) => {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setContent(initialContent);
    }, [initialContent, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(content);
            onClose();
        } catch (error) {
            console.error('Failed to save clip content:', error);
            // Optionally show error toast
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-card)',
                width: '80%',
                maxWidth: '800px',
                height: '80%',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                    }}>Edit Clip Content</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{
                    flex: 1,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        style={{
                            flex: 1,
                            width: '100%',
                            padding: '16px',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            resize: 'none',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            lineHeight: '1.5',
                            outline: 'none'
                        }}
                        autoFocus
                        spellCheck={false}
                    />
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="primary-btn"
                        style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: isSaving ? 'wait' : 'pointer',
                            fontWeight: 500,
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClipEditDialog;
