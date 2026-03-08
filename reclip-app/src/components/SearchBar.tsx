import React from 'react';

interface SearchBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    totalClipCount: number;
    foundCount: number;
    pinnedCount: number;
    favoriteCount: number;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    searchTerm, setSearchTerm, totalClipCount, foundCount,
    pinnedCount, favoriteCount, inputRef
}) => {
    return (
        <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            width: '100%',
        }}>
            {/* Search Input */}
            <div style={{ flex: 1, position: 'relative' }}>
                <span style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.4,
                    pointerEvents: 'none',
                }}>🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search clips, tags, content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    style={{
                        width: '100%',
                        padding: '8px 12px 8px 32px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, rgba(128,128,128,0.2))',
                        background: 'var(--bg-input, var(--bg-card))',
                        color: 'var(--text-primary, inherit)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        transition: 'all 0.2s',
                    }}
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.5,
                            fontSize: '0.9rem',
                        }}
                    >✕</button>
                )}
            </div>

            {/* Clip Stats */}
            <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '0.75rem',
                opacity: 0.7,
                whiteSpace: 'nowrap',
            }}>
                {searchTerm ? (
                    <span style={{
                        background: 'var(--accent-color)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontWeight: 600,
                    }}>
                        {foundCount} found
                    </span>
                ) : (
                    <>
                        <span title="Total clips in database">📋 {totalClipCount}</span>
                        <span title="Pinned clips (loaded)">📌 {pinnedCount}</span>
                        <span title="Favorites (loaded)">⭐ {favoriteCount}</span>
                    </>
                )}
            </div>
        </div>
    );
};
