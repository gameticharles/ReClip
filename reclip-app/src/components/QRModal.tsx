import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

interface QRModalProps {
    title: string;
    content: string;
    onClose: () => void;
}

const CHUNK_SIZE = 800;

export const QRModal: React.FC<QRModalProps> = ({ title, content, onClose }) => {
    const [page, setPage] = useState(0);

    // Split content into chunks
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        chunks.push(content.slice(i, i + CHUNK_SIZE));
    }
    if (!chunks.length) chunks.push('');

    const total = chunks.length;
    const current = chunks[page] || '';
    const isMultiPage = total > 1;

    const saveQR = () => {
        const svg = document.getElementById('qr-code-svg');
        if (!svg) return;

        const data = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width + 40;
            canvas.height = img.height + 60;
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 20, 20);
                ctx.fillStyle = 'black';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(isMultiPage ? `Page ${page + 1}/${total}` : title || 'QR Code', canvas.width / 2, canvas.height - 15);
            }
            const a = document.createElement('a');
            a.download = `${(title || 'content').replace(/[^a-z0-9]/gi, '_')}_qr${isMultiPage ? `_${page + 1}` : ''}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
    };

    const btnStyle: React.CSSProperties = {
        background: 'rgba(128,128,128,0.25)',
        color: 'inherit',
        border: 'none',
        borderRadius: 8,
        padding: '10px 18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.85rem',
        fontWeight: 500,
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setPage(0);
            onClose();
        }
    };

    return (
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    padding: '28px 32px',
                    textAlign: 'center',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
                    width: '95%',
                    maxWidth: 500,
                    maxHeight: '95vh',
                    overflow: 'auto',
                    position: 'relative',
                }}
            >
                {/* Close button */}
                <button
                    onClick={() => { setPage(0); onClose(); }}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'rgba(128,128,128,0.2)',
                        border: 'none',
                        borderRadius: 8,
                        padding: 8,
                        cursor: 'pointer',
                        color: 'inherit',
                    }}
                >
                    <X size={18} />
                </button>

                {/* Title */}
                <div style={{ marginBottom: 20, fontWeight: 600, fontSize: '1.1rem' }}>
                    {title || 'QR Code'}
                </div>

                {/* QR Code */}
                {current ? (
                    <div style={{
                        background: 'white',
                        padding: 24,
                        borderRadius: 16,
                        display: 'inline-block',
                        margin: '0 auto',
                    }}>
                        <QRCodeSVG
                            id="qr-code-svg"
                            value={isMultiPage ? `[${page + 1}/${total}]${current}` : current}
                            size={280}
                            level="L"
                        />
                    </div>
                ) : (
                    <div style={{ padding: 60, opacity: 0.5, fontSize: '1rem' }}>Empty content</div>
                )}

                {/* Page Navigation */}
                {isMultiPage && (
                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            style={{
                                ...btnStyle,
                                opacity: page === 0 ? 0.4 : 1,
                                cursor: page === 0 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 70 }}>
                            {page + 1} / {total}
                        </span>
                        <button
                            disabled={page === total - 1}
                            onClick={() => setPage(p => p + 1)}
                            style={{
                                ...btnStyle,
                                opacity: page === total - 1 ? 0.4 : 1,
                                cursor: page === total - 1 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Info */}
                {isMultiPage && (
                    <div style={{
                        marginTop: 16,
                        padding: '10px 16px',
                        background: 'rgba(128,128,128,0.1)',
                        borderRadius: 10,
                        fontSize: '0.8rem',
                        opacity: 0.7,
                    }}>
                        📱 Scan all {total} QR codes in order to get the complete content
                    </div>
                )}

                <div style={{ marginTop: 12, fontSize: '0.75rem', opacity: 0.4 }}>
                    {content.length} characters total{isMultiPage ? ` • ${current.length} this page` : ''}
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                        onClick={saveQR}
                        style={{
                            ...btnStyle,
                            background: 'var(--accent-color)',
                            color: 'white',
                        }}
                    >
                        <Download size={16} /> Save {isMultiPage ? 'This Page' : 'QR Code'}
                    </button>
                    <button
                        onClick={() => { setPage(0); onClose(); }}
                        style={btnStyle}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRModal;
