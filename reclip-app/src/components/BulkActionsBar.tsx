import React from 'react';
import './BulkActionsBar.css';

interface BulkActionsBarProps {
    selectedCount: number;
    queuePendingCount: number;
    queueMode: boolean;
    onBulkPaste: () => void;
    onShowMergeDialog: () => void;
    onBulkDelete: () => void;
    onCancelSelection: () => void;
    onPasteNextInQueue: () => void;
    onClearQueue: () => void;
    onBulkTransform: (type: 'upper' | 'lower' | 'title' | 'trim') => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount, queuePendingCount, queueMode,
    onBulkPaste, onShowMergeDialog, onBulkDelete, onCancelSelection,
    onPasteNextInQueue, onClearQueue, onBulkTransform
}) => {
    if (queueMode && queuePendingCount > 0) {
        return (
            <div className="bulk-actions-bar" style={{ background: 'rgba(16, 185, 129, 0.95)' }}>
                <div className="bulk-info">Queue: {queuePendingCount} items</div>
                <div className="bulk-buttons">
                    <button onClick={onPasteNextInQueue} title="Paste the first item and remove it">Paste Next</button>
                    <button onClick={onClearQueue}>Clear</button>
                </div>
            </div>
        );
    }

    if (!queueMode && selectedCount > 0) {
        return (
            <div className="bulk-actions-bar">
                <div className="bulk-info"> {selectedCount} selected </div>
                <div className="bulk-buttons">
                    <button onClick={onBulkPaste} title="Join and paste selected clips">Merge & Paste</button>
                    <button onClick={onShowMergeDialog} title="Copy merged clips to clipboard">Merge to Clipboard</button>

                    <div className="bulk-transform-group" style={{ display: 'flex', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '8px', marginLeft: '4px' }}>
                        <button onClick={() => onBulkTransform('upper')} title="UPPERCASE selected text clips" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>TT</button>
                        <button onClick={() => onBulkTransform('lower')} title="lowercase selected text clips" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>tt</button>
                        <button onClick={() => onBulkTransform('title')} title="Title Case selected text clips" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Tt</button>
                        <button onClick={() => onBulkTransform('trim')} title="Trim whitespace on selected text clips" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Tr</button>
                    </div>

                    <button onClick={onBulkDelete} title="Delete selected clips" style={{ marginLeft: 'auto' }}>Delete</button>
                    <button onClick={onCancelSelection}>Cancel</button>
                </div>
            </div>
        );
    }

    return null;
};
