import React from 'react';

interface FilterChipsProps {
    activeFilter: string;
    setActiveFilter: (filter: string) => void;
}

const FILTERS = [
    { key: 'all', label: '📋 All' },
    { key: 'text', label: '📝 Text' },
    { key: 'image', label: '🖼️ Images' },
    { key: 'html', label: '🌐 HTML' },
    { key: 'files', label: '📁 Files' },
    { key: 'file', label: '📄 File Path' },
    { key: 'favorites', label: '⭐ Favorites' },
];

export const FilterChips: React.FC<FilterChipsProps> = ({ activeFilter, setActiveFilter }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            width: '100%',
        }}>
            {FILTERS.map(f => (
                <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    style={{
                        padding: '4px 10px',
                        borderRadius: '16px',
                        border: activeFilter === f.key ? '1px solid var(--accent-color, #6366f1)' : '1px solid var(--border-color, rgba(128,128,128,0.2))',
                        background: activeFilter === f.key ? 'var(--accent-color, #6366f1)' : 'transparent',
                        color: activeFilter === f.key ? '#fff' : 'var(--text-secondary, #888)',
                        fontSize: '0.75rem',
                        fontWeight: activeFilter === f.key ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
};
