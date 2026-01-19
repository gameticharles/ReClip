import { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';


interface ClipContentProps {
    content: string;
    type: string;
    isCompact: boolean;
    showRaw?: boolean;
    isDark?: boolean;
    isExtracting?: boolean;
    onZoom?: (src: string) => void;
}

// ============= CONTENT TYPE DETECTION =============

type ContentType = 'html' | 'markdown' | 'json' | 'diff' | 'latex' | 'table' | 'email' | 'phone' | 'code' | 'text';

const isHTML = (content: string): boolean => {
    const trimmed = content.trim();
    if (!trimmed.startsWith('<')) return false;
    const htmlTags = /<(html|head|body|div|span|p|h[1-6]|ul|ol|li|table|tr|td|th|form|input|button|a|img|br|hr|strong|em|b|i|u|script|style|link|meta)[^>]*>/i;
    return htmlTags.test(trimmed);
};

const isMarkdown = (content: string): boolean => {
    // Strong signals (Instant match)
    const strongPatterns = [
        { name: 'header', regex: /^#{1,6}\s+.+$/m },  // Headers at line start
        { name: 'codeblock', regex: /```[\s\S]*?```/ }, // Code blocks
        { name: 'hr', regex: /^[-*_]{3,}\s*$/m },      // Horizontal rules
        { name: 'table', regex: /^\|.+\|.+\|$/m },     // Tables
    ];

    for (const p of strongPatterns) {
        if (p.regex.test(content)) {
            console.log('[Markdown] Matched strong pattern:', p.name);
            return true;
        }
    }

    // Weak signals (Need 2 matches)
    const weakPatterns = [
        { name: 'bold', regex: /\*\*[^*]+\*\*/ },
        { name: 'italic', regex: /(?<!\*)\*[^*]+\*(?!\*)/ },
        { name: 'unordered', regex: /^[-*+]\s+/m },
        { name: 'ordered', regex: /^\d+\.\s+/m },
        { name: 'blockquote', regex: /^>\s+/m },
        { name: 'inlinecode', regex: /`[^`]+`/ },
        { name: 'link', regex: /\[([^\]]+)\]\([^)]+\)/ },
        { name: 'image', regex: /!\[([^\]]*)\]\([^)]+\)/ },
        { name: 'checkbox', regex: /^\[[ x]\]/m },
    ];

    let matches = 0;
    const matched: string[] = [];
    for (const p of weakPatterns) {
        if (p.regex.test(content)) {
            matches++;
            matched.push(p.name);
        }
        if (matches >= 2) {
            console.log('[Markdown] Matched weak patterns:', matched);
            return true;
        }
    }

    console.log('[Markdown] Not detected. Weak matches:', matched);
    return false;
};

const isJSON = (content: string): boolean => {
    const trimmed = content.trim();
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false;
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
};

const isDiff = (content: string): boolean => {
    const trimmed = content.trim();
    return (
        trimmed.startsWith('diff --git') ||
        trimmed.startsWith('--- ') ||
        /^@@\s*-\d+,?\d*\s*\+\d+,?\d*\s*@@/m.test(trimmed) ||
        (/^\+[^+]/m.test(trimmed) && /^-[^-]/m.test(trimmed))
    );
};

const isLaTeX = (content: string): boolean => {
    return /\$\$.+?\$\$/s.test(content) || /\$[^$\n]+\$/g.test(content);
};

const isTableData = (content: string): boolean => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false;

    // Check for tab-separated
    const tabCounts = lines.slice(0, 3).map(l => (l.match(/\t/g) || []).length);
    if (tabCounts[0] > 0 && tabCounts.every(c => c === tabCounts[0])) return true;

    // Check for comma-separated (simple CSV)
    const commaCounts = lines.slice(0, 3).map(l => (l.match(/,/g) || []).length);
    if (commaCounts[0] > 0 && commaCounts.every(c => c === commaCounts[0])) return true;

    return false;
};

const isEmail = (content: string): boolean => {
    const trimmed = content.trim();
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
};

const isPhone = (content: string): boolean => {
    const trimmed = content.trim().replace(/\s+/g, '');
    return /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,}$/.test(trimmed);
};

const detectLanguage = (code: string): string | null => {
    const trimmed = code.trim();

    // More comprehensive language detection
    if (trimmed.startsWith('<!DOCTYPE') || (trimmed.startsWith('<') && trimmed.includes('>'))) return 'html';
    if (trimmed.includes('import ') && trimmed.includes('from ')) return 'typescript';
    if (/^(const|let|var|function|class|export|import)\s/.test(trimmed) || trimmed.includes('=>')) return 'javascript';
    if (trimmed.includes('fn ') && (trimmed.includes('let ') || trimmed.includes('mut '))) return 'rust';
    if (trimmed.includes('def ') && trimmed.includes(':') && !trimmed.includes('{')) return 'python';
    if (/^(public|private|protected|class|interface|package)\s/.test(trimmed)) return 'java';
    if (trimmed.includes('#include') || trimmed.includes('int main(')) return 'c';
    if (trimmed.includes('using namespace') || trimmed.includes('std::')) return 'cpp';
    if (trimmed.includes('<?php')) return 'php';
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/i.test(trimmed)) return 'sql';
    if (trimmed.startsWith('---') && trimmed.includes(':')) return 'yaml';
    if (trimmed.startsWith('[') && trimmed.includes('=')) return 'ini';
    if (trimmed.includes('body {') || /[.#][a-zA-Z][\w-]*\s*\{/.test(trimmed)) return 'css';
    if (trimmed.includes('@mixin') || trimmed.includes('$')) return 'scss';
    if (/^#!\s*\//.test(trimmed)) return 'bash';
    if (trimmed.includes('func ') && trimmed.includes('go')) return 'go';
    if (trimmed.includes('fun ') && trimmed.includes('val ')) return 'kotlin';
    if (trimmed.includes('func ') && trimmed.includes('var ')) return 'swift';

    // JSON check
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { JSON.parse(trimmed); return 'json'; } catch { /* not JSON */ }
    }

    return null;
};

const detectContentType = (content: string, type: string): ContentType => {
    if (type !== 'text') return 'text';

    if (isHTML(content)) return 'html';
    if (isDiff(content)) return 'diff';
    if (isJSON(content)) return 'json';
    if (isLaTeX(content)) return 'latex';
    if (isMarkdown(content)) return 'markdown';
    if (isTableData(content)) return 'table';
    if (isEmail(content)) return 'email';
    if (isPhone(content)) return 'phone';
    if (detectLanguage(content)) return 'code';

    return 'text';
};

// ============= RENDER COMPONENTS =============

const HTMLPreview: React.FC<{ content: string; isCompact: boolean }> = ({ content, isCompact }) => {
    // Configure DOMPurify hooks once or on render (it's globally scoped usually, but benign here)
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'IMG') {
            node.setAttribute('loading', 'lazy');
        }
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    const sanitized = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'blockquote', 'code', 'pre', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height', 'loading'],
    });

    return (
        <div
            className="clip-html-preview"
            style={{
                maxHeight: isCompact ? '60px' : '200px',
                overflow: 'hidden',
                fontSize: '0.9rem',
                lineHeight: 1.5
            }}
            dangerouslySetInnerHTML={{ __html: sanitized }}
        />
    );
};

const MarkdownPreview: React.FC<{ content: string; isCompact: boolean }> = ({ content, isCompact }) => {
    return (
        <div
            className="clip-markdown"
            style={{
                maxHeight: isCompact ? '60px' : '300px',
                overflow: 'hidden',
                fontSize: '0.9rem',
                lineHeight: 1.6
            }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    img: (props) => <img {...props} loading="lazy" style={{ maxWidth: '100%' }} />
                }}
            >
                {isCompact ? content.slice(0, 200) : content}
            </ReactMarkdown>
        </div>
    );
};

const JSONPreview: React.FC<{ content: string; isCompact: boolean; isDark: boolean }> = ({ content, isCompact, isDark }) => {
    const [expanded, setExpanded] = useState(false);

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return <div>{content}</div>;
    }

    const formatted = JSON.stringify(parsed, null, 2);
    const lines = formatted.split('\n');
    const displayLines = isCompact ? lines.slice(0, 3) : (expanded ? lines : lines.slice(0, 15));

    return (
        <div className="clip-json" style={{ position: 'relative' }}>
            <pre style={{
                margin: 0,
                fontSize: '0.8rem',
                overflow: 'hidden',
                background: isDark ? 'rgba(30,30,30,0.9)' : 'rgba(245,245,245,0.9)',
                padding: '8px',
                borderRadius: '6px',
                maxHeight: isCompact ? '60px' : (expanded ? 'none' : '200px')
            }}>
                {displayLines.map((line, i) => {
                    // Colorize keys and values
                    const keyMatch = line.match(/^(\s*)"([^"]+)":/);
                    const valueMatch = line.match(/:\s*(".*"|[\d.]+|true|false|null)/);

                    return (
                        <div key={i}>
                            {keyMatch && <span style={{ color: isDark ? '#9cdcfe' : '#0451a5' }}>{keyMatch[1]}"{keyMatch[2]}"</span>}
                            {keyMatch && <span>: </span>}
                            {valueMatch && <span style={{ color: isDark ? '#ce9178' : '#a31515' }}>{valueMatch[1]}</span>}
                            {!keyMatch && !valueMatch && line}
                        </div>
                    );
                })}
            </pre>
            {!isCompact && lines.length > 15 && (
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'var(--accent-color)',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    {expanded ? 'Collapse' : `Show all (${lines.length} lines)`}
                </button>
            )}
        </div>
    );
};

const DiffPreview: React.FC<{ content: string; isCompact: boolean }> = ({ content, isCompact }) => {
    const lines = content.split('\n').slice(0, isCompact ? 5 : 50);

    return (
        <div className="clip-diff" style={{ fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden' }}>
            {lines.map((line, i) => {
                let bg = 'transparent';
                let color = 'inherit';

                if (line.startsWith('+') && !line.startsWith('+++')) {
                    bg = 'rgba(34, 197, 94, 0.2)';
                    color = '#22c55e';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    bg = 'rgba(239, 68, 68, 0.2)';
                    color = '#ef4444';
                } else if (line.startsWith('@@')) {
                    color = '#60a5fa';
                } else if (line.startsWith('diff') || line.startsWith('index')) {
                    color = '#a78bfa';
                }

                return (
                    <div key={i} style={{ background: bg, color, padding: '0 4px' }}>
                        {line}
                    </div>
                );
            })}
        </div>
    );
};

const LaTeXPreview: React.FC<{ content: string; isCompact: boolean }> = ({ content, isCompact }) => {
    // Extract math expressions
    const blockMathRegex = /\$\$(.+?)\$\$/gs;
    const inlineMathRegex = /\$([^$\n]+)\$/g;

    const parts: { type: 'text' | 'block' | 'inline'; content: string }[] = [];
    let lastIndex = 0;
    let remaining = content;

    // Process block math first
    remaining = content.replace(blockMathRegex, (match, math, offset) => {
        if (offset > lastIndex) {
            parts.push({ type: 'text', content: content.slice(lastIndex, offset) });
        }
        parts.push({ type: 'block', content: math.trim() });
        lastIndex = offset + match.length;
        return '';
    });

    // Then inline math
    remaining.replace(inlineMathRegex, (match, math, offset) => {
        if (offset > lastIndex) {
            parts.push({ type: 'text', content: remaining.slice(lastIndex, offset) });
        }
        parts.push({ type: 'inline', content: math.trim() });
        lastIndex = offset + match.length;
        return '';
    });

    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.slice(lastIndex) });
    }

    if (parts.length === 0) {
        parts.push({ type: 'text', content });
    }

    return (
        <div className="clip-latex" style={{ maxHeight: isCompact ? '60px' : '200px', overflow: 'hidden' }}>
            {parts.slice(0, isCompact ? 2 : parts.length).map((part, i) => {
                if (part.type === 'block') {
                    return <BlockMath key={i} math={part.content} />;
                } else if (part.type === 'inline') {
                    return <InlineMath key={i} math={part.content} />;
                }
                return <span key={i}>{part.content}</span>;
            })}
        </div>
    );
};

const TablePreview: React.FC<{ content: string; isCompact: boolean }> = ({ content, isCompact }) => {
    const lines = content.trim().split('\n');
    const delimiter = content.includes('\t') ? '\t' : ',';
    const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));

    const displayRows = isCompact ? rows.slice(0, 3) : rows.slice(0, 20);

    return (
        <div className="clip-table" style={{ overflow: 'auto', maxHeight: isCompact ? '80px' : '250px' }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
                border: '1px solid var(--border-color)'
            }}>
                <thead>
                    <tr>
                        {rows[0]?.map((cell, i) => (
                            <th key={i} style={{
                                padding: '6px 8px',
                                background: 'rgba(128,128,128,0.1)',
                                borderBottom: '2px solid var(--border-color)',
                                textAlign: 'left',
                                fontWeight: 600
                            }}>
                                {cell}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayRows.slice(1).map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j} style={{
                                    padding: '4px 8px',
                                    borderBottom: '1px solid var(--border-color)'
                                }}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > displayRows.length && (
                <div style={{ fontSize: '0.75rem', opacity: 0.5, padding: '4px', textAlign: 'center' }}>
                    + {rows.length - displayRows.length} more rows
                </div>
            )}
        </div>
    );
};

const ContactPreview: React.FC<{ content: string; type: 'email' | 'phone' }> = ({ content, type }) => {
    const trimmed = content.trim();
    const href = type === 'email' ? `mailto:${trimmed}` : `tel:${trimmed.replace(/\s+/g, '')}`;
    const icon = type === 'email' ? '📧' : '📞';

    return (
        <div className="clip-contact" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>{icon}</span>
            <a
                href={href}
                onClick={(e) => e.stopPropagation()}
                style={{
                    color: 'var(--accent-color)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '1rem'
                }}
            >
                {trimmed}
            </a>
        </div>
    );
};

const CodePreview: React.FC<{ content: string; isCompact: boolean; isDark: boolean }> = ({ content, isCompact, isDark }) => {
    const [copied, setCopied] = useState(false);
    const language = detectLanguage(content) || 'text';

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="clip-code" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <SyntaxHighlighter
                language={language}
                style={isDark ? vscDarkPlus : vs}
                showLineNumbers={!isCompact && content.split('\n').length > 3}
                customStyle={{
                    margin: 0,
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    maxHeight: isCompact ? '60px' : '250px',
                    overflow: 'hidden'
                }}
                wrapLongLines={true}
            >
                {isCompact ? content.slice(0, 200) : content}
            </SyntaxHighlighter>

            {/* Language badge */}
            <div style={{
                position: 'absolute',
                top: '4px',
                right: copied ? '70px' : '40px',
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(0,0,0,0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                pointerEvents: 'none'
            }}>
                {language}
            </div>

            {/* Copy button */}
            {!isCompact && (
                <button
                    onClick={handleCopy}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: copied ? '#22c55e' : 'rgba(128,128,128,0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                >
                    {copied ? '✓' : 'Copy'}
                </button>
            )}
        </div>
    );
};



export const ImageMetadata: React.FC<{ filePath: string, isCompact: boolean }> = ({ filePath, isCompact }) => {
    const [meta, setMeta] = useState<{ width: number, height: number, size: number } | null>(null);

    useEffect(() => {
        if (!filePath || isCompact) return;

        const fetchMeta = async () => {
            try {
                // Get file size from backend
                const size = await invoke<number>('get_file_size', { path: filePath });

                // Get dimensions from Image
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = convertFileSrc(filePath);
                img.onload = () => {
                    setMeta({ width: img.naturalWidth, height: img.naturalHeight, size });
                };
            } catch (e) {
                console.error('Failed to get image metadata:', e);
            }
        };
        fetchMeta();
    }, [filePath, isCompact]);

    if (!meta || isCompact) return null;

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <span style={{
            fontSize: '0.85rem',
            background: 'rgba(0,0,0,0.1)',
            padding: '2px 6px',
            borderRadius: '10px',
            color: 'var(--text-secondary, #888)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap'
        }}>
            {meta.width}×{meta.height} • {formatSize(meta.size)}
        </span>
    );
};


export const ImageColorPalette: React.FC<{ src: string, isCompact: boolean }> = ({ src, isCompact }) => {
    const [colors, setColors] = useState<[number, number, number][]>([]);
    const [copiedColor, setCopiedColor] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!src || isCompact) return;

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = src;
        imgRef.current = img;

        img.onload = async () => {
            try {
                // Dynamically import to avoid bundling issues
                const ColorThief = (await import('colorthief')).default;
                const thief = new ColorThief();

                // Get dominant color + palette
                const palette = thief.getPalette(img, 20); // Get more colors to filter
                if (palette) {
                    // Deduplicate similar colors
                    const seen = new Set<string>();
                    const unique = palette.filter(([r, g, b]) => {
                        // Round to reduce near-duplicates (e.g., #1a1a1a vs #1b1b1b)
                        const key = `${Math.round(r / 10)}-${Math.round(g / 10)}-${Math.round(b / 10)}`;
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    }).slice(0, parseInt(localStorage.getItem('colorPaletteLimit') || '15')); // Configurable limit
                    setColors(unique);
                }
            } catch (e) {
                console.error('ColorThief extraction failed:', e);
            }
        };

        return () => {
            imgRef.current = null;
        };
    }, [src, isCompact]);

    if (colors.length === 0 || isCompact) return null;

    const rgbToHex = (r: number, g: number, b: number) =>
        '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

    const getContrastColor = (r: number, g: number, b: number) =>
        (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#000' : '#fff';

    const handleCopy = (hex: string) => {
        navigator.clipboard.writeText(hex);
        setCopiedColor(hex);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    return (
        <div className="color-palette" onClick={e => e.stopPropagation()} style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            padding: '4px 0',
            marginBottom: '4px',
            scrollbarWidth: 'none'
        }}>
            {colors.map((color, i) => {
                const hex = rgbToHex(color[0], color[1], color[2]);
                const contrast = getContrastColor(color[0], color[1], color[2]);
                return (
                    <div
                        key={i}
                        title={hex}
                        onClick={(e) => { e.stopPropagation(); handleCopy(hex); }}
                        style={{
                            minWidth: '15px',
                            height: '15px',
                            borderRadius: '50%',
                            backgroundColor: hex,
                            cursor: 'pointer',
                            border: '2px solid rgba(198, 193, 193, 0.19)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            color: contrast,
                            transition: 'transform 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
                    >
                        {copiedColor === hex && '✓'}
                    </div>
                );
            })}
        </div>
    );
};

// ============= MAIN COMPONENT =============

export default function ClipContent({ content, type, isCompact, showRaw = false, isDark = true, isExtracting = false, onZoom }: ClipContentProps) {
    const [validity, setValidity] = useState<{ checked: boolean, valid: boolean, invalidPaths: string[], dirPaths: string[] }>({ checked: false, valid: true, invalidPaths: [], dirPaths: [] });

    // Helper to get file icon based on extension
    const getFileIcon = (path: string, isDir: boolean, isMissing: boolean): string => {
        if (isMissing) return '❌';
        if (isDir) return '📁';

        const ext = path.split('.').pop()?.toLowerCase() || '';
        const iconMap: Record<string, string> = {
            // Documents
            'pdf': '📕', 'doc': '📘', 'docx': '📘', 'txt': '📝', 'rtf': '📝',
            'xls': '📊', 'xlsx': '📊', 'csv': '📊',
            'ppt': '📙', 'pptx': '📙',
            // Code
            'js': '🟨', 'jsx': '🟨', 'ts': '🔷', 'tsx': '🔷',
            'py': '🐍', 'rs': '🦀', 'go': '🔵',
            'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
            'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
            'md': '📖', 'markdown': '📖',
            // Images
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️', 'webp': '🖼️', 'ico': '🖼️',
            // Audio/Video
            'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵', 'flac': '🎵',
            'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', 'webm': '🎬',
            // Archives
            'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
            // Executables
            'exe': '⚙️', 'msi': '⚙️', 'dmg': '⚙️', 'app': '⚙️', 'deb': '⚙️',
            // Config
            'env': '🔧', 'ini': '🔧', 'conf': '🔧', 'config': '🔧',
        };
        return iconMap[ext] || '📄';
    };

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
                const results = await invoke<[string, boolean, boolean][]>('validate_paths', { content });
                const invalid = results.filter(([_, exists]) => !exists).map(([path]) => path);
                const dirs = results.filter(([_, exists, isDir]) => exists && isDir).map(([path]) => path);
                setValidity({ checked: true, valid: invalid.length === 0, invalidPaths: invalid, dirPaths: dirs });
            } catch (e) {
                console.error("Validation failed", e);
            }
        };

        return (
            <div className="clip-files" onMouseEnter={handleMouseEnter} style={{ fontSize: '0.9rem', color: '#e5e5e5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📁</span>
                    <span style={{ fontWeight: 600 }}>{files.length} Item{files.length !== 1 ? 's' : ''}</span>
                    {validity.checked && !validity.valid && (
                        <span style={{ color: '#ef4444', background: 'rgba(239,68,68,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            ⚠️ {validity.invalidPaths.length} Missing
                        </span>
                    )}
                </div>
                {!isCompact && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem' }}>
                        {files.slice(0, 5).map((f, i) => {
                            const isMissing = validity.checked && validity.invalidPaths.includes(f);
                            const isDir = validity.checked && validity.dirPaths.includes(f);
                            const icon = getFileIcon(f, isDir, isMissing);
                            return (
                                <div
                                    key={i}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: isMissing ? '#ef4444' : 'inherit',
                                        textDecoration: isMissing ? 'line-through' : 'none',
                                        opacity: isMissing ? 0.9 : 0.8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title={f}
                                >
                                    {icon} {f.split(/[/\\]/).pop()}
                                </div>
                            );
                        })}
                        {files.length > 5 && <div style={{ opacity: 0.5 }}>+ {files.length - 5} more</div>}
                    </div>
                )}
            </div>
        );
    }

    // Handle HTML clip type (captured from Word/Excel/rich apps)
    if (type === 'html') {
        if (showRaw || isCompact) {
            // Show raw HTML source
            return (
                <div className="clip-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: isCompact ? '0.8rem' : '0.9rem', fontFamily: 'monospace' }}>
                    {isCompact ? content.slice(0, 50) + (content.length > 50 ? '...' : '') : content.slice(0, 500) + (content.length > 500 ? '...' : '')}
                </div>
            );
        }
        // Render HTML with sanitization
        return <HTMLPreview content={content} isCompact={isCompact} />;
    }

    // Handle Image
    if (type === 'image') {
        const src = convertFileSrc(content);
        return (
            <div
                className="clip-image"
                style={{
                    maxHeight: isCompact ? '40px' : '200px',
                    overflow: 'hidden',
                    borderRadius: '4px',
                    position: 'relative',
                    background: '#000',
                    cursor: onZoom ? 'zoom-in' : 'default'
                }}
                onClick={(e) => { e.stopPropagation(); onZoom?.(src); }}
            >
                <img src={src} alt="Clip" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

                {/* OCR Progress Overlay */}
                {isExtracting && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '8px 12px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                        <span style={{ fontSize: '0.75rem', color: 'white' }}>Extracting text...</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}
            </div>
        );
    }

    // Detect content type for text
    const contentType = detectContentType(content, type);

    // Show raw view if toggled
    if (showRaw) {
        return (
            <div className="clip-raw" style={{ position: 'relative' }}>
                <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.85rem',
                    maxHeight: isCompact ? '60px' : '200px',
                    overflow: 'hidden'
                }}>
                    {isCompact ? content.slice(0, 150) : content}
                </pre>
                {!isCompact && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        fontSize: '0.6rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(128,128,128,0.3)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        pointerEvents: 'none'
                    }}>
                        RAW
                    </span>
                )}
            </div>
        );
    }

    // Render based on detected content type
    const renderContent = () => {
        switch (contentType) {
            case 'html':
                return <HTMLPreview content={content} isCompact={isCompact} />;
            case 'markdown':
                return <MarkdownPreview content={content} isCompact={isCompact} />;
            case 'json':
                return <JSONPreview content={content} isCompact={isCompact} isDark={isDark} />;
            case 'diff':
                return <DiffPreview content={content} isCompact={isCompact} />;
            case 'latex':
                return <LaTeXPreview content={content} isCompact={isCompact} />;
            case 'table':
                return <TablePreview content={content} isCompact={isCompact} />;
            case 'email':
                return <ContactPreview content={content} type="email" />;
            case 'phone':
                return <ContactPreview content={content} type="phone" />;
            case 'code':
                return <CodePreview content={content} isCompact={isCompact} isDark={isDark} />;
            default:
                return (
                    <div className="clip-text" style={{
                        maxHeight: isCompact ? '60px' : '200px',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        {isCompact ? content.slice(0, 150) : content}
                    </div>
                );
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {renderContent()}

            {/* Content type badge */}
            {!isCompact && contentType !== 'text' && (
                <span style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    fontSize: '0.6rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(128,128,128,0.3)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    pointerEvents: 'none'
                }}>
                    {contentType}
                </span>
            )}
        </div>
    );
}
