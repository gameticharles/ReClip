import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Snippet } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Search, Code2, Copy, X, Check, Edit2, ChevronDown, ChevronRight, QrCode, ChevronLeft, Download, Star, FolderOpen, Clipboard, CopyPlus, FileDown, FileUp, History, Filter, ArrowUpDown } from 'lucide-react';
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
    javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab', rust: '#dea584',
    html: '#e34f26', css: '#1572b6', json: '#292929', sql: '#e38c00', bash: '#4eaa25',
    java: '#ed8b00', csharp: '#239120', cpp: '#00599c', go: '#00add8', ruby: '#cc342d',
    php: '#777bb4', swift: '#fa7343', kotlin: '#7f52ff', yaml: '#cb171e', markdown: '#083fa1', plaintext: '#888888',
};

const TEMPLATES: { name: string; language: string; content: string }[] = [
    { name: 'React Component', language: 'typescript', content: `import React from 'react';\n\ninterface Props {\n  title: string;\n}\n\nexport const Component: React.FC<Props> = ({ title }) => {\n  return <div>{title}</div>;\n};\n` },
    { name: 'SQL Query', language: 'sql', content: `SELECT \n    column1,\n    column2\nFROM table_name\nWHERE condition = 'value'\nORDER BY column1 DESC\nLIMIT 10;\n` },
    { name: 'Python Function', language: 'python', content: `def function_name(param1: str, param2: int = 0) -> dict:\n    """Description of function."""\n    result = {}\n    # Implementation\n    return result\n` },
    { name: 'Rust Struct', language: 'rust', content: `#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]\npub struct MyStruct {\n    pub id: i64,\n    pub name: String,\n}\n\nimpl MyStruct {\n    pub fn new(name: String) -> Self {\n        Self { id: 0, name }\n    }\n}\n` },
    { name: 'CSS Flexbox', language: 'css', content: `.container {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 1rem;\n  padding: 1rem;\n}\n` },
];

type SortOption = 'updated' | 'created' | 'title' | 'language';

