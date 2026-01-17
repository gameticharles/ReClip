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
    const [newIgnoreApp, setNewIgnoreApp] = useState("");
    const [newRegex, setNewRegex] = useState("");

    const fetchPrivacyRules = async () => {
        try {
            const rules = await invoke<any[]>("get_privacy_rules");
            setPrivacyRules(rules);
        } catch (e) {
            console.error("Failed to fetch privacy rules", e);
        }
    };

    useEffect(() => {
        if (activeTab === 'security') {
            fetchPrivacyRules();
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
        { id: 'security', label: 'Security', icon: '🔒' },
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
                            <h2 style={{ marginTop: 0 }}>General</h2>
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={alwaysOnTop}
                                        onChange={toggleAlwaysOnTop}
                                    />
                                    Always on Top
                                </label>
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
            </div>
        </div>
    );
}
