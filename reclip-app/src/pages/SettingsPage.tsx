import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

interface SettingsPageProps {
    onBack: () => void;
    compactMode: boolean;
    setCompactMode: (enabled: boolean) => void;
    theme: string;
    setTheme: (theme: string) => void;
    useSystemAccent: boolean;
    setUseSystemAccent: (enabled: boolean) => void;
}

export default function SettingsPage({
    onBack,
    compactMode,
    setCompactMode,
    theme,
    setTheme,
    useSystemAccent,
    setUseSystemAccent
}: SettingsPageProps) {
    const [activeTab, setActiveTab] = useState('general');
    const [alwaysOnTop, setAlwaysOnTop] = useState(false);
    const [opacity, setOpacity] = useState(100);
    const [retainDays, setRetainDays] = useState(30);
    const [maxClips, setMaxClips] = useState(10000);
    const [exportStatus, setExportStatus] = useState("");
    const [privacyRules, setPrivacyRules] = useState<any[]>([]);
    const [shortcuts, setShortcuts] = useState<{ [key: string]: string }>({});
    const [recordingAction, setRecordingAction] = useState<string | null>(null);
    // ... privacy states
    const [newIgnoreApp, setNewIgnoreApp] = useState("");
    const [newRegex, setNewRegex] = useState("");

    // Templates
    const [templates, setTemplates] = useState<any[]>([]);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [newTemplateContent, setNewTemplateContent] = useState("");
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

    // Startup & Window Position
    const [autostart, setAutostart] = useState(false);
    const [rememberPosition, setRememberPosition] = useState(localStorage.getItem('rememberWindowPosition') === 'true');

    const fetchTemplates = async () => {
        try {
            const t = await invoke<any[]>("get_templates");
            setTemplates(t);
        } catch (e) { console.error(e); }
    };

    const saveTemplate = async () => {
        if (!newTemplateName.trim() || !newTemplateContent.trim()) return;
        try {
            if (editingTemplate) {
                await invoke("update_template", { id: editingTemplate.id, name: newTemplateName, content: newTemplateContent });
                setEditingTemplate(null);
            } else {
                await invoke("add_template", { name: newTemplateName, content: newTemplateContent });
            }
            setNewTemplateName("");
            setNewTemplateContent("");
            fetchTemplates();
        } catch (e) { console.error(e); }
    };

    const deleteTemplate = async (id: number) => {
        if (!confirm("Delete template?")) return;
        try {
            await invoke("delete_template", { id });
            fetchTemplates();
        } catch (e) { console.error(e); }
    };

    const startEditTemplate = (t: any) => {
        setEditingTemplate(t);
        setNewTemplateName(t.name);
        setNewTemplateContent(t.content);
    };

    const cancelEditTemplate = () => {
        setEditingTemplate(null);
        setNewTemplateName("");
        setNewTemplateContent("");
    };

    const fetchPrivacyRules = async () => {
        try {
            const rules = await invoke<any[]>("get_privacy_rules");
            setPrivacyRules(rules);
        } catch (e) {
            console.error("Failed to fetch privacy rules", e);
        }
    };

    const fetchShortcuts = async () => {
        try {
            const s = await invoke<{ [key: string]: string }>("get_shortcuts");
            setShortcuts(s);
        } catch (e) {
            console.error("Failed to fetch shortcuts", e);
        }
    };

    const handleRecordClick = (action: string) => {
        setRecordingAction(action);
    };

    const handleKeyDown = async (e: React.KeyboardEvent, action: string) => {
        e.preventDefault();
        e.stopPropagation();

        const modifiers = [];
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.altKey) modifiers.push('Alt');
        if (e.metaKey) modifiers.push('Super');

        let key = e.key.toUpperCase();

        // Use code for Digits to handle Shift correctly (e.g. Shift+1 should be Shift+1, not !)
        if (e.code.startsWith('Digit')) {
            key = e.code.replace('Digit', '');
        }

        if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return; // Just modifier pressed

        // Map common keys if needed, or use key directly
        if (key === ' ') key = 'SPACE';

        const shortcut = [...modifiers, key].join('+');

        try {
            await invoke("update_shortcut", { action, newShortcut: shortcut });
            setRecordingAction(null);
            fetchShortcuts();
        } catch (err) {
            console.error(err);
            setRecordingAction(null); // Simple error handling
            alert("Failed to set shortcut: " + err);
        }
    };

    useEffect(() => {
        if (activeTab === 'security') fetchPrivacyRules();
        if (activeTab === 'shortcuts') fetchShortcuts();
        if (activeTab === 'templates') fetchTemplates();
        if (activeTab === 'general') {
            // Fetch autostart status
            invoke<boolean>("get_autostart").then(setAutostart).catch(console.error);
        }
    }, [activeTab]);

    const handleAddRule = async (type: string, value: string) => {
        if (!value.trim()) return;
        try {
            await invoke("add_privacy_rule", { ruleType: type, value: value.trim() });
            fetchPrivacyRules();
            if (type === 'APP_IGNORE') setNewIgnoreApp("");
            if (type === 'REGEX_MASK') setNewRegex("");
        } catch (e) {
            console.error("Failed to add rule", e);
        }
    };

    const handleDeleteRule = async (id: number) => {
        try {
            await invoke("delete_privacy_rule", { id });
            fetchPrivacyRules();
        } catch (e) {
            console.error("Failed to delete rule", e);
        }
    };

    useEffect(() => {
        const savedAlwaysOnTop = localStorage.getItem("alwaysOnTop");
        if (savedAlwaysOnTop === "true") {
            setAlwaysOnTop(true);
            getCurrentWindow().setAlwaysOnTop(true);
        }

        const savedOpacity = localStorage.getItem("opacity");
        if (savedOpacity) {
            setOpacity(parseInt(savedOpacity));
        }

        const savedDays = localStorage.getItem("retainDays");
        if (savedDays) setRetainDays(parseInt(savedDays));

        const savedMax = localStorage.getItem("maxClips");
        if (savedMax) setMaxClips(parseInt(savedMax));
    }, []);

    const toggleAlwaysOnTop = async () => {
        const newState = !alwaysOnTop;
        setAlwaysOnTop(newState);
        localStorage.setItem("alwaysOnTop", newState.toString());
        await getCurrentWindow().setAlwaysOnTop(newState);
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        setOpacity(value);
        localStorage.setItem("opacity", value.toString());
        document.documentElement.style.setProperty('--window-opacity', `${value / 100}`);
    };

    const handleMaintenanceChange = async () => {
        localStorage.setItem("retainDays", retainDays.toString());
        localStorage.setItem("maxClips", maxClips.toString());
        try {
            await invoke("run_maintenance", { days: retainDays, maxClips: maxClips });
        } catch (e) {
            console.error("Maintenance failed", e);
        }
    };

    const handleExport = async () => {
        try {
            const filePath = await save({
                defaultPath: `reclip-backup-${new Date().toISOString().split('T')[0]}.zip`,
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
            });
            if (filePath) {
                setExportStatus("Exporting...");
                const result = await invoke<string>("export_clips", { exportPath: filePath });
                setExportStatus(result);
                setTimeout(() => setExportStatus(""), 3000);
            }
        } catch (e) {
            setExportStatus(`Export failed: ${e}`);
        }
    };

    const handleImport = async () => {
        try {
            const filePath = await open({
                filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
                multiple: false
            });
            if (filePath) {
                setExportStatus("Importing...");
                const result = await invoke<string>("import_clips", { importPath: filePath });
                setExportStatus(result + " - Restart app");
                setTimeout(() => setExportStatus(""), 5000);
            }
        } catch (e) {
            setExportStatus(`Import failed: ${e}`);
        }
    };


    const tabs = [
        { id: 'general', label: 'General', icon: '⚙️' },
        { id: 'interface', label: 'Interface', icon: '🎨' },
        { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
        { id: 'security', label: 'Security', icon: '🔒' },
        { id: 'templates', label: 'Templates', icon: '📝' },
        { id: 'maintenance', label: 'Maintenance', icon: '🧹' },
        { id: 'backup', label: 'Backup', icon: '💾' }
    ];

    return (
        <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app, transparent)' }}>
            {/* Settings Title Bar */}
            <div
                className="titlebar"
                onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('button')) getCurrentWindow().startDragging();
                }}
                style={{ paddingLeft: '80px', position: 'relative' }} // Space for back button
            >
                <button
                    onClick={onBack}
                    className="title-btn"
                    style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.9rem', fontWeight: 600 }}
                    title="Back to Clips"
                >
                    <span>←</span> Back
                </button>
                <div style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>Settings</div>

                {/* Window Controls */}
                <div className="title-right">
                    <button onClick={() => getCurrentWindow().hide()} className="title-btn" title="Hide">✕</button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar */}
                <div style={{ width: '200px', padding: '20px 0', borderRight: '1px solid rgba(128,128,128,0.1)', background: 'rgba(128,128,128,0.02)' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                width: '100%',
                                padding: '12px 24px',
                                border: 'none',
                                background: activeTab === tab.id ? 'var(--accent-color, #4f46e5)' : 'transparent',
                                color: activeTab === tab.id ? 'white' : 'inherit',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.95rem',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                transition: 'all 0.2s',
                                opacity: activeTab === tab.id ? 1 : 0.7
                            }}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                    {activeTab === 'general' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>General Settings</h2>
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Always on Top</span>
                                    <input
                                        type="checkbox"
                                        checked={alwaysOnTop}
                                        onChange={toggleAlwaysOnTop}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                            </div>
                            {/* Auto Start Todo */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Start on System Startup (Coming Soon)</span>
                                    <input
                                        type="checkbox"
                                        disabled
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'interface' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Interface customization</h2>
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Window Opacity ({opacity}%)</label>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={opacity}
                                    onChange={handleOpacityChange}
                                    style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                                />
                            </div>

                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Date Display Format</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="dateFormat"
                                            value="relative"
                                            checked={localStorage.getItem('dateFormat') !== 'absolute'}
                                            onChange={() => { localStorage.setItem('dateFormat', 'relative'); window.location.reload(); }}
                                        /> Relative (e.g. 5m ago)
                                    </label>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="dateFormat"
                                            value="absolute"
                                            checked={localStorage.getItem('dateFormat') === 'absolute'}
                                            onChange={() => { localStorage.setItem('dateFormat', 'absolute'); window.location.reload(); }}
                                        /> Absolute (Date & Time)
                                    </label>
                                </div>
                            </div>

                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Auto-Hide Window</label>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>Automatically hide window after inactivity.</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        max="600"
                                        defaultValue={localStorage.getItem('autoHideDuration') || "0"}
                                        onChange={(e) => {
                                            localStorage.setItem('autoHideDuration', e.target.value);
                                        }}
                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #444' }}
                                    />
                                    <span>seconds (0 to disable)</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '4px' }}>Note: Requires restart or reload to take effect fully.</p>
                            </div>

                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={autostart}
                                        onChange={async (e) => {
                                            try {
                                                await invoke("set_autostart", { enabled: e.target.checked });
                                                setAutostart(e.target.checked);
                                            } catch (err) {
                                                console.error("Failed to set autostart:", err);
                                            }
                                        }}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 600 }}>Launch on System Startup</span>
                                </label>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px', marginLeft: '28px' }}>Automatically start ReClip when you log in.</p>
                            </div>

                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={rememberPosition}
                                        onChange={(e) => {
                                            setRememberPosition(e.target.checked);
                                            localStorage.setItem('rememberWindowPosition', e.target.checked ? 'true' : 'false');
                                        }}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <span style={{ fontWeight: 600 }}>Remember Window Position</span>
                                </label>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px', marginLeft: '28px' }}>Restore window position and size on launch.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Click on a shortcut to record a new key combination.</p>

                            {/* Show Window */}
                            <div className="setting-item" style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Show / Hide ReClip</label>
                                <div
                                    className="shortcut-input"
                                    onClick={() => handleRecordClick('show_window')}
                                    onKeyDown={(e) => recordingAction === 'show_window' && handleKeyDown(e, 'show_window')}
                                    tabIndex={0}
                                    style={{
                                        padding: '12px',
                                        background: recordingAction === 'show_window' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                        color: recordingAction === 'show_window' ? 'white' : 'inherit',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(128,128,128,0.2)',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        outline: 'none',
                                        userSelect: 'none'
                                    }}
                                >
                                    {recordingAction === 'show_window' ? 'Press keys...' : (shortcuts['show_window'] || 'Not Set')}
                                </div>
                            </div>

                            {/* Incognito */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Toggle Incognito Mode</label>
                                <div
                                    className="shortcut-input"
                                    onClick={() => handleRecordClick('incognito')}
                                    onKeyDown={(e) => recordingAction === 'incognito' && handleKeyDown(e, 'incognito')}
                                    tabIndex={0}
                                    style={{
                                        padding: '12px',
                                        background: recordingAction === 'incognito' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                        color: recordingAction === 'incognito' ? 'white' : 'inherit',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(128,128,128,0.2)',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        outline: 'none',
                                        userSelect: 'none'
                                    }}
                                >
                                    {recordingAction === 'incognito' ? 'Press keys...' : (shortcuts['incognito'] || 'Not Set')}
                                </div>
                            </div>

                            {/* Paste Next */}
                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Paste Next in Queue</label>
                                <div
                                    className="shortcut-input"
                                    onClick={() => handleRecordClick('paste_next')}
                                    onKeyDown={(e) => recordingAction === 'paste_next' && handleKeyDown(e, 'paste_next')}
                                    tabIndex={0}
                                    style={{
                                        padding: '12px',
                                        background: recordingAction === 'paste_next' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                        color: recordingAction === 'paste_next' ? 'white' : 'inherit',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(128,128,128,0.2)',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        outline: 'none',
                                        userSelect: 'none'
                                    }}
                                >
                                    {recordingAction === 'paste_next' ? 'Press keys...' : (shortcuts['paste_next'] || 'Not Set')}
                                </div>
                            </div>

                            {/* Paste 1-9 */}
                            <h3 style={{ fontSize: '0.9rem', marginTop: '24px', marginBottom: '12px' }}>Paste Specific Clip (1-9)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                {Array.from({ length: 9 }).map((_, i) => {
                                    const num = i + 1;
                                    const action = `paste_${num}`;
                                    return (
                                        <div key={action} className="setting-item" style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem' }}>Pos {num}</label>
                                            <div
                                                className="shortcut-input"
                                                onClick={() => handleRecordClick(action)}
                                                onKeyDown={(e) => recordingAction === action && handleKeyDown(e, action)}
                                                tabIndex={0}
                                                style={{
                                                    padding: '8px',
                                                    background: recordingAction === action ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                                    color: recordingAction === action ? 'white' : 'inherit',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(128,128,128,0.2)',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    fontWeight: 600,
                                                    fontSize: '0.8rem',
                                                    outline: 'none',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                {recordingAction === action ? '...' : (shortcuts[action] || `Ctrl+${num}`)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Security & Privacy</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Manage ignored applications and content filtering.</p>

                            <div className="setting-item">
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Ignored Apps</h3>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="App Name or Window Title (e.g., Notepad)"
                                        value={newIgnoreApp}
                                        onChange={(e) => setNewIgnoreApp(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(255,255,255,0.1)' }}
                                    />
                                    <button
                                        onClick={() => handleAddRule('APP_IGNORE', newIgnoreApp)}
                                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-color, #4f46e5)', color: 'white', cursor: 'pointer' }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', padding: '8px' }}>
                                    {privacyRules.filter(r => r.rule_type === 'APP_IGNORE').length === 0 && <p style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>No ignored apps.</p>}
                                    {privacyRules.filter(r => r.rule_type === 'APP_IGNORE').map(r => (
                                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{r.value}</span>
                                            <button onClick={() => handleDeleteRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="setting-item" style={{ marginTop: '24px' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Privacy Filters (Regex)</h3>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="Regex Pattern (e.g., ^password.*)"
                                        value={newRegex}
                                        onChange={(e) => setNewRegex(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(255,255,255,0.1)' }}
                                    />
                                    <button
                                        onClick={() => handleAddRule('REGEX_MASK', newRegex)}
                                        style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-color, #4f46e5)', color: 'white', cursor: 'pointer' }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                                    {/* Presets */}
                                    <button onClick={() => setNewRegex('^password.*')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', cursor: 'pointer' }}>Password Preset</button>
                                    <button onClick={() => setNewRegex('\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', cursor: 'pointer' }}>Credit Card Preset</button>
                                </div>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', padding: '8px' }}>
                                    {privacyRules.filter(r => r.rule_type === 'REGEX_MASK').length === 0 && <p style={{ opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>No privacy filters.</p>}
                                    {privacyRules.filter(r => r.rule_type === 'REGEX_MASK').map(r => (
                                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
                                            <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{r.value}</span>
                                            <button onClick={() => handleDeleteRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'interface' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Interface</h2>
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} />
                                    Compact Mode
                                </label>
                            </div>

                            <div className="setting-item" style={{ marginTop: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Theme</label>
                                <div style={{ display: 'flex', gap: '8px', maxWidth: '300px' }}>
                                    {['light', 'dark', 'system'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTheme(t)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(128,128,128,0.2)',
                                                background: theme === t ? 'var(--accent-color, #4f46e5)' : 'transparent',
                                                color: theme === t ? 'white' : 'inherit',
                                                cursor: 'pointer',
                                                textTransform: 'capitalize'
                                            }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="setting-item" style={{ marginTop: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useSystemAccent} onChange={(e) => setUseSystemAccent(e.target.checked)} />
                                    Adaptive System Accent
                                </label>
                            </div>

                            <div className="setting-item" style={{ marginTop: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Window Opacity: {opacity}%</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    value={opacity}
                                    onChange={handleOpacityChange}
                                    style={{ width: '100%', maxWidth: '300px' }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'maintenance' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Maintenance</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Configure automatic cleanup of old clips.</p>

                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px' }}>Delete older than (days):</label>
                                <input
                                    type="number"
                                    value={retainDays}
                                    onChange={(e) => setRetainDays(parseInt(e.target.value))}
                                    onBlur={handleMaintenanceChange}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(255,255,255,0.1)' }}
                                />
                            </div>

                            <div className="setting-item" style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px' }}>Soft Limit (Max Clips):</label>
                                <input
                                    type="number"
                                    value={maxClips}
                                    onChange={(e) => setMaxClips(parseInt(e.target.value))}
                                    onBlur={handleMaintenanceChange}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.2)', background: 'rgba(255,255,255,0.1)' }}
                                />
                            </div>

                            <div className="setting-item" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,0,0,0.2)', paddingTop: '24px' }}>
                                <h3 style={{ color: '#ef4444', marginTop: 0, fontSize: '0.9rem' }}>Danger Zone</h3>
                                <button
                                    onClick={async () => {
                                        if (await window.confirm("Are you sure you want to delete ALL clips? This cannot be undone.")) {
                                            try {
                                                await invoke("clear_clips");
                                                window.alert("Database cleared successfully.");
                                            } catch (e) {
                                                console.error(e);
                                                window.alert("Failed to clear database.");
                                            }
                                        }
                                    }}
                                    style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        color: '#ef4444',
                                        border: '1px solid #ef4444',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    🗑️ Clear Entire Database
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'backup' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Backup & Restore</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Export your clips to a ZIP archive or restore from a backup.</p>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={handleExport}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'var(--accent-color, #4f46e5)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    📤 Export Clips
                                </button>
                                <button
                                    onClick={handleImport}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--accent-color, #4f46e5)',
                                        background: 'transparent',
                                        color: 'var(--accent-color, #4f46e5)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    📥 Import Backup
                                </button>
                            </div>
                            {exportStatus && (
                                <p style={{ marginTop: '16px', opacity: 0.8 }}>{exportStatus}</p>
                            )}
                        </div>
                    )}
                </div>
                {activeTab === 'templates' && (
                    <div className="settings-content" style={{ padding: '30px', overflowY: 'auto' }}>
                        <h2>Templates</h2>
                        <p style={{ opacity: 0.7, marginBottom: '20px' }}>Create reusable clips with placeholders (e.g. <code>{"{{name}}"}</code>).</p>

                        <div style={{ background: 'rgba(128,128,128,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                            <h3 style={{ marginTop: 0 }}>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <input
                                    type="text"
                                    placeholder="Template Name"
                                    value={newTemplateName}
                                    onChange={e => setNewTemplateName(e.target.value)}
                                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit' }}
                                />
                            </div>
                            <textarea
                                placeholder="Content (use {{placeholder}} for dynamic values)"
                                value={newTemplateContent}
                                onChange={e => setNewTemplateContent(e.target.value)}
                                style={{ width: '100%', height: '100px', padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit', marginBottom: '10px', fontFamily: 'monospace' }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={saveTemplate} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    {editingTemplate ? 'Update' : 'Add Template'}
                                </button>
                                {editingTemplate && (
                                    <button onClick={cancelEditTemplate} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid currentColor', borderRadius: '4px', cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="template-list">
                            {templates.map(t => (
                                <div key={t.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.7, whiteSpace: 'pre-wrap', maxHeight: '50px', overflow: 'hidden' }}>{t.content}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => startEditTemplate(t)} className="icon-btn">✏️</button>
                                        <button onClick={() => deleteTemplate(t.id)} className="icon-btn">🗑️</button>
                                    </div>
                                </div>
                            ))}
                            {templates.length === 0 && <p style={{ opacity: 0.5, fontStyle: 'italic' }}>No templates yet.</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