const SnippetsPage: React.FC<SnippetsPageProps> = ({ onBack }) => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Filter & Sort State
    const [filterLanguage, setFilterLanguage] = useState<string>('');
    const [filterFolder, setFilterFolder] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('updated');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
    const [qrSnippet, setQrSnippet] = useState<Snippet | null>(null);
    const [qrPage, setQrPage] = useState(0);
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
                if (qrSnippet) { setQrSnippet(null); setQrPage(0); }
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
    }, [showModal, editTitle, editContent, editLanguage, editTags, qrSnippet]);

    const loadSnippets = () => {
        invoke<Snippet[]>('get_snippets').then(setSnippets).catch(console.error);
    };

    // Get unique folders from snippets
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
            } catch (e) { alert('Invalid JSON file'); }
        };
        input.click();
    };

    const copyToClipboard = async (content: string, id: number) => {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const useTemplate = (template: typeof TEMPLATES[0]) => {
        setEditContent(template.content);
        setEditLanguage(template.language);
        setEditTitle(template.name);
        setShowTemplates(false);
    };

    const parseTags = (tags: string): string[] => { try { return JSON.parse(tags) || []; } catch { return []; } };
    const parseHistory = (h: string): { content: string; timestamp: string }[] => { try { return JSON.parse(h) || []; } catch { return []; } };

    // Filtering and Sorting
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
            // Favorites first
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
            {/* Header */}
            <div className="titlebar" style={{ background: 'transparent' }}>
                <div className="title-left">
                    <button onClick={onBack} className="title-btn" title="Back"><ArrowLeft size={18} /></button>
                    <Code2 size={16} style={{ color: 'var(--accent-color)' }} />
                    <span style={{ fontWeight: 600 }}>Snippet Library</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: 8 }}>{snippets.length} snippets</span>
                </div>
                <div className="title-right" style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handlePasteFromClipboard} style={btnStyle()} title="Paste from Clipboard (Ctrl+V)"><Clipboard size={14} /></button>
                    <button onClick={handleImport} style={btnStyle()} title="Import Snippets"><FileUp size={14} /></button>
                    <button onClick={handleExport} style={btnStyle()} title="Export All Snippets"><FileDown size={14} /></button>
                    <button onClick={openNewSnippet} style={{ ...btnStyle(true), padding: '6px 12px', fontWeight: 500 }}>
                        <Plus size={14} /> New
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
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

                {/* Language Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Filter size={12} style={{ opacity: 0.5 }} />
                    <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.75rem' }}>
                        <option value="">All Languages</option>
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                {/* Folder Filter */}
                {folders.length > 0 && (
                    <select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.75rem' }}>
                        <option value="">All Folders</option>
                        {folders.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                )}

                {/* Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.75rem' }}>
                        <option value="updated">Last Modified</option>
                        <option value="created">Date Created</option>
                        <option value="title">Title A-Z</option>
                        <option value="language">Language</option>
                    </select>
                </div>

                {/* Favorites Toggle */}
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
                            <div key={snippet.id} style={{ background: 'var(--bg-card)', borderRadius: 10, marginBottom: 8, border: isExpanded ? '1px solid var(--accent-color)' : '1px solid var(--border-color)', overflow: 'hidden' }}>
                                {/* Header */}
                                <div onClick={() => setExpandedId(isExpanded ? null : snippet.id)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ opacity: 0.5 }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                                    <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(snippet.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Toggle Favorite">
                                        <Star size={14} fill={snippet.favorite ? '#eab308' : 'none'} stroke={snippet.favorite ? '#eab308' : 'currentColor'} />
                                    </button>
                                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: LANGUAGE_COLORS[snippet.language] || '#888', color: 'white', fontWeight: 600, textTransform: 'uppercase' }}>{snippet.language}</span>
                                    {snippet.folder && <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(128,128,128,0.2)', display: 'flex', alignItems: 'center', gap: 2 }}><FolderOpen size={10} />{snippet.folder}</span>}
                                    {tags.slice(0, 2).map((tag, i) => <span key={i} style={{ background: 'rgba(128,128,128,0.15)', padding: '2px 6px', borderRadius: 8, fontSize: '0.6rem' }}>#{tag}</span>)}
                                    {tags.length > 2 && <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>+{tags.length - 2}</span>}
                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{snippet.title || 'Untitled'}</span>
                                </div>

                                {isExpanded && (
                                    <>
                                        {/* Description */}
                                        {snippet.description && <div style={{ padding: '0 14px 10px', fontSize: '0.8rem', opacity: 0.7 }}>{snippet.description}</div>}

                                        {/* Actions */}
                                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(0,0,0,0.1)' }}>
                                            <button onClick={() => copyToClipboard(snippet.content, snippet.id)} style={{ ...btnStyle(copiedId === snippet.id), background: copiedId === snippet.id ? '#22c55e' : undefined }}>
                                                {copiedId === snippet.id ? <Check size={12} /> : <Copy size={12} />} {copiedId === snippet.id ? 'Copied!' : 'Copy'}
                                            </button>
                                            <button onClick={() => openEditSnippet(snippet)} style={btnStyle()}><Edit2 size={12} /> Edit</button>
                                            <button onClick={() => handleDuplicate(snippet.id)} style={btnStyle()}><CopyPlus size={12} /> Duplicate</button>
                                            <button onClick={() => setQrSnippet(snippet)} style={btnStyle()}><QrCode size={12} /> QR</button>
                                            {history.length > 0 && (
                                                <button onClick={() => setShowHistory(!showHistory)} style={btnStyle(showHistory)}><History size={12} /> History ({history.length})</button>
                                            )}
                                            <button onClick={() => handleDelete(snippet.id)} style={{ ...btnStyle(), marginLeft: 'auto', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Trash2 size={12} /> Delete</button>
                                        </div>

                                        {/* Version History */}
                                        {showHistory && history.length > 0 && (
                                            <div style={{ padding: 10, background: 'rgba(0,0,0,0.15)', maxHeight: 150, overflowY: 'auto' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>Version History</div>
                                                {history.map((h, i) => (
                                                    <div key={i} style={{ fontSize: '0.7rem', padding: 4, borderRadius: 4, background: 'rgba(128,128,128,0.1)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{new Date(h.timestamp).toLocaleString()}</span>
                                                        <button onClick={() => { setEditContent(h.content); openEditSnippet(snippet); }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.7rem' }}>Restore</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Code */}
                                        <div style={{ maxHeight: 350, overflow: 'auto' }}>
                                            <SyntaxHighlighter language={snippet.language} style={atomDark} customStyle={{ margin: 0, padding: 14, background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem' }} showLineNumbers lineNumberStyle={{ opacity: 0.4, minWidth: '2.5em' }}>
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
                        {/* Header */}
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{editingSnippet ? 'Edit Snippet' : 'New Snippet'}</h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setShowTemplates(!showTemplates)} style={btnStyle(showTemplates)}>Templates</button>
                                <button onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, color: 'inherit' }}><X size={18} /></button>
                            </div>
                        </div>

                        {/* Templates Dropdown */}
                        {showTemplates && (
                            <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {TEMPLATES.map((t, i) => (
                                    <button key={i} onClick={() => useTemplate(t)} style={btnStyle()}>{t.name}</button>
                                ))}
                            </div>
                        )}

                        {/* Body */}
                        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
                            {/* Row 1: Title + Language */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Title</label>
                                    <input type="text" placeholder="Snippet title..." value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} autoFocus />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Language</label>
                                    <select value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem' }}>
                                        {LANGUAGES.map(l => <option key={l} value={l} style={{ background: 'var(--bg-card)' }}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Tags + Folder */}
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

                            {/* Description */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Description (optional)</label>
                                <input type="text" placeholder="Brief description..." value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
                            </div>

                            {/* Code */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>Code</label>
                                <div style={{ position: 'relative' }}>
                                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="// Paste your code here..." spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', minHeight: 180, padding: '10px 10px 10px 40px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'inherit', fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.8rem', lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
                                    {/* Line numbers overlay */}
                                    <div style={{ position: 'absolute', left: 0, top: 0, padding: '10px 8px', fontSize: '0.8rem', fontFamily: 'Consolas, Monaco, monospace', lineHeight: 1.5, opacity: 0.4, pointerEvents: 'none', userSelect: 'none', borderRight: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                                        {editContent.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={closeModal} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                            <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Save size={14} /> Save (Ctrl+S)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {qrSnippet && (() => {
                const CHUNK = 800;
                const content = qrSnippet.content || '';
                const chunks: string[] = [];
                for (let i = 0; i < content.length; i += CHUNK) chunks.push(content.slice(i, i + CHUNK));
                if (!chunks.length) chunks.push('');
                const total = chunks.length;
                const curr = chunks[qrPage] || '';

                const saveQR = () => {
                    const svg = document.getElementById('qr-code-svg');
                    if (!svg) return;
                    const data = new XMLSerializer().serializeToString(svg);
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
                            ctx.fillText(total > 1 ? `Page ${qrPage + 1}/${total}` : qrSnippet.title || 'Snippet', canvas.width / 2, canvas.height - 15);
                        }
                        const a = document.createElement('a');
                        a.download = `${(qrSnippet.title || 'snippet').replace(/[^a-z0-9]/gi, '_')}_qr${total > 1 ? `_${qrPage + 1}` : ''}.png`;
                        a.href = canvas.toDataURL('image/png');
                        a.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
                };

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setQrSnippet(null); setQrPage(0); }}>
                        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxWidth: 420 }}>
                            <div style={{ marginBottom: 14, fontWeight: 600 }}>{qrSnippet.title || 'Untitled'}</div>
                            {curr ? (
                                <div style={{ background: 'white', padding: 16, borderRadius: 12, display: 'inline-block' }}>
                                    <QRCodeSVG id="qr-code-svg" value={total > 1 ? `[${qrPage + 1}/${total}]${curr}` : curr} size={200} level="L" />
                                </div>
                            ) : <div style={{ padding: 40, opacity: 0.5 }}>Empty</div>}
                            {total > 1 && (
                                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                                    <button disabled={qrPage === 0} onClick={() => setQrPage(p => p - 1)} style={btnStyle()}><ChevronLeft size={14} /> Prev</button>
                                    <span style={{ fontWeight: 600 }}>{qrPage + 1} / {total}</span>
                                    <button disabled={qrPage === total - 1} onClick={() => setQrPage(p => p + 1)} style={btnStyle()}>Next <ChevronRight size={14} /></button>
                                </div>
                            )}
                            {total > 1 && <div style={{ marginTop: 10, fontSize: '0.7rem', opacity: 0.5 }}>📱 Scan all {total} QR codes in order</div>}
                            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
                                <button onClick={saveQR} style={{ ...btnStyle(true), padding: '8px 14px' }}><Download size={14} /> Save</button>
                                <button onClick={() => { setQrSnippet(null); setQrPage(0); }} style={btnStyle()}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SnippetsPage;
