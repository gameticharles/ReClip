import React, { SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Draggable, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Clip } from '../types';
import ClipContent, { ImageMetadata, ImageColorPalette } from './ClipContent';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import UrlPreview from './UrlPreview';
import './ClipCard.css';

interface ClipCardProps {
    clip: Clip;
    index: number;
    selectedIndex: number;
    selectedClipIds: Set<number>;
    compactMode: boolean;
    shortcuts: Record<string, string>;
    isDark: boolean;
    extractingOcrClipId: number | null;
    activeMenuId: number | null;
    rawViewClipIds: Set<number>;
    showTooltipPreview: boolean;
    formatTime: (dateStr: string) => string;
    onClipClick: (e: React.MouseEvent, clip: Clip) => void;
    onMouseEnter: () => void;
    toggleFavorite: (e: React.MouseEvent, id: number) => void;
    togglePin: (e: React.MouseEvent, id: number) => void;
    moveToTop: (e: React.MouseEvent, id: number) => void;
    setActiveMenuId: (id: number | null) => void;
    handleExtractText: (e: React.MouseEvent, clip: Clip) => void;
    onEditContent: (clip: Clip) => void;
    onDelete: (e: React.MouseEvent, id: number) => void;
    onTagClick: (tag: string) => void;
    onAddTag: (e: React.MouseEvent, id: number, tags: string | null) => void;
    onTransform: (e: React.MouseEvent, id: number, type: 'upper' | 'lower' | 'title' | 'trim') => void;
    onZoom: (src: string) => void;
    isUrl: (text: string) => boolean;
    isColorCode: (text: string) => boolean;
    menuRef: React.RefObject<HTMLDivElement | null>;
    onSaveImage: (clip: Clip) => void;
    onCopyAsText: (clip: Clip) => void;
    onShowQRCode: (content: string) => void;
    onEditImage: (src: string, id?: number) => void;
    setRawViewClipIds: React.Dispatch<SetStateAction<Set<number>>>;
}

