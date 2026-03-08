import React from 'react';

interface MergeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMerge: () => void;
    selectedCount: number;
    mergeSeparator: string;
    setMergeSeparator: (val: string) => void;
}

export const MergeDialog: React.FC<MergeDialogProps> = ({
    isOpen, onClose, onMerge, selectedCount,
    mergeSeparator, setMergeSeparator
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card, #1e1e2e)', borderRadius: '12px',
                padding: '20px', minWidth: '300px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Merge {selectedCount} Clips</h3>
                <label style={{ fontSize: '0.85rem', opacity: 0.7 }}>Separator:</label>
                <select
                    value={mergeSeparator}
                    onChange={e => setMergeSeparator(e.target.value)}
                    style={{
                        width: '100%', padding: '8px', marginTop: '4px', marginBottom: '12px',
                        borderRadius: '6px', border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
                        background: 'var(--bg-input, var(--bg-app))', color: 'inherit',
                    }}
                >
                    <option value="\n">New Line</option>
                    <option value=" ">Space</option>
                    <option value=", ">Comma</option>
                    <option value=" | ">Pipe</option>
                    <option value="\n---\n">Separator (---)</option>
                </select>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border-color)',
                        background: 'transparent', color: 'inherit', cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={onMerge} style={{
                        padding: '6px 16px', borderRadius: '6px', border: 'none',
                        background: 'var(--accent-color, #6366f1)', color: '#fff', cursor: 'pointer',
                    }}>Merge</button>
                </div>
            </div>
        </div>
    );
};
