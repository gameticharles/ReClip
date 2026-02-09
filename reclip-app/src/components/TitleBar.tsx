import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import { Palette, Home, Settings, FileCode } from 'lucide-react';

interface TitleBarProps {
    incognitoMode: boolean;
    toggleIncognito: () => void;
    queueMode: boolean;
    toggleQueueMode: () => void;
    pasteQueueLength: number;
    showTimeline: boolean;
    toggleTimeline: () => void;
    currentView: 'main' | 'settings' | 'snippets' | 'colors';
    onOpenMain: () => void;
    onOpenSettings: () => void;
    onOpenSnippets: () => void;
    onOpenColors: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
    incognitoMode,
    toggleIncognito,
    queueMode,
    toggleQueueMode,
    pasteQueueLength,
    showTimeline,
    toggleTimeline,
    currentView,
    onOpenMain,
    onOpenSettings,
    onOpenSnippets,
    onOpenColors
}) => {
    const [version, setVersion] = useState("...");

    useEffect(() => {
        getVersion().then(setVersion);
    }, []);

    const btnStyle = (active: boolean) => ({
        color: active ? 'var(--accent-color)' : undefined,
        background: active ? 'var(--bg-secondary)' : 'transparent',
    });

    return (
        <div
            className="titlebar"
            onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('input') && !target.closest('button')) {
                    getCurrentWindow().startDragging();
                }
            }}
        >
            <div className="title-left">
                <img
                    src="/icon.png"
                    alt="ReClip"
                    style={{ width: '40px', height: '40px', marginRight: '6px', cursor: 'pointer' }}
                    onClick={onOpenMain}
                />
                <span className="app-title" style={{ cursor: 'pointer' }} onClick={onOpenMain}>ReClip</span>
                <span style={{
                    fontSize: '0.7rem',
                    opacity: 0.5,
                    marginLeft: '6px',
                    fontFamily: 'monospace'
                }}>v{version}</span>
            </div>

            <div className="title-center" style={{ display: 'flex', gap: '4px' }}>
                <button
                    onClick={onOpenMain}
                    className={`title-btn ${currentView === 'main' ? 'active' : ''}`}
                    title="Home (Clipboard)"
                    style={btnStyle(currentView === 'main')}
                >
                    <Home size={16} />
                </button>
                <button
                    onClick={onOpenSnippets}
                    className={`title-btn ${currentView === 'snippets' ? 'active' : ''}`}
                    title="Code Snippets"
                    style={btnStyle(currentView === 'snippets')}
                >
                    <FileCode size={16} />
                </button>
                <button
                    onClick={onOpenColors}
                    className={`title-btn ${currentView === 'colors' ? 'active' : ''}`}
                    title="Color Tools"
                    style={btnStyle(currentView === 'colors')}
                >
                    <Palette size={16} />
                </button>
                <button
                    onClick={onOpenSettings}
                    className={`title-btn ${currentView === 'settings' ? 'active' : ''}`}
                    title="Settings"
                    style={btnStyle(currentView === 'settings')}
                >
                    <Settings size={16} />
                </button>
            </div>

            <div className="title-right">
                <button
                    onClick={toggleIncognito}
                    className={`title-btn ${incognitoMode ? 'active' : ''}`}
                    title={incognitoMode ? "Resume Capture" : "Pause Capture (Incognito)"}
                    style={{ color: incognitoMode ? '#f59e0b' : undefined }}
                >
                    {incognitoMode ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                </button>

                <button
                    onClick={toggleQueueMode}
                    className={`title-btn ${queueMode ? 'active' : ''}`}
                    title="Toggle Paste Queue Mode"
                    style={{ color: queueMode ? '#10b981' : undefined, fontWeight: 'bold', position: 'relative' }}
                >
                    Q
                    {queueMode && pasteQueueLength > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '0px',
                            right: '0px',
                            fontSize: '0.6rem',
                            background: '#10b981',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: '10px',
                            lineHeight: 1
                        }}>
                            {pasteQueueLength}
                        </span>
                    )}
                </button>

                <button onClick={toggleTimeline}
                    className={`title-btn ${showTimeline ? 'active' : ''}`}
                    title="Toggle Timeline View"
                    style={{ color: showTimeline ? 'var(--accent-color)' : undefined }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </button>

                <button onClick={() => getCurrentWindow().hide()} className="title-btn" title="Hide">✕</button>
            </div>
        </div>
    );
};

export default TitleBar;

