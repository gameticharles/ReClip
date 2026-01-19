import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Snippet } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Search, Code2, Copy, X, Check, Edit2, ChevronDown, ChevronRight, QrCode, Star, FolderOpen, Clipboard, CopyPlus, FileDown, FileUp, History, Filter, ArrowUpDown } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { getThemeById } from '../utils/themes';
import { LANGUAGES, LANGUAGE_COLORS } from '../utils/languages';
import { QRModal } from '../components/QRModal';

interface SnippetsPageProps {
    onBack: () => void;
    compactMode: boolean;
    theme: string;
}

type SortOption = 'updated' | 'created' | 'title' | 'language';

// Shared select style for dark mode compatibility
const selectStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-input)',
    color: 'inherit',
    fontSize: '0.75rem',
    cursor: 'pointer',
};

const SnippetsPage: React.FC<SnippetsPageProps> = ({ onBack, theme }) => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Theme Detection
    const [systemDark, setSystemDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
    const [templates, setTemplates] = useState<any[]>([]);

    // Settings
    const [editorSettings] = useState(() => ({
        fontSize: parseInt(localStorage.getItem('snippetFontSize') || '14'),
        tabSize: parseInt(localStorage.getItem('snippetTabSize') || '4'),
        wordWrap: localStorage.getItem('snippetWordWrap') === 'true',
        lineNumbers: localStorage.getItem('snippetLineNumbers') !== 'false',
        defaultLanguage: localStorage.getItem('snippetDefaultLanguage') || 'plaintext'
    }));

    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    // Derived Theme
    const themeParams = isDark
        ? { id: localStorage.getItem('snippetThemeDark') || 'atomDark', mode: 'dark' as const }
        : { id: localStorage.getItem('snippetThemeLight') || 'oneLight', mode: 'light' as const };
    const syntaxTheme = getThemeById(themeParams.id, themeParams.mode).style;

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        invoke<any[]>('get_templates').then(setTemplates).catch(console.error);
    }, []);
    // Filter & Sort State
    const [filterLanguage, setFilterLanguage] = useState<string>('');
    const [filterFolder, setFilterFolder] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('updated');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
    const [qrContent, setQrContent] = useState<{ title: string; content: string } | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);

    // Editor State
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editLanguage, setEditLanguage] = useState('plaintext');
    const [editTags, setEditTags] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editFolder, setEditFolder] = useState('');

    useEffect(() => { loadSnippets(); }, []);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 's' && showModal) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                if (showModal) { e.preventDefault(); closeModal(); }
                if (qrContent) { setQrContent(null); }
            } else if (e.ctrlKey && e.key === 'n' && !showModal) {
                e.preventDefault();
                openNewSnippet();
            } else if (e.ctrlKey && e.key === 'f' && !showModal) {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, editTitle, editContent, editLanguage, editTags, qrContent]);

    const loadSnippets = () => {
        invoke<Snippet[]>('get_snippets').then(setSnippets).catch(console.error);
    };

    const folders = [...new Set(snippets.map(s => s.folder).filter(f => f && f.length > 0))];

    const openNewSnippet = () => {
        setEditingSnippet(null);
        setEditTitle('');
        setEditContent('');
        setEditLanguage('plaintext');
        setEditTags('');
        setEditDescription('');
        setEditFolder('');
        setShowModal(true);
    };

    const openEditSnippet = (s: Snippet) => {
        setEditingSnippet(s);
        setEditTitle(s.title);
        setEditContent(s.content);
        setEditLanguage(s.language);
        setEditDescription(s.description || '');
        setEditFolder(s.folder || '');
        try { setEditTags(JSON.parse(s.tags).join(', ')); } catch { setEditTags(''); }
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingSnippet(null); setShowTemplates(false); };

    const handleSave = useCallback(async () => {
        const tagsJson = JSON.stringify(editTags.split(',').map(t => t.trim()).filter(t => t));
        try {
            if (editingSnippet && editingSnippet.id !== 0) {
                await invoke('update_snippet', { id: editingSnippet.id, title: editTitle || 'Untitled', content: editContent, language: editLanguage, tags: tagsJson, description: editDescription, folder: editFolder });
            } else {
                await invoke<number>('add_snippet', { title: editTitle || 'Untitled Snippet', content: editContent, language: editLanguage, tags: tagsJson, description: editDescription, folder: editFolder });
            }
            loadSnippets();
            closeModal();
        } catch (e) { console.error('Failed to save snippet:', e); }
    }, [editingSnippet, editTitle, editContent, editLanguage, editTags, editDescription, editFolder]);

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this snippet?')) return;
        try { await invoke('delete_snippet', { id }); loadSnippets(); if (expandedId === id) setExpandedId(null); } catch (e) { console.error(e); }
    };

    const handleToggleFavorite = async (id: number) => {
        try { await invoke('toggle_snippet_favorite', { id }); loadSnippets(); } catch (e) { console.error(e); }
    };

    const handleDuplicate = async (id: number) => {
        try { await invoke<number>('duplicate_snippet', { id }); loadSnippets(); } catch (e) { console.error(e); }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setEditContent(text);
            setEditTitle('Pasted Snippet');
            setShowModal(true);
        } catch (e) { console.error('Failed to read clipboard:', e); }
    };

    const handleExport = () => {
        const data = JSON.stringify(snippets, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snippets_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const imported = JSON.parse(text) as Snippet[];
                for (const s of imported) {
                    await invoke('add_snippet', { title: s.title, content: s.content, language: s.language, tags: s.tags, description: s.description || '', folder: s.folder || '' });
                }
                loadSnippets();
                alert(`Imported ${imported.length} snippets!`);
            } catch { alert('Invalid JSON file'); }
        };
        input.click();
    };

    const copyToClipboard = async (content: string, id: number) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const useTemplate = (template: { name: string, language: string, content: string }) => {
        setEditContent(template.content);
        setEditLanguage(template.language);
        setEditTitle(template.name);
        setShowTemplates(false);
    };

    const parseTags = (tags: string): string[] => { try { return JSON.parse(tags) || []; } catch { return []; } };
    const parseHistory = (h: string): { content: string; timestamp: string }[] => { try { return JSON.parse(h) || []; } catch { return []; } };

    const formatTime = (dateStr: string) => {
        const dateFormat = localStorage.getItem('dateFormat') || 'relative';
        if (dateFormat === 'absolute') return new Date(dateStr).toLocaleString();

        const date = new Date(dateStr);
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (isNaN(diffSeconds)) return dateStr;

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
        if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)}d ago`;
        if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
        return `${Math.floor(diffSeconds / 31536000)}y ago`;
    };


    const filteredSnippets = snippets
        .filter(s => {
            const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
                s.tags.toLowerCase().includes(search.toLowerCase()) ||
                s.language.toLowerCase().includes(search.toLowerCase()) ||
                (s.description || '').toLowerCase().includes(search.toLowerCase());
            const matchLang = !filterLanguage || s.language === filterLanguage;
            const matchFolder = !filterFolder || s.folder === filterFolder;
            const matchFav = !showFavoritesOnly || s.favorite;
            return matchSearch && matchLang && matchFolder && matchFav;
        })
        .sort((a, b) => {
            if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
            switch (sortBy) {
                case 'title': return a.title.localeCompare(b.title);
                case 'language': return a.language.localeCompare(b.language);
                case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            }
        });

    const btnStyle = (active?: boolean): React.CSSProperties => ({
        background: active ? 'var(--accent-color)' : 'rgba(128,128,128,0.2)',
        color: active ? 'white' : 'inherit',
        border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem'
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Header - All children need data-tauri-drag-region for full drag area */}
            <div className="titlebar" data-tauri-drag-region style={{ background: 'transparent' }}>
                <div className="title-left" data-tauri-drag-region>
                    <button onClick={onBack} className="title-btn" title="Back"><ArrowLeft size={18} /></button>
                    <Code2 size={16} style={{ color: 'var(--accent-color)', pointerEvents: 'none' }} data-tauri-drag-region />
                    <span data-tauri-drag-region style={{ fontWeight: 600, pointerEvents: 'none' }}>Snippet Library</span>
                    <span data-tauri-drag-region style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: 8, pointerEvents: 'none' }}>{snippets.length} snippets</span>
                </div>
                <div className="title-right" style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handlePasteFromClipboard} style={btnStyle()} title="Paste from Clipboard"><Clipboard size={14} /></button>
                    <button onClick={handleImport} style={btnStyle()} title="Import Snippets"><FileUp size={14} /></button>
                    <button onClick={handleExport} style={btnStyle()} title="Export All Snippets"><FileDown size={14} /></button>
                    <button onClick={openNewSnippet} style={{ ...btnStyle(true), padding: '6px 12px', fontWeight: 500 }}>
                        <Plus size={14} /> New
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 150 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search... (Ctrl+F)"
                        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: '0.85rem', color: 'inherit', outline: 'none' }}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Filter size={12} style={{ opacity: 0.5, color: 'inherit' }} />
                    <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} style={selectStyle}>
                        <option value="" style={{ background: 'var(--bg-card)', color: 'inherit' }}>All Languages</option>
                        {LANGUAGES.map(l => <option key={l} value={l} style={{ background: 'var(--bg-card)', color: 'inherit' }}>{l}</option>)}
                    </select>
                </div>

                {folders.length > 0 && (
                    <select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} style={selectStyle}>
                        <option value="" style={{ background: 'var(--bg-card)', color: 'inherit' }}>All Folders</option>
                        {folders.map(f => <option key={f} value={f} style={{ background: 'var(--bg-card)', color: 'inherit' }}>{f}</option>)}
                    </select>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowUpDown size={12} style={{ opacity: 0.5, color: 'inherit' }} />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} style={selectStyle}>
                        <option value="updated" style={{ background: 'var(--bg-card)', color: 'inherit' }}>Last Modified</option>
                        <option value="created" style={{ background: 'var(--bg-card)', color: 'inherit' }}>Date Created</option>
                        <option value="title" style={{ background: 'var(--bg-card)', color: 'inherit' }}>Title A-Z</option>
                        <option value="language" style={{ background: 'var(--bg-card)', color: 'inherit' }}>Language</option>
                    </select>
                </div>

                <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} style={btnStyle(showFavoritesOnly)} title="Show Favorites Only">
                    <Star size={12} fill={showFavoritesOnly ? 'currentColor' : 'none'} /> Favorites
                </button>
            </div>

            {/* Snippet List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                {filteredSnippets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4 }}>
                        <Code2 size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
                        <div>{search || filterLanguage || filterFolder || showFavoritesOnly ? 'No matches found' : 'No snippets yet'}</div>
                        <div style={{ fontSize: '0.85rem', marginTop: 8 }}>Press Ctrl+N to create one</div>
                    </div>
                ) : (
                    filteredSnippets.map(snippet => {
                        const isExpanded = expandedId === snippet.id;
                        const tags = parseTags(snippet.tags);
                        const history = parseHistory(snippet.version_history);

                        return (
                            <div key={snippet.id} className="snippet-card" style={{ border: isExpanded ? '1px solid var(--accent-color)' : undefined }}>
                                {/* Header */}
                                <div onClick={() => setExpandedId(isExpanded ? null : snippet.id)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ opacity: 0.5, color: 'inherit' }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(snippet.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: snippet.favorite ? '#eab308' : 'var(--text-primary, #e5e5e5)' }}
                                        title="Toggle Favorite"
                                    >
                                        <Star size={14} fill={snippet.favorite ? '#eab308' : 'none'} stroke="currentColor" />
                                    </button>
                                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: LANGUAGE_COLORS[snippet.language] || '#888', color: 'white', fontWeight: 600, textTransform: 'uppercase' }}>{snippet.language}</span>
                                    {snippet.folder && <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(128,128,128,0.2)', display: 'flex', alignItems: 'center', gap: 2, color: 'inherit' }}><FolderOpen size={10} />{snippet.folder}</span>}
                                    {tags.slice(0, 2).map((tag, i) => <span key={i} style={{ background: 'rgba(128,128,128,0.15)', padding: '2px 6px', borderRadius: 8, fontSize: '0.6rem', color: 'inherit' }}>#{tag}</span>)}
                                    {tags.length > 2 && <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>+{tags.length - 2}</span>}
                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{snippet.title || 'Untitled'}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: 8, whiteSpace: 'nowrap' }} title={new Date(snippet.updated_at).toLocaleString()}>{formatTime(snippet.updated_at)}</span>
                                </div>

                                {isExpanded && (
                                    <>
                                        {snippet.description && <div style={{ padding: '0 14px 10px', fontSize: '0.8rem', opacity: 0.7 }}>{snippet.description}</div>}

                                        {/* Actions - Fixed dark mode styling */}
                                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(128,128,128,0.08)' }}>
                                            <button onClick={() => copyToClipboard(snippet.content, snippet.id)} style={{ ...btnStyle(copiedId === snippet.id), background: copiedId === snippet.id ? '#22c55e' : 'rgba(128,128,128,0.2)', color: copiedId === snippet.id ? 'white' : 'inherit' }}>
                                                {copiedId === snippet.id ? <Check size={12} /> : <Copy size={12} />} {copiedId === snippet.id ? 'Copied!' : 'Copy'}
                                            </button>
                                            <button onClick={() => openEditSnippet(snippet)} style={btnStyle()}><Edit2 size={12} /> Edit</button>
                                            <button onClick={() => handleDuplicate(snippet.id)} style={btnStyle()}><CopyPlus size={12} /> Duplicate</button>
                                            <button onClick={() => setQrContent({ title: snippet.title, content: snippet.content })} style={btnStyle()}><QrCode size={12} /> QR</button>
                                            {history.length > 0 && (
                                                <button onClick={() => setShowHistory(!showHistory)} style={btnStyle(showHistory)}><History size={12} /> History ({history.length})</button>
                                            )}
                                            <button onClick={() => handleDelete(snippet.id)} style={{ ...btnStyle(), marginLeft: 'auto', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Trash2 size={12} /> Delete</button>
                                        </div>

                                        {showHistory && history.length > 0 && (
                                            <div style={{ padding: 10, background: 'rgba(128,128,128,0.08)', maxHeight: 150, overflowY: 'auto' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>Version History</div>
                                                {history.map((h, i) => (
                                                    <div key={i} style={{ fontSize: '0.7rem', padding: 4, borderRadius: 4, background: 'rgba(128,128,128,0.1)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{new Date(h.timestamp).toLocaleString()}</span>
                                                        <button onClick={() => { setEditContent(h.content); openEditSnippet(snippet); }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.7rem' }}>Restore</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ maxHeight: 350, overflow: 'auto' }}>
                                            <SyntaxHighlighter
                                                language={snippet.language}
                                                style={syntaxTheme}
                                                customStyle={{ margin: 0, padding: 14, background: 'rgba(0,0,0,0.02)', fontSize: `${editorSettings.fontSize}px` }}
                                                showLineNumbers={editorSettings.lineNumbers}
                                                lineNumberStyle={{ opacity: 0.4, minWidth: '2.5em' }}
                                                wrapLines={editorSettings.wordWrap}
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

            {/* Edit Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={closeModal}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', width: '90%', maxWidth: 650, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{editingSnippet ? 'Edit Snippet' : 'New Snippet'}</h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setShowTemplates(!showTemplates)} style={btnStyle(showTemplates)}>Templates</button>
                                <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, color: 'inherit' }}><X size={18} /></button>
                            </div>
                        </div>

                        {showTemplates && (
                            <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', background: 'rgba(128,128,128,0.08)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {templates.map((t, i) => <button key={i} onClick={() => useTemplate(t)} style={btnStyle()}>{t.name}</button>)}
                            </div>
                        )}

                        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Title</label>
                                    <input type="text" placeholder="Snippet title..." value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} autoFocus />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Language</label>
                                    <select value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)} style={{ ...selectStyle, width: '100%', padding: '8px 10px' }}>
                                        {LANGUAGES.map(l => <option key={l} value={l} style={{ background: 'var(--bg-card)', color: 'inherit' }}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Tags (comma-separated)</label>
                                    <input type="text" placeholder="api, utility, etc." value={editTags} onChange={(e) => setEditTags(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Folder</label>
                                    <input type="text" placeholder="e.g. Work, Personal" value={editFolder} onChange={(e) => setEditFolder(e.target.value)} list="folder-list" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
                                    <datalist id="folder-list">{folders.map(f => <option key={f} value={f} />)}</datalist>
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Description (optional)</label>
                                <input type="text" placeholder="Brief description..." value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Code</label>
                                <div style={{ position: 'relative' }}>
                                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="// Paste your code here..." spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', minHeight: 180, padding: `10px 10px 10px ${editorSettings.lineNumbers ? '40px' : '10px'}`, borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'inherit', fontFamily: 'Consolas, Monaco, monospace', fontSize: `${editorSettings.fontSize}px`, lineHeight: 1.5, resize: 'vertical', outline: 'none', whiteSpace: editorSettings.wordWrap ? 'pre-wrap' : 'pre' }} />
                                    {editorSettings.lineNumbers && (
                                        <div style={{ position: 'absolute', left: 0, top: 0, padding: '10px 8px', fontSize: `${editorSettings.fontSize}px`, fontFamily: 'Consolas, Monaco, monospace', lineHeight: 1.5, opacity: 0.4, pointerEvents: 'none', userSelect: 'none', borderRight: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                                            {editContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                            <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Save size={14} /> Save (Ctrl+S)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal - Using shared component */}
            {qrContent && (
                <QRModal
                    title={qrContent.title}
                    content={qrContent.content}
                    onClose={() => setQrContent(null)}
                />
            )}
        </div>
    );
};

export default SnippetsPage;