export const ClipCard: React.FC<ClipCardProps> = ({
    clip, index, selectedIndex, selectedClipIds, compactMode, shortcuts,
    isDark, extractingOcrClipId, activeMenuId, rawViewClipIds,
    showTooltipPreview, formatTime, onClipClick, onMouseEnter,
    toggleFavorite, togglePin, moveToTop, setActiveMenuId,
    handleExtractText, onEditContent, onDelete, onTagClick, onAddTag,
    onTransform, onZoom, isUrl, isColorCode, menuRef, onSaveImage,
    onCopyAsText, onShowQRCode, onEditImage, setRawViewClipIds
}) => {
    return (
        <Draggable draggableId={clip.id.toString()} index={index}>
            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{ ...provided.draggableProps.style }}
                >
                    <motion.div
                        className={`clip-card ${selectedIndex === index ? 'selected' : ''} ${selectedClipIds.has(clip.id) ? 'multi-selected' : ''} ${clip.pinned ? 'pinned' : ''}`}
                        onClick={(e) => onClipClick(e, clip)}
                        onMouseEnter={onMouseEnter}
                        layout
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            boxShadow: snapshot.isDragging ? "0 10px 30px rgba(0,0,0,0.3)" : undefined,
                            background: snapshot.isDragging ? "var(--bg-card)" : undefined
                        }}
                    >
                        <div className="clip-header">
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {index < 9 && (
                                    <span
                                        title={`Shortcut: ${shortcuts[`paste_${index + 1}`] || `Ctrl+${index + 1}`}`}
                                        style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold',
                                            color: compactMode ? '#888' : '#aaa',
                                            background: 'rgba(0,0,0,0.05)',
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            borderRadius: '4px',
                                            padding: '0 4px',
                                            minWidth: '1.2em',
                                            textAlign: 'center',
                                            cursor: 'help'
                                        }}>
                                        {index + 1}
                                    </span>
                                )}
                                <span className="clip-type">{clip.type}</span>
                                {clip.sender_app && (
                                    <span
                                        title={`Copied from ${clip.sender_app}`}
                                        style={{
                                            fontSize: '0.65rem',
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: 'var(--accent-color, #6366f1)',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: 500,
                                            maxWidth: '120px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {clip.sender_app}
                                    </span>
                                )}
                                {clip.sensitive && (
                                    <span
                                        title="Sensitive - Auto-deletes in 30 seconds"
                                        style={{
                                            fontSize: '0.65rem',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#dc2626',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                    >
                                        🔐 Sensitive
                                    </span>
                                )}
                                {clip.tags && JSON.parse(clip.tags).map((tag: string) => (
                                    <span
                                        key={tag}
                                        className="clip-tag"
                                        style={{
                                            fontSize: '0.85rem',
                                            background: 'rgba(67, 56, 202, 0.1)',
                                            color: '#4338ca',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                        onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                                        title={`Filter by ${tag}`}
                                    >
                                        {tag}
                                    </span>
                                ))}
                                <button
                                    className="add-tag-btn"
                                    onClick={(e) => onAddTag(e, clip.id, clip.tags || null)}
                                    title="Add tag"
                                    style={{
                                        fontSize: '0.85rem',
                                        padding: '2px 6px',
                                        borderRadius: '12px',
                                        border: '1px dashed #aaa',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: '#888'
                                    }}
                                >
                                    + tag
                                </button>
                                {clip.type === 'image' && (
                                    <ImageMetadata filePath={clip.content} isCompact={compactMode} />
                                )}
                                {clip.type === 'text' && (
                                    <div className="transform-actions" style={{ display: 'flex', gap: '2px', opacity: selectedIndex === index ? 1 : 0, transition: 'opacity 0.2s', marginLeft: 'auto' }}>
                                        <button onClick={(e) => onTransform(e, clip.id, 'upper')} title="UPPERCASE" className="icon-btn">TT</button>
                                        <button onClick={(e) => onTransform(e, clip.id, 'lower')} title="lowercase" className="icon-btn">tt</button>
                                        <button onClick={(e) => onTransform(e, clip.id, 'title')} title="Title Case" className="icon-btn">Tt</button>
                                        <button onClick={(e) => onTransform(e, clip.id, 'trim')} title="Trim Whitespace" className="icon-btn">Tr</button>
                                    </div>
                                )}
                            </div>
                            <div className="header-right">
                                <button
                                    className={`fav-btn ${clip.favorite ? 'active' : ''}`}
                                    onClick={(e) => toggleFavorite(e, clip.id)}
                                    title={clip.favorite ? "Unfavorite" : "Favorite"}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                >
                                    {clip.favorite ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                    )}
                                </button>
                                <button
                                    className={`pin-btn ${clip.pinned ? 'active' : ''}`}
                                    onClick={(e) => togglePin(e, clip.id)}
                                    title={clip.pinned ? "Unpin" : "Pin"}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill={clip.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                </button>
                                {(clip.pinned || clip.favorite) && (
                                    <button
                                        className="icon-btn"
                                        onClick={(e) => moveToTop(e, clip.id)}
                                        title="Move to Top"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', opacity: 0.6 }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="18 15 12 9 6 15"></polyline>
                                            <line x1="12" y1="9" x2="12" y2="21"></line>
                                            <line x1="4" y1="3" x2="20" y2="3"></line>
                                        </svg>
                                    </button>
                                )}

                                <span className="clip-date" title={clip.created_at}>{formatTime(clip.created_at)}</span>

                                <div style={{ position: 'relative' }}>
                                    <button
                                        className={`icon-btn menu-btn ${activeMenuId === clip.id ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === clip.id ? null : clip.id); }}
                                        title="More Options"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                    </button>

                                    {activeMenuId === clip.id && (
                                        <div
                                            ref={menuRef}
                                            className="clip-menu-dropdown"
                                            style={{
                                                position: 'absolute', top: '100%', right: 0,
                                                background: 'var(--bg-card)',
                                                border: '1px solid rgba(128,128,128,0.2)',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                zIndex: 100, overflow: 'hidden', minWidth: '140px',
                                                backdropFilter: 'blur(10px)'
                                            }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {clip.type === 'image' && (
                                                <>
                                                    <button
                                                        className="menu-item-btn"
                                                        onClick={(e) => handleExtractText(e, clip)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                    >
                                                        👁️ View Extracted Text
                                                    </button>
                                                    <button
                                                        className="menu-item-btn"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                // Reusing the extract logic but copying to clipboard directly
                                                                const text = await invoke<string>("extract_text", { imagePath: clip.content });
                                                                if (text && text.trim()) {
                                                                    await invoke('copy_to_system', { content: text.trim() });
                                                                    setActiveMenuId(null);
                                                                }
                                                            } catch (err) {
                                                                console.error("Failed to copy text from image:", err);
                                                            }
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                    >
                                                        📋 Copy Text from Image
                                                    </button>
                                                    <button
                                                        className="menu-item-btn"
                                                        onClick={() => onSaveImage(clip)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                    >
                                                        💾 Save As...
                                                    </button>
                                                </>
                                            )}
                                            {clip.type === 'text' && (
                                                <>
                                                    <button
                                                        className="menu-item-btn"
                                                        onClick={() => {
                                                            setRawViewClipIds(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(clip.id)) {
                                                                    next.delete(clip.id);
                                                                } else {
                                                                    next.add(clip.id);
                                                                }
                                                                return next;
                                                            });
                                                            setActiveMenuId(null);
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                    >
                                                        {rawViewClipIds.has(clip.id) ? '✨ Formatted View' : '📝 Raw View'}
                                                    </button>
                                                    <button
                                                        className="menu-item-btn"
                                                        onClick={() => onEditContent(clip)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                    >
                                                        ✏️ Edit Content
                                                    </button>
                                                </>
                                            )}
                                            {clip.type === 'html' && (
                                                <button
                                                    className="menu-item-btn"
                                                    onClick={() => onCopyAsText(clip)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                                >
                                                    📋 Copy as Text
                                                </button>
                                            )}
                                            <button
                                                className="menu-item-btn"
                                                onClick={() => onShowQRCode(clip.content)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', fontSize: '0.9rem' }}
                                            >
                                                📱 QR Code
                                            </button>
                                            <button
                                                className="menu-item-btn delete-btn"
                                                onClick={(e) => onDelete(e, clip.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem' }}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Image Color Palette Row */}
                        {
                            clip.type === 'image' && !compactMode && (
                                <div style={{ padding: '4px 12px', borderTop: '1px solid var(--border-color, rgba(128,128,128,0.1))' }}>
                                    <ImageColorPalette src={convertFileSrc(clip.content)} isCompact={compactMode} />
                                </div>
                            )
                        }
                        <div className="clip-content">
                            {clip.type === 'text' && isColorCode(clip.content) ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '6px',
                                        backgroundColor: clip.content,
                                        border: '2px solid rgba(0,0,0,0.25)',
                                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)'
                                    }} />
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{clip.content}</span>
                                </div>
                            ) : (
                                <div
                                    className="clip-content-wrapper"
                                    title={showTooltipPreview && clip.type !== 'image' && clip.type !== 'file' ? clip.content.slice(0, 500) + (clip.content.length > 500 ? '...' : '') : undefined}
                                    style={{ cursor: showTooltipPreview && clip.type !== 'image' ? 'help' : 'default' }}
                                >
                                    <ClipContent
                                        content={clip.content}
                                        type={clip.type}
                                        isCompact={compactMode}
                                        showRaw={rawViewClipIds.has(clip.id)}
                                        isDark={isDark}
                                        isExtracting={extractingOcrClipId === clip.id}
                                        onZoom={onZoom}
                                        onEditImage={onEditImage}
                                        clipId={clip.id}
                                    />
                                    {clip.type === 'text' && isUrl(clip.content) && <UrlPreview url={clip.content} />}
                                </div>
                            )}
                        </div>
                    </motion.div >
                </div >
            )}
        </Draggable >
    );
};
