import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Snippet } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Search, Code2, Copy, X, Check, Edit2, ChevronDown, ChevronRight, QrCode, ChevronLeft, Download } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { QRCodeSVG } from 'qrcode.react';

interface SnippetsPageProps {
    onBack: () => void;
    compactMode: boolean;
    theme: string;
}

const LANGUAGES = [
    'javascript', 'typescript', 'python', 'rust', 'html',
    'css', 'json', 'sql', 'bash', 'java', 'csharp', 'cpp', 'go', 'ruby', 'php', 'swift', 'kotlin', 'yaml', 'markdown', 'plaintext'
];

const LANGUAGE_COLORS: Record<string, string> = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    python: '#3776ab',
    rust: '#dea584',
    html: '#e34f26',
    css: '#1572b6',
    json: '#292929',
    sql: '#e38c00',
    bash: '#4eaa25',
    java: '#ed8b00',
    csharp: '#239120',
    cpp: '#00599c',
    go: '#00add8',
    ruby: '#cc342d',
    php: '#777bb4',
    swift: '#fa7343',
    kotlin: '#7f52ff',
    yaml: '#cb171e',
    markdown: '#083fa1',
    plaintext: '#888888',
};

const SnippetsPage: React.FC<SnippetsPageProps> = ({ onBack }) => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
    const [qrSnippet, setQrSnippet] = useState<Snippet | null>(null);
    const [qrPage, setQrPage] = useState(0);

    // Editor State
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editLanguage, setEditLanguage] = useState('plaintext');
    const [editTags, setEditTags] = useState('');

    useEffect(() => {
        loadSnippets();
    }, []);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 's' && showModal) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape' && showModal) {
                e.preventDefault();
                closeModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, editTitle, editContent, editLanguage, editTags]);

    const loadSnippets = () => {
        invoke<Snippet[]>('get_snippets')
            .then(setSnippets)
            .catch(console.error);
    };

    const openNewSnippet = () => {
        setEditingSnippet(null);
        setEditTitle('');
        setEditContent('');
        setEditLanguage('plaintext');
        setEditTags('');
        setShowModal(true);
    };

    const openEditSnippet = (s: Snippet) => {
        setEditingSnippet(s);
        setEditTitle(s.title);
        setEditContent(s.content);
        setEditLanguage(s.language);
        try {
            const parsed = JSON.parse(s.tags);
            setEditTags(Array.isArray(parsed) ? parsed.join(', ') : '');
        } catch {
            setEditTags('');
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingSnippet(null);
    };

    const handleSave = useCallback(async () => {
        const tagsArray = editTags.split(',').map(t => t.trim()).filter(t => t);
        const tagsJson = JSON.stringify(tagsArray);

        try {
            if (editingSnippet && editingSnippet.id !== 0) {
                await invoke('update_snippet', {
                    id: editingSnippet.id,
                    title: editTitle || 'Untitled',
                    content: editContent,
                    language: editLanguage,
                    tags: tagsJson
                });
            } else {
                await invoke<number>('add_snippet', {
                    title: editTitle || 'Untitled Snippet',
                    content: editContent,
                    language: editLanguage,
                    tags: tagsJson
                });
            }
            loadSnippets();
            closeModal();
        } catch (e) {
            console.error('Failed to save snippet:', e);
        }
    }, [editingSnippet, editTitle, editContent, editLanguage, editTags]);

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this snippet?')) return;
        try {
            await invoke('delete_snippet', { id });
            loadSnippets();
            if (expandedId === id) setExpandedId(null);
        } catch (e) { console.error(e); }
    };

    const copyToClipboard = async (content: string, id: number) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.toLowerCase().includes(search.toLowerCase()) ||
        s.language.toLowerCase().includes(search.toLowerCase())
    );

    const parseTags = (tags: string): string[] => {
        try {
            const parsed = JSON.parse(tags);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Header */}
            <div className="titlebar" style={{ background: 'transparent' }}>
                <div className="title-left">
                    <button onClick={onBack} className="title-btn" title="Back to Clips">
                        <ArrowLeft size={18} />
                    </button>
                    <Code2 size={16} style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontWeight: 600 }}>Snippet Library</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: 8 }}>
                        {snippets.length} snippet{snippets.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="title-right">
                    <button
                        onClick={openNewSnippet}
                        style={{
                            background: 'var(--accent-color)',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={14} /> New Snippet
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder="Search snippets..."
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'var(--bg-input, rgba(128,128,128,0.1))',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 12px 10px 36px',
                            fontSize: '0.9rem',
                            color: 'inherit',
                            outline: 'none'
                        }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Snippet List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                {filteredSnippets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4 }}>
                        <Code2 size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
                        <div style={{ fontSize: '1rem' }}>{search ? 'No matches found' : 'No snippets yet'}</div>
                        <div style={{ fontSize: '0.85rem', marginTop: 8 }}>Click "+ New Snippet" to create one</div>
                    </div>
                ) : (
                    filteredSnippets.map(snippet => {
                        const isExpanded = expandedId === snippet.id;
                        const tags = parseTags(snippet.tags);

                        return (
                            <div
                                key={snippet.id}
                                style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: '10px',
                                    marginBottom: '8px',
                                    border: isExpanded ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    overflow: 'hidden',
                                    transition: 'border-color 0.2s'
                                }}
                            >
                                {/* Snippet Header - Collapsed View */}
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : snippet.id)}
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    {/* Expand/Collapse Icon */}
                                    <div style={{ opacity: 0.5, flexShrink: 0 }}>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>

                                    {/* Language Badge */}
                                    <span style={{
                                        fontSize: '0.6rem',
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                        background: LANGUAGE_COLORS[snippet.language] || '#888',
                                        color: 'white',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        flexShrink: 0
                                    }}>
                                        {snippet.language}
                                    </span>

                                    {/* Tags (before title) */}
                                    {tags.length > 0 && (
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            {tags.slice(0, 2).map((tag, i) => (
                                                <span key={i} style={{
                                                    background: 'rgba(128,128,128,0.15)',
                                                    padding: '2px 6px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 500
                                                }}>
                                                    #{tag}
                                                </span>
                                            ))}
                                            {tags.length > 2 && (
                                                <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>+{tags.length - 2}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Title */}
                                    <span style={{
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1
                                    }}>
                                        {snippet.title || 'Untitled'}
                                    </span>
                                </div>

                                {/* Expanded View */}
                                {isExpanded && (
                                    <>
                                        {/* Action Buttons - Only in Expanded View */}
                                        <div style={{
                                            padding: '8px 16px',
                                            borderTop: '1px solid var(--border-color)',
                                            borderBottom: '1px solid var(--border-color)',
                                            display: 'flex',
                                            gap: '8px',
                                            background: 'rgba(0,0,0,0.1)'
                                        }}>
                                            <button
                                                onClick={() => copyToClipboard(snippet.content, snippet.id)}
                                                style={{
                                                    background: copiedId === snippet.id ? '#22c55e' : 'rgba(128,128,128,0.2)',
                                                    color: copiedId === snippet.id ? 'white' : 'inherit',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '8px 14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {copiedId === snippet.id ? <Check size={14} /> : <Copy size={14} />}
                                                {copiedId === snippet.id ? 'Copied!' : 'Copy Code'}
                                            </button>
                                            <button
                                                onClick={() => openEditSnippet(snippet)}
                                                style={{
                                                    background: 'rgba(128,128,128,0.2)',
                                                    color: 'inherit',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '8px 14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <Edit2 size={14} /> Edit
                                            </button>
                                            <button
                                                onClick={() => setQrSnippet(snippet)}
                                                style={{
                                                    background: 'rgba(128,128,128,0.2)',
                                                    color: 'inherit',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '8px 14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <QrCode size={14} /> QR Code
                                            </button>
                                            <button
                                                onClick={() => handleDelete(snippet.id)}
                                                style={{
                                                    background: 'rgba(239,68,68,0.15)',
                                                    color: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    padding: '8px 14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500,
                                                    marginLeft: 'auto'
                                                }}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>

                                        {/* Code View */}
                                        <div style={{ maxHeight: '350px', overflow: 'auto' }}>
                                            <SyntaxHighlighter
                                                language={snippet.language}
                                                style={atomDark}
                                                customStyle={{ margin: 0, padding: '14px', background: 'rgba(0,0,0,0.3)', fontSize: '0.85rem' }}
                                                showLineNumbers={true}
                                                lineNumberStyle={{ opacity: 0.4, minWidth: '2.5em' }}
                                            >
                                                {snippet.content || '// Empty snippet'}
                                            </SyntaxHighlighter>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal Dialog */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                                {editingSnippet ? 'Edit Snippet' : 'New Snippet'}
                            </h2>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    opacity: 0.6,
                                    color: 'inherit'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            {/* Title */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 6 }}>Title</label>
                                <input
                                    type="text"
                                    placeholder="Snippet title..."
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-input, rgba(128,128,128,0.1))',
                                        color: 'inherit',
                                        fontSize: '0.9rem',
                                        outline: 'none'
                                    }}
                                    autoFocus
                                />
                            </div>

                            {/* Language + Tags Row */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 6 }}>Language</label>
                                    <select
                                        value={editLanguage}
                                        onChange={(e) => setEditLanguage(e.target.value)}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-input, rgba(128,128,128,0.1))',
                                            color: 'inherit',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {LANGUAGES.map(l => <option key={l} value={l} style={{ background: 'var(--bg-card)', color: 'inherit' }}>{l}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 6 }}>Tags</label>
                                    <input
                                        type="text"
                                        placeholder="Comma separated..."
                                        value={editTags}
                                        onChange={(e) => setEditTags(e.target.value)}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-input, rgba(128,128,128,0.1))',
                                            color: 'inherit',
                                            fontSize: '0.9rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Code Content */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: 6 }}>Code</label>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder="// Paste your code here..."
                                    spellCheck={false}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        minHeight: '200px',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: 'inherit',
                                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                        fontSize: '0.85rem',
                                        lineHeight: 1.6,
                                        resize: 'vertical',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 20px',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'transparent',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#22c55e',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Save size={14} /> Save Snippet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal - Multi-page with Save */}
            {qrSnippet && (() => {
                const CHUNK_SIZE = 800; // Smaller chunks for reliable scanning
                const content = qrSnippet.content || '';
                const chunks: string[] = [];
                for (let i = 0; i < content.length; i += CHUNK_SIZE) {
                    chunks.push(content.slice(i, i + CHUNK_SIZE));
                }
                if (chunks.length === 0) chunks.push('');

                const totalPages = chunks.length;
                const currentChunk = chunks[qrPage] || '';
                const isMultiPage = totalPages > 1;

                const handleSaveQR = () => {
                    const svg = document.getElementById('qr-code-svg');
                    if (!svg) return;

                    const svgData = new XMLSerializer().serializeToString(svg);
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
                            ctx.font = '12px sans-serif';
                            ctx.textAlign = 'center';
                            const label = isMultiPage ? `Page ${qrPage + 1}/${totalPages}` : qrSnippet.title || 'Snippet';
                            ctx.fillText(label, canvas.width / 2, canvas.height - 15);
                        }

                        const link = document.createElement('a');
                        const filename = isMultiPage
                            ? `${qrSnippet.title || 'snippet'}_qr_${qrPage + 1}.png`
                            : `${qrSnippet.title || 'snippet'}_qr.png`;
                        link.download = filename.replace(/[^a-z0-9_.-]/gi, '_');
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    };

                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                };

                return (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                        onClick={() => { setQrSnippet(null); setQrPage(0); }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'var(--bg-card)',
                                borderRadius: '16px',
                                padding: '24px',
                                textAlign: 'center',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                                maxWidth: '450px',
                                minWidth: '320px'
                            }}
                        >
                            <div style={{ marginBottom: 16, fontWeight: 600, fontSize: '1rem' }}>
                                {qrSnippet.title || 'Untitled'}
                            </div>

                            {currentChunk.length > 0 ? (
                                <div style={{ background: 'white', padding: 16, borderRadius: 12, display: 'inline-block' }}>
                                    <QRCodeSVG
                                        id="qr-code-svg"
                                        value={isMultiPage ? `[${qrPage + 1}/${totalPages}]${currentChunk}` : currentChunk}
                                        size={200}
                                        level="L"
                                    />
                                </div>
                            ) : (
                                <div style={{ padding: 40, opacity: 0.5 }}>Empty snippet</div>
                            )}

                            {/* Page Navigation */}
                            {isMultiPage && (
                                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                    <button
                                        onClick={() => setQrPage(p => Math.max(0, p - 1))}
                                        disabled={qrPage === 0}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: qrPage === 0 ? 'rgba(128,128,128,0.1)' : 'rgba(128,128,128,0.3)',
                                            color: qrPage === 0 ? 'rgba(128,128,128,0.4)' : 'inherit',
                                            cursor: qrPage === 0 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <ChevronLeft size={16} /> Prev
                                    </button>
                                    <span style={{ fontWeight: 600 }}>
                                        {qrPage + 1} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setQrPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={qrPage === totalPages - 1}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: qrPage === totalPages - 1 ? 'rgba(128,128,128,0.1)' : 'rgba(128,128,128,0.3)',
                                            color: qrPage === totalPages - 1 ? 'rgba(128,128,128,0.4)' : 'inherit',
                                            cursor: qrPage === totalPages - 1 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        Next <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}

                            {isMultiPage && (
                                <div style={{ marginTop: 12, fontSize: '0.75rem', opacity: 0.6, padding: '8px', background: 'rgba(128,128,128,0.1)', borderRadius: 8 }}>
                                    📱 Scan all {totalPages} QR codes in order to get complete snippet
                                </div>
                            )}

                            <div style={{ marginTop: 12, fontSize: '0.7rem', opacity: 0.4 }}>
                                {content.length} chars total{isMultiPage ? ` • ${currentChunk.length} chars this page` : ''}
                            </div>

                            {/* Action Buttons */}
                            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <button
                                    onClick={handleSaveQR}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'var(--accent-color)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    <Download size={14} /> Save{isMultiPage ? ' This Page' : ''}
                                </button>
                                <button
                                    onClick={() => { setQrSnippet(null); setQrPage(0); }}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        color: 'inherit',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SnippetsPage;
