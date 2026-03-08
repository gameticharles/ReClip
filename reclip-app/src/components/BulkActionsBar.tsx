import React from 'react';

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
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount, queuePendingCount, queueMode,
    onBulkPaste, onShowMergeDialog, onBulkDelete, onCancelSelection,
    onPasteNextInQueue, onClearQueue
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
                    <button onClick={onBulkDelete} title="Delete selected clips">Delete</button>
                    <button onClick={onCancelSelection}>Cancel</button>
                </div>
            </div>
        );
    }

    return null;
};
