import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UrlMetadata {
    title?: string;
    description?: string;
    image?: string;
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

    useEffect(() => {
        if (metadata) {
            setLoading(false);
            return;
        } // Already loaded/cached

        let mounted = true;
        setLoading(true);

        invoke<UrlMetadata>('get_url_metadata', { url })
            .then(data => {
                if (mounted) {
                    // Verify if data is empty (all null)
                    if (!data.title && !data.description && !data.image) {
                        metadataCache.set(url, null); // Treat empty as "no preview"
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
                    // console.warn("URL Preview fetch failed:", err);
                    metadataCache.set(url, null); // Don't retry
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
        // Optional: show nothing or a spinner. Showing nothing prevents layout shift if it fails fast?
        // Or show a placeholder.
        return null;
    }

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
            <div style={{ padding: '8px' }}>
                {metadata?.title && <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '4px', lineHeight: '1.2' }}>{metadata.title}</div>}
                {metadata?.description && <div style={{ fontSize: '0.8em', color: '#555', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{metadata.description}</div>}
                <div style={{ fontSize: '0.7em', color: '#888', marginTop: '6px', fontStyle: 'italic' }}>
                    {(() => { try { return new URL(url).hostname; } catch { return ''; } })()}
                </div>
            </div>
        </div>
    );
}
