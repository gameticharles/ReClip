import { useState, useEffect, useRef, useCallback } from 'react';

interface ImageZoomModalProps {
    src: string;
    onClose: () => void;
}

export default function ImageZoomModal({ src, onClose }: ImageZoomModalProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on Escape, reset on 0
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '0') { setScale(1); setPosition({ x: 0, y: 0 }); }
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(s * 1.25, 5));
            if (e.key === '-') setScale(s => Math.max(s / 1.25, 0.5));
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Panning & Zoom handlers
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Continuous scaling factor
                const zoomFactor = -e.deltaY * 0.005;
                const delta = 1 + zoomFactor;
                const newScale = Math.min(Math.max(0.1, scale * delta), 10);

                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const rect = container.getBoundingClientRect();
                const viewX = mouseX - rect.left;
                const viewY = mouseY - rect.top;

                const canvasX = (viewX - position.x) / scale;
                const canvasY = (viewY - position.y) / scale;

                setScale(newScale);
                setPosition({ x: viewX - canvasX * newScale, y: viewY - canvasY * newScale });
            } else {
                setPosition(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [scale, position]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }, [position]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
    const zoomIn = () => setScale(s => Math.min(s * 1.5, 10));
    const zoomOut = () => setScale(s => Math.max(s / 1.5, 0.1));

    return (
        <div
            ref={containerRef}
            className="image-zoom-modal"
            onClick={(e) => e.target === containerRef.current && onClose()}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'default'),
                backdropFilter: 'blur(8px)',
                overflow: 'hidden',
                userSelect: 'none'
            }}
        >
            <img
                src={src}
                alt="Zoomed"
                draggable={false}
                onMouseDown={handleMouseDown}
                style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
                    cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'zoom-in'),
                }}
            />

            {/* Zoom Controls */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                background: 'rgba(0,0,0,0.6)',
                padding: '8px 16px',
                borderRadius: '24px',
            }}>
                <button onClick={zoomOut} style={btnStyle} title="Zoom Out (-)">−</button>
                <button onClick={resetView} style={{ ...btnStyle, fontSize: '0.75rem', minWidth: '50px' }} title="Reset (0)">
                    {Math.round(scale * 100)}%
                </button>
                <button onClick={zoomIn} style={btnStyle} title="Zoom In (+)">+</button>
            </div>

            {/* Close Button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
                ✕
            </button>

            {/* Help hint */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.7rem',
            }}>
                Scroll to zoom • Drag to pan • Press 0 to reset
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
