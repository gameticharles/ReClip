import React, { useState, useEffect } from 'react';
import './CaptureOverlay.css';

interface CaptureOverlayProps {
    onCapture: (bounds: { x: number, y: number, width: number, height: number } | null) => void;
    onCancel: () => void;
}

const CaptureOverlay: React.FC<CaptureOverlayProps> = ({ onCapture, onCancel }) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDrawing(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setCurrentPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        setCurrentPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        const x = Math.min(startPos.x, currentPos.x);
        const y = Math.min(startPos.y, currentPos.y);
        const width = Math.abs(startPos.x - currentPos.x);
        const height = Math.abs(startPos.y - currentPos.y);

        if (width > 5 && height > 5) {
            onCapture({ x, y, width, height });
        } else {
            onCancel();
        }
    };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onCancel]);

    const rect = {
        x: Math.min(startPos.x, currentPos.x),
        y: Math.min(startPos.y, currentPos.y),
        width: Math.abs(startPos.x - currentPos.x),
        height: Math.abs(startPos.y - currentPos.y)
    };

    return (
        <div
            className="capture-overlay"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <div className="overlay-instr">
                Drag to select an area • ESC to cancel
            </div>
            {isDrawing && (
                <div
                    className="selection-box"
                    style={{
                        left: rect.x,
                        top: rect.y,
                        width: rect.width,
                        height: rect.height
                    }}
                >
                    <div className="selection-size">
                        {Math.round(rect.width)} × {Math.round(rect.height)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaptureOverlay;
