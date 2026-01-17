import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ClipContentProps {
    content: string;
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

export default function ClipContent({ content, isCompact }: ClipContentProps) {
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
