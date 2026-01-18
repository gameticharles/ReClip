import { useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ClipContentProps {
    content: string;
    type: string;
    isCompact: boolean;
}

const detectLanguage = (code: string): string | null => {
    const trimmed = code.trim();

    if (trimmed.startsWith('<') && trimmed.includes('>')) return 'html';
    if (trimmed.includes('import ') && trimmed.includes('from ')) return 'typescript';
    if (trimmed.includes('function ') || trimmed.includes('const ') || trimmed.includes('=>')) return 'javascript';
    if (trimmed.includes('class ') && trimmed.includes('{')) return 'java'; // or other OOP
    if (trimmed.includes('fn ') && trimmed.includes('let ')) return 'rust';
    if (trimmed.includes('def ') && trimmed.includes(':')) return 'python';
    if (trimmed.includes('SELECT ') && trimmed.includes('FROM ')) return 'sql';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            JSON.parse(trimmed);
            return 'json';
        } catch { /* ignore */ }
    }
    if (trimmed.includes('body {') || trimmed.includes('color:')) return 'css';

    return null;
};

export default function ClipContent({ content, type, isCompact }: ClipContentProps) {
    const [validity, setValidity] = useState<{ checked: boolean, valid: boolean, invalidPaths: string[] }>({ checked: false, valid: true, invalidPaths: [] });

    // Handle Files
    if (type === 'files') {
        let files: string[] = [];
        try {
            files = JSON.parse(content);
        } catch {
            files = ["Invalid file data"];
        }

        const handleMouseEnter = async () => {
            if (validity.checked) return;
            try {
                // Return tuple [path, exists, is_dir]
                const results = await invoke<[string, boolean, boolean][]>('validate_paths', { content });
                const invalid = results.filter(([_, exists]) => !exists).map(([path]) => path);
                setValidity({ checked: true, valid: invalid.length === 0, invalidPaths: invalid });
            } catch (e) {
                console.error("Validation failed", e);
            }
        };

        return (
            <div
                className="clip-files"
                onMouseEnter={handleMouseEnter}
                style={{ fontSize: '0.9rem', color: '#e5e5e5' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                    <span style={{ fontWeight: 600 }}>{files.length} File{files.length !== 1 ? 's' : ''}</span>
                    {validity.checked && !validity.valid && (
                        <span title={`Missing: ${validity.invalidPaths.join(', ')}`} style={{ color: '#ef4444', background: 'rgba(239,68,68,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            ⚠️ Missing
                        </span>
                    )}
                </div>
                {!isCompact && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0.8, fontSize: '0.8rem' }}>
                        {files.slice(0, 3).map((f, i) => (
                            <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {f}
                            </div>
                        ))}
                        {files.length > 3 && <div style={{ opacity: 0.5 }}>+ {files.length - 3} more</div>}
                    </div>
                )}
            </div>
        );
    }

    // Handle Image
    if (type === 'image') {
        const [extractedText, setExtractedText] = useState<string | null>(null);
        const [isExtracting, setIsExtracting] = useState(false);

        const handleOCR = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (extractedText) {
                // Return to image
                setExtractedText(null);
                return;
            }

            setIsExtracting(true);
            try {
                const text = await invoke<string>('run_ocr', { path: content });
                if (text) {
                    setExtractedText(text);
                } else {
                    alert("No text found in image");
                }
            } catch (err) {
                console.error("OCR Failed", err);
                alert("OCR Failed: " + err);
            } finally {
                setIsExtracting(false);
            }
        };

        const copyExtracted = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (extractedText) {
                invoke('copy_to_system', { content: extractedText });
                alert("Text copied!");
            }
        };

        const src = convertFileSrc(content);
        return (
            <div className="clip-image" style={{ height: isCompact ? '40px' : '150px', overflow: 'hidden', borderRadius: '4px', position: 'relative', background: '#000' }}>
                {!extractedText ? (
                    <>
                        <img src={src} alt="Clip" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <button
                            onClick={handleOCR}
                            className="ocr-btn"
                            style={{
                                position: 'absolute',
                                bottom: '4px',
                                right: '4px',
                                background: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                backdropFilter: 'blur(4px)',
                                display: isCompact ? 'none' : 'block'
                            }}
                        >
                            {isExtracting ? 'Scanning...' : 'Extract Text (OCR)'}
                        </button>
                    </>
                ) : (
                    <div style={{ padding: '8px', height: '100%', overflow: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#fff', background: '#222' }}>
                        {extractedText}
                        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                            <button onClick={copyExtracted} className="text-xs bg-accent text-white px-2 py-1 rounded">Copy</button>
                            <button onClick={handleOCR} className="text-xs bg-white/10 text-white px-2 py-1 rounded">X</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const language = detectLanguage(content);

    // Don't highlight in compact mode or purely single words (usually)
    if (!isCompact && language && content.length > 20 && content.includes('\n')) {
        return (
            <div className="clip-code" onClick={e => e.stopPropagation()}>
                <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: '8px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(30, 30, 30, 0.9)'
                    }}
                    wrapLongLines={true}
                >
                    {content}
                </SyntaxHighlighter>
                <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '0.6rem',
                    color: 'rgba(255,255,255,0.4)',
                    pointerEvents: 'none'
                }}>
                    {language}
                </div>
            </div>
        );
    }

    return (
        <div className="clip-content" title={content}>
            {content}
        </div>
    );
}
