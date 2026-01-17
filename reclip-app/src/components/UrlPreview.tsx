import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UrlMetadata {
    title?: string;
    description?: string;
    image?: string;
    og_title?: string;
    og_description?: string;
    og_site_name?: string;
    keywords?: string;
    author?: string;
    canonical?: string;
    favicon?: string;
}

interface UrlPreviewProps {
    url: string;
}

// Simple in-memory cache to prevent refetching on every render
const metadataCache = new Map<string, UrlMetadata | null>();

export default function UrlPreview({ url }: UrlPreviewProps) {
    const [metadata, setMetadata] = useState<UrlMetadata | null>(metadataCache.get(url) || null);
    const [loading, setLoading] = useState(!metadata);
    const [error, setError] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (metadata) {
            setLoading(false);
            return;
        }

        let mounted = true;
        setLoading(true);

        invoke<UrlMetadata>('get_url_metadata', { url })
            .then(data => {
                if (mounted) {
                    if (!data.title && !data.description && !data.image && !data.og_title) {
                        metadataCache.set(url, null);
                        setError(true);
                    } else {
                        metadataCache.set(url, data);
                        setMetadata(data);
                    }
                    setLoading(false);
                }
            })
            .catch(_err => {
                if (mounted) {
                    metadataCache.set(url, null);
                    setError(true);
                    setLoading(false);
                }
            });

        return () => { mounted = false; };
    }, [url]);

    if (error || (!loading && !metadata)) {
        return null;
    }

    if (loading) {
        return null;
    }

    const displayTitle = metadata?.og_title || metadata?.title;
    const displayDescription = metadata?.og_description || metadata?.description;
    const hasExtraInfo = metadata?.keywords || metadata?.author || metadata?.og_site_name || metadata?.canonical;

    return (
        <div className="url-preview-card" style={{
            marginTop: '8px',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.5)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {metadata?.image && (
                <div style={{ height: '140px', overflow: 'hidden', backgroundImage: `url(${metadata.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            )}
            <div style={{ padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {metadata?.favicon && (
                        <img src={metadata.favicon} alt="" style={{ width: '16px', height: '16px', borderRadius: '2px' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                    )}
                    {metadata?.og_site_name && (
                        <span style={{ fontSize: '0.75em', color: '#666', fontWeight: 500 }}>{metadata.og_site_name}</span>
                    )}
                </div>
                {displayTitle && <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '4px', lineHeight: '1.3' }}>{displayTitle}</div>}
                {displayDescription && <div style={{ fontSize: '0.8em', color: '#555', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '6px' }}>{displayDescription}</div>}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7em', color: '#888', fontStyle: 'italic' }}>
                        {(() => { try { return new URL(url).hostname; } catch { return ''; } })()}
                    </span>
                    {hasExtraInfo && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            style={{
                                fontSize: '0.65em',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(0,0,0,0.15)',
                                background: 'rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            {expanded ? 'Less' : 'SEO Details'}
                        </button>
                    )}
                </div>

                {expanded && hasExtraInfo && (
                    <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', fontSize: '0.75em' }}>
                        {metadata?.author && (
                            <div style={{ marginBottom: '4px' }}><strong>Author:</strong> {metadata.author}</div>
                        )}
                        {metadata?.keywords && (
                            <div style={{ marginBottom: '4px' }}>
                                <strong>Keywords:</strong>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                    {metadata.keywords.split(',').slice(0, 8).map((kw, i) => (
                                        <span key={i} style={{
                                            background: 'rgba(79, 70, 229, 0.1)',
                                            color: '#4f46e5',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontSize: '0.9em'
                                        }}>{kw.trim()}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {metadata?.canonical && (
                            <div style={{ marginBottom: '4px', wordBreak: 'break-all' }}><strong>Canonical:</strong> {metadata.canonical}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
