import { useEffect } from 'react';

interface ImageZoomModalProps {
    src: string;
    onClose: () => void;
}

export default function ImageZoomModal({ src, onClose }: ImageZoomModalProps) {
    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="image-zoom-modal"
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                cursor: 'zoom-out',
                backdropFilter: 'blur(4px)',
            }}
        >
            <img
                src={src}
                alt="Zoomed"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '95vw',
                    maxHeight: '95vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 50px rgba(0, 0, 0, 0.5)',
                    cursor: 'default',
                }}
            />
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
        </div>
    );
}
