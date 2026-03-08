import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SearchResult {
    id: number;
    module: string;
    title: string;
    preview: string;
    created_at: string;
}

interface GlobalSearchProps {
    visible: boolean;
    onClose: () => void;
    onNavigate: (module: string, id: number) => void;
}

const moduleIcons: Record<string, string> = {
    clip: '📋',
    snippet: '✂️',
    note: '📝',
};

const moduleColors: Record<string, string> = {
    clip: '#6366f1',
    snippet: '#10b981',
    note: '#f59e0b',
};

export default function GlobalSearch({ visible, onClose, onNavigate }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (visible) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [visible]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await invoke<SearchResult[]>('global_search', {
                    term: query,
                    limit: 20,
                });
                setResults(data);
                setSelectedIndex(0);
            } catch (e) {
                console.error('Global search failed:', e);
            } finally {
                setIsSearching(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault();
            const result = results[selectedIndex];
            if (result) {
                onNavigate(result.module, result.id);
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!visible) return null;

    // Group results by module
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        if (!acc[r.module]) acc[r.module] = [];
        acc[r.module].push(r);
        return acc;
    }, {});

    let flatIndex = -1;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '15vh',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    background: 'var(--bg-card, #1e1e2e)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--border-color, rgba(128,128,128,0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search clips, snippets, notes..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary, #fff)',
                            fontSize: '1rem',
                        }}
                    />
                    <kbd style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color, rgba(128,128,128,0.3))',
                        fontSize: '0.7rem',
                        opacity: 0.5,
                    }}>ESC</kbd>
                </div>

                {/* Results */}
                <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: results.length > 0 ? '8px' : '0',
                }}>
                    {isSearching && (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
                            Searching...
                        </div>
                    )}

                    {!isSearching && query && results.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
                            No results found
                        </div>
                    )}

                    {Object.entries(grouped).map(([module, items]) => (
                        <div key={module}>
                            <div style={{
                                padding: '6px 12px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                opacity: 0.5,
                                letterSpacing: '0.05em',
                            }}>
                                {moduleIcons[module]} {module}s
                            </div>
                            {items.map(result => {
                                flatIndex++;
                                const isSelected = flatIndex === selectedIndex;
                                const currentIndex = flatIndex;
                                return (
                                    <div
                                        key={`${result.module}-${result.id}`}
                                        onClick={() => {
                                            onNavigate(result.module, result.id);
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                            transition: 'background 0.15s',
                                            marginBottom: '2px',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                background: `${moduleColors[result.module]}20`,
                                                color: moduleColors[result.module],
                                            }}>
                                                {result.title}
                                            </span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.8rem',
                                            opacity: 0.7,
                                            marginTop: '4px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>
                                            {result.preview}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                {results.length > 0 && (
                    <div style={{
                        padding: '8px 16px',
                        borderTop: '1px solid var(--border-color, rgba(128,128,128,0.15))',
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.7rem',
                        opacity: 0.4,
                    }}>
                        <span>↑↓ Navigate</span>
                        <span>↵ Open</span>
                        <span>ESC Close</span>
                    </div>
                )}
            </div>
        </div>
    );
}
