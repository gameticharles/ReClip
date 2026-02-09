import React, { useState } from 'react';
import { CHANGELOG_DATA, ChangeLogEntry } from '../data/changelog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChangelogViewer() {
    return (
        <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px' }}>Release Notes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {CHANGELOG_DATA.map((entry) => (
                    <ChangelogEntryItem key={entry.version} entry={entry} />
                ))}
            </div>
        </div>
    );
}

function ChangelogEntryItem({ entry }: { entry: ChangeLogEntry }) {
    const [expanded, setExpanded] = useState(false);
    const isLatest = entry.version === CHANGELOG_DATA[0].version;

    // Default to expanded for the latest version
    React.useEffect(() => {
        if (isLatest) setExpanded(true);
    }, [isLatest]);

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: expanded ? 'rgba(128,128,128,0.05)' : 'transparent'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        color: isLatest ? 'var(--accent-color)' : 'inherit'
                    }}>
                        v{entry.version}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>{entry.date}</div>
                    {isLatest && (
                        <div style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            color: '#22c55e',
                            fontWeight: 600,
                            border: '1px solid rgba(34, 197, 94, 0.2)'
                        }}>
                            New
                        </div>
                    )}
                </div>
                <div style={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    opacity: 0.5
                }}>
                    ▼
                </div>
            </div>

            {expanded && (
                <div style={{ padding: '0 20px 20px 20px' }}>
                    {entry.sections.map((section, idx) => (
                        <div key={idx} style={{ marginTop: '16px' }}>
                            <h4 style={{
                                fontSize: '0.9rem',
                                opacity: 0.9,
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                {section.title}
                            </h4>
                            <ul style={{ paddingLeft: '20px', margin: 0, opacity: 0.8, fontSize: '0.95rem', lineHeight: '1.6' }}>
                                {section.items.map((item, i) => (
                                    <li key={i} style={{ marginBottom: '6px' }}>
                                        <ReactMarkdown components={{ p: React.Fragment }} remarkPlugins={[remarkGfm]}>
                                            {item}
                                        </ReactMarkdown>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
