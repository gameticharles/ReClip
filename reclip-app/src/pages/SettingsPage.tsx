import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { THEMES } from "../utils/themes";
import { LANGUAGES } from "../utils/languages";
import { getVersion } from '@tauri-apps/api/app';

interface SettingsPageProps {
    onBack: () => void;
    compactMode: boolean;
    setCompactMode: (enabled: boolean) => void;
    theme: string;
    setTheme: (theme: string) => void;
    useSystemAccent: boolean;
    setUseSystemAccent: (enabled: boolean) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

export default function SettingsPage({
    onBack,
    compactMode,
    setCompactMode,
    theme,
    setTheme,
    useSystemAccent,
    setUseSystemAccent,
    accentColor,
    setAccentColor
}: SettingsPageProps) {
    const [activeTab, setActiveTab] = useState('interface');
    const [alwaysOnTop, setAlwaysOnTop] = useState(false);
    const [opacity, setOpacity] = useState(100);
    const [retainDays, setRetainDays] = useState(30);
    const [maxClips, setMaxClips] = useState(10000);
    const [ageEnabled, setAgeEnabled] = useState(() => localStorage.getItem('maintenanceAgeEnabled') === 'true');
    const [limitEnabled, setLimitEnabled] = useState(() => localStorage.getItem('maintenanceLimitEnabled') === 'true');
    const [sensitiveAutoDelete, setSensitiveAutoDelete] = useState(() => localStorage.getItem('sensitiveAutoDelete') !== 'false');
    const [sensitiveTimer, setSensitiveTimer] = useState(() => localStorage.getItem('sensitiveDeleteTimer') || '30');
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

    // Snippet Settings
    const [snippetFontSize, setSnippetFontSize] = useState(() => parseInt(localStorage.getItem('snippetFontSize') || '14'));
    const [snippetTabSize, setSnippetTabSize] = useState(() => parseInt(localStorage.getItem('snippetTabSize') || '4'));
    const [snippetWordWrap, setSnippetWordWrap] = useState(() => localStorage.getItem('snippetWordWrap') === 'true');
    const [snippetLineNumbers, setSnippetLineNumbers] = useState(() => localStorage.getItem('snippetLineNumbers') !== 'false');
    const [snippetDefaultLanguage, setSnippetDefaultLanguage] = useState(() => localStorage.getItem('snippetDefaultLanguage') || 'plaintext');
    const [snippetThemeLight, setSnippetThemeLight] = useState(() => localStorage.getItem('snippetThemeLight') || 'oneLight');
    const [snippetThemeDark, setSnippetThemeDark] = useState(() => localStorage.getItem('snippetThemeDark') || 'atomDark');

    // Automations
    const [regexRules, setRegexRules] = useState<any[]>([]);
    const [newAutoPattern, setNewAutoPattern] = useState("");
    const [newAutoAction, setNewAutoAction] = useState("open_url");
    const [newAutoPayload, setNewAutoPayload] = useState("");

    // Startup & Window Position
    const [autostart, setAutostart] = useState(false);

    const [rememberPosition, setRememberPosition] = useState(localStorage.getItem('rememberWindowPosition') === 'true');

    // Updates
    const [updateInfo, setUpdateInfo] = useState<any | null>(null);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error'>('idle');
    const [updateError, setUpdateError] = useState("");
    const [appVersion, setAppVersion] = useState("...");

    // Custom Colors - load from localStorage on mount
    const [customColors, setCustomColors] = useState(() => {
        const saved = localStorage.getItem('customColors');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch { /* ignore */ }
        }
        return {
            bgApp: '#ffffff',
            bgCard: '#ffffff',
            textPrimary: '#0f0f0f',
            accentColor: accentColor // Use prop as default
        };
    });

    const handleColorChange = (key: string, value: string) => {
        const newColors = { ...customColors, [key]: value };
        setCustomColors(newColors);
        localStorage.setItem('customColors', JSON.stringify(newColors));

        // Convert camelCase to --kebab-case
        const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();

        // Apply to :root only for bg/text colors (to not break dark mode CSS on body)
        document.documentElement.style.setProperty(cssVar, value);

        // Special handling for accent - apply to both :root and body
        if (key === 'accentColor') {
            document.body.style.setProperty(cssVar, value);
            // Also set --accent-rgb
            const r = parseInt(value.slice(1, 3), 16);
            const g = parseInt(value.slice(3, 5), 16);
            const b = parseInt(value.slice(5, 7), 16);
            const rgbValue = `${r}, ${g}, ${b}`;
            document.documentElement.style.setProperty('--accent-rgb', rgbValue);
            document.body.style.setProperty('--accent-rgb', rgbValue);
            // Propagate to App.tsx state
            setAccentColor(value);
        }
    };

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

    const fetchRegexRules = async () => {
        try {
            const r = await invoke<any[]>("get_regex_rules");
            setRegexRules(r);
        } catch (e) { console.error(e); }
    };

    const addRegexRule = async () => {
        if (!newAutoPattern.trim() || !newAutoPayload.trim()) return;
        try {
            await invoke("add_regex_rule", { pattern: newAutoPattern, actionType: newAutoAction, actionPayload: newAutoPayload });
            setNewAutoPattern("");
            setNewAutoPayload("");
            fetchRegexRules();
        } catch (e) { console.error(e); }
    };

    const deleteRegexRule = async (id: number) => {
        if (!confirm("Delete rule?")) return;
        try {
            await invoke("delete_regex_rule", { id });
            fetchRegexRules();
        } catch (e) { console.error(e); }
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
        if (activeTab === 'automations') fetchRegexRules();
        if (activeTab === 'interface') {
            // Fetch autostart status
            invoke<boolean>("get_autostart").then(setAutostart).catch(console.error);
        }
        if (activeTab === 'about') {
            getVersion().then(setAppVersion).catch(console.error);
        }
    }, [activeTab]);

    const checkForUpdates = async () => {
        setUpdateStatus('checking');
        setUpdateError("");
        try {
            const info = await invoke<any | null>("check_update");
            if (info) {
                setUpdateInfo(info);
                setUpdateStatus('available');
            } else {
                setUpdateStatus('uptodate');
            }
        } catch (e) {
            setUpdateStatus('error');
            setUpdateError(String(e));
        }
    };

    const installUpdate = async () => {
        if (!updateInfo) return;
        if (!confirm(`Download and install ${updateInfo.version}? The app will close.`)) return;
        try {
            // We can't easily show progress without events, but we can set status
            setUpdateStatus('checking'); // Reuse checking spinner or add 'installing'
            await invoke("install_update", { url: updateInfo.url });
        } catch (e) {
            alert("Install failed: " + e);
        }
    };

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

        const savedColors = localStorage.getItem('customColors');
        if (savedColors) {
            try {
                const parsed = JSON.parse(savedColors);
                setCustomColors(parsed);
                Object.keys(parsed).forEach(key => {
                    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    document.documentElement.style.setProperty(cssVar, parsed[key]);
                    if (key === 'accentColor') {
                        const value = parsed[key];
                        const r = parseInt(value.slice(1, 3), 16);
                        const g = parseInt(value.slice(3, 5), 16);
                        const b = parseInt(value.slice(5, 7), 16);
                        document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
                    }
                });
            } catch (e) {
                console.error("Failed to load custom colors", e);
            }
        }
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
        const opacityValue = `${value / 100}`;
        document.documentElement.style.setProperty('--window-opacity', opacityValue);
        document.body.style.setProperty('--window-opacity', opacityValue);
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
        { id: 'interface', label: 'General', icon: '⚙️' },
        { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
        { id: 'security', label: 'Security', icon: '🔒' },
        { id: 'snippets', label: 'Snippets', icon: '📋' },
        { id: 'automations', label: 'Automations', icon: '🤖' },
        { id: 'maintenance', label: 'Maintenance', icon: '🧹' },
        { id: 'backup', label: 'Backup', icon: '💾' },
        { id: 'about', label: 'About', icon: 'ℹ️' }
    ];

    return (
        <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent' }}>
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
                <div style={{ width: '150px', padding: '20px 0', borderRight: '1px solid rgba(128,128,128,0.1)', background: 'rgba(128,128,128,0.02)' }}>
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


                    {activeTab === 'interface' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>General Settings</h2>

                            {/* Core Settings Group */}

                            {/* Always on Top */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Always on Top</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Keep window above other applications.</div>
                                    </div>
                                    <input type="checkbox" checked={alwaysOnTop} onChange={toggleAlwaysOnTop} style={{ accentColor: 'var(--accent-color)' }} />
                                </label>
                            </div>

                            {/* Compact Mode */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Compact Mode</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Use a denser layout for list items.</div>
                                    </div>
                                    <input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} />
                                </label>
                            </div>

                            {/* Adaptive System Accent */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Adaptive System Accent</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Match application colors to your system theme.</div>
                                    </div>
                                    <input type="checkbox" checked={useSystemAccent} onChange={(e) => setUseSystemAccent(e.target.checked)} />
                                </label>
                            </div>

                            {/* Launch on Startup */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Launch on System Startup</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Automatically start ReClip when you log in.</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={autostart}
                                        onChange={async (e) => {
                                            const newValue = e.target.checked;
                                            setAutostart(newValue); // Update UI immediately
                                            try {
                                                await invoke("set_autostart", { enabled: newValue });
                                            } catch (err) {
                                                console.error("Failed to set autostart:", err);
                                                setAutostart(!newValue); // Revert on failure
                                            }
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                            </div>

                            {/* Remember Position */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Remember Window Position</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Restore window position and size on launch.</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={rememberPosition}
                                        onChange={(e) => {
                                            setRememberPosition(e.target.checked);
                                            localStorage.setItem('rememberWindowPosition', e.target.checked ? 'true' : 'false');
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                            </div>

                            <h3 style={{ marginTop: '24px', marginBottom: '16px', opacity: 0.9 }}>Appearance</h3>

                            <div className="setting-item">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Theme Mode</label>
                                <div style={{ display: 'flex', gap: '8px', maxWidth: '300px' }}>
                                    {['light', 'dark', 'system'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTheme(t)}
                                            style={{
                                                flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.2)',
                                                background: theme === t ? 'var(--accent-color, #4f46e5)' : 'transparent',
                                                color: theme === t ? 'white' : 'inherit', cursor: 'pointer', textTransform: 'capitalize'
                                            }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {theme === 'custom' || true && (
                                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                                    <h3 style={{ marginTop: 0, fontSize: '0.9rem', marginBottom: '12px' }}>Custom Colors</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                            App Background
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={customColors.bgApp} onChange={(e) => handleColorChange('bgApp', e.target.value)} style={{ cursor: 'pointer', border: 'none', width: '30px', height: '30px', padding: 0, borderRadius: '4px' }} />
                                                <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>{customColors.bgApp}</span>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                            Card Background
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={customColors.bgCard} onChange={(e) => handleColorChange('bgCard', e.target.value)} style={{ cursor: 'pointer', border: 'none', width: '30px', height: '30px', padding: 0, borderRadius: '4px' }} />
                                                <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>{customColors.bgCard}</span>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                            Text Color
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="color" value={customColors.textPrimary} onChange={(e) => handleColorChange('textPrimary', e.target.value)} style={{ cursor: 'pointer', border: 'none', width: '30px', height: '30px', padding: 0, borderRadius: '4px' }} />
                                                <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>{customColors.textPrimary}</span>
                                            </div>
                                        </label>
                                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                            Accent Color
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input
                                                    type="color"
                                                    value={customColors.accentColor}
                                                    onChange={(e) => handleColorChange('accentColor', e.target.value)}
                                                    disabled={useSystemAccent}
                                                    style={{
                                                        cursor: useSystemAccent ? 'not-allowed' : 'pointer',
                                                        border: 'none', width: '30px', height: '30px', padding: 0, borderRadius: '4px',
                                                        opacity: useSystemAccent ? 0.3 : 1
                                                    }}
                                                />
                                                <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>
                                                    {customColors.accentColor} {useSystemAccent && <span style={{ fontSize: '0.7em', fontStyle: 'italic' }}>(System Active)</span>}
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                    <button
                                        onClick={() => {
                                            localStorage.removeItem('customColors');
                                            window.location.reload();
                                        }}
                                        style={{ marginTop: '16px', background: 'transparent', border: '1px solid rgba(128,128,128,0.3)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: 'inherit' }}
                                    >
                                        Reset to Defaults
                                    </button>
                                </div>
                            )}

                            <div className="setting-item" style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Window Opacity ({opacity}%)</label>
                                <input
                                    type="range" min="20" max="100" value={opacity} onChange={handleOpacityChange}
                                    style={{ width: '100%', maxWidth: '300px', accentColor: 'var(--accent-color)' }}
                                />
                            </div>

                            <div className="setting-item" style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Date Display Format</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                            type="radio" name="dateFormat" value="relative"
                                            checked={localStorage.getItem('dateFormat') !== 'absolute'}
                                            onChange={() => { localStorage.setItem('dateFormat', 'relative'); window.location.reload(); }}
                                            style={{ accentColor: 'var(--accent-color)' }}
                                        /> Relative (e.g. 5m ago)
                                    </label>
                                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input
                                            type="radio" name="dateFormat" value="absolute"
                                            checked={localStorage.getItem('dateFormat') === 'absolute'}
                                            onChange={() => { localStorage.setItem('dateFormat', 'absolute'); window.location.reload(); }}
                                            style={{ accentColor: 'var(--accent-color)' }}
                                        /> Absolute (Date & Time)
                                    </label>
                                </div>
                            </div>

                            <div className="setting-item" style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Auto-Hide Window</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="number" min="0" max="600" defaultValue={localStorage.getItem('autoHideDuration') || "0"}
                                        onChange={(e) => { localStorage.setItem('autoHideDuration', e.target.value); }}
                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.3)', background: 'var(--bg-card)', color: 'var(--text-primary, inherit)' }}
                                    />
                                    <span>seconds (0 to disable)</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '4px' }}>Note: Requires restart or reload to take effect fully.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>About ReClip</h2>
                            <div style={{ textAlign: 'center', padding: '48px 32px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                <img src="/icon.png" alt="ReClip Icon" style={{ width: '100px', height: '100px', marginBottom: '16px', borderRadius: '20px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} />
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.8rem', fontWeight: 700 }}>ReClip</h3>
                                <div style={{ opacity: 0.7, marginBottom: '32px' }}>Version {appVersion}</div>

                                <div style={{ maxWidth: '420px', margin: '0 auto 32px auto', lineHeight: '1.6' }}>
                                    <p style={{ marginBottom: '24px', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
                                        ReClip is your ultimate clipboard companion. Seamlessly manage your history, organize code snippets, and streamline your workflow with a beautiful, keyboard-centric interface.
                                    </p>

                                    <a
                                        href="https://github.com/gameticharles"
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s, background 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--bg-input)'; }}
                                    >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700 }}>CG</div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Developed by</div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Charles Gameti</div>
                                        </div>
                                    </a>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    {updateStatus === 'idle' && (
                                        <button onClick={checkForUpdates} className="primary-btn">Check for Updates</button>
                                    )}
                                    {updateStatus === 'checking' && (
                                        <div style={{ opacity: 0.7 }}>Checking for updates...</div>
                                    )}
                                    {updateStatus === 'uptodate' && (
                                        <div>
                                            <div style={{ color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>You're up to date!</div>
                                            <button onClick={checkForUpdates} className="secondary-btn" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>Check Again</button>
                                        </div>
                                    )}
                                    {updateStatus === 'available' && updateInfo && (
                                        <div style={{ maxWidth: '400px', width: '100%' }}>
                                            <div style={{ background: 'rgba(79, 70, 229, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '8px', padding: '16px', textAlign: 'left' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <strong style={{ color: 'var(--accent-color)' }}>New Update Available</strong>
                                                    <span style={{ background: 'var(--accent-color)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{updateInfo.version}</span>
                                                </div>
                                                <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.9rem', opacity: 0.9, marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                                                    {updateInfo.notes}
                                                </div>
                                                <button onClick={installUpdate} className="primary-btn" style={{ width: '100%' }}>
                                                    Download & Install
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {updateStatus === 'error' && (
                                        <div style={{ color: '#ef4444' }}>
                                            <div style={{ marginBottom: '8px' }}>Failed to check for updates</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{updateError}</div>
                                            <button onClick={checkForUpdates} style={{ marginTop: '8px', background: 'transparent', border: '1px solid currentColor', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Try Again</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.85rem', opacity: 0.5 }}>
                                <p>ReClip is open source software.</p>
                                <a href="https://github.com/gameticharles/ReClip" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View on GitHub</a>
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

                            {/* Sensitive Clip Auto-Delete */}
                            <div className="setting-item" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🔐 Sensitive Content Protection
                                </h3>
                                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '12px' }}>
                                    Automatically detects passwords, API keys, tokens, and private keys. Sensitive clips are tagged and can be auto-deleted.
                                </p>

                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Auto-delete sensitive clips</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Automatically remove detected sensitive content after a delay</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={sensitiveAutoDelete}
                                        onChange={(e) => {
                                            setSensitiveAutoDelete(e.target.checked);
                                            localStorage.setItem('sensitiveAutoDelete', e.target.checked ? 'true' : 'false');
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Delete after:</label>
                                    <select
                                        value={sensitiveTimer}
                                        onChange={(e) => {
                                            setSensitiveTimer(e.target.value);
                                            localStorage.setItem('sensitiveDeleteTimer', e.target.value);
                                        }}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(128,128,128,0.3)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary, inherit)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <option value="15">15 seconds</option>
                                        <option value="30">30 seconds</option>
                                        <option value="60">1 minute</option>
                                        <option value="120">2 minutes</option>
                                        <option value="300">5 minutes</option>
                                    </select>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '8px', marginBottom: 0 }}>
                                    Note: Changes apply to newly captured clips. Requires app restart for backend timer.
                                </p>
                            </div>

                            <div className="setting-item">
                                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Ignored Apps</h3>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="App Name or Window Title (e.g., Notepad)"
                                        value={newIgnoreApp}
                                        onChange={(e) => setNewIgnoreApp(e.target.value)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.3)', background: 'var(--bg-card)', color: 'var(--text-primary, inherit)' }}
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
                                        style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(128,128,128,0.3)', background: 'var(--bg-card)', color: 'var(--text-primary, inherit)' }}
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
                                    <button onClick={() => setNewRegex('^password.*')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>Password Preset</button>
                                    <button onClick={() => setNewRegex('\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b')} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>Credit Card Preset</button>
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


                    {activeTab === 'maintenance' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Maintenance</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Configure automatic cleanup of old clips. Disable both options to keep clips indefinitely.</p>

                            {/* Age-based Cleanup */}
                            <div className="setting-item" style={{
                                padding: '16px',
                                background: 'rgba(128,128,128,0.05)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Delete clips older than X days</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Automatically remove clips after a certain age</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={ageEnabled}
                                        onChange={(e) => {
                                            setAgeEnabled(e.target.checked);
                                            localStorage.setItem('maintenanceAgeEnabled', e.target.checked ? 'true' : 'false');
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                                {ageEnabled && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Delete after:</label>
                                        <input
                                            type="number"
                                            value={retainDays}
                                            onChange={(e) => setRetainDays(parseInt(e.target.value) || 30)}
                                            onBlur={handleMaintenanceChange}
                                            style={{
                                                width: '80px',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(128,128,128,0.3)',
                                                background: 'var(--bg-card)',
                                                color: 'var(--text-primary, inherit)'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>days</span>
                                    </div>
                                )}
                            </div>

                            {/* Limit-based Cleanup */}
                            <div className="setting-item" style={{
                                padding: '16px',
                                background: 'rgba(128,128,128,0.05)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Limit maximum clips (soft limit)</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Delete oldest clips when limit is exceeded</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={limitEnabled}
                                        onChange={(e) => {
                                            setLimitEnabled(e.target.checked);
                                            localStorage.setItem('maintenanceLimitEnabled', e.target.checked ? 'true' : 'false');
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                                {limitEnabled && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Max clips:</label>
                                        <input
                                            type="number"
                                            value={maxClips}
                                            onChange={(e) => setMaxClips(parseInt(e.target.value) || 10000)}
                                            onBlur={handleMaintenanceChange}
                                            style={{
                                                width: '100px',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(128,128,128,0.3)',
                                                background: 'var(--bg-card)',
                                                color: 'var(--text-primary, inherit)'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '16px' }}>
                                💡 Disable both options above to keep all clips indefinitely (unlimited storage).
                            </p>

                            <div className="setting-item" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,0,0,0.2)', paddingTop: '24px' }}>
                                <h3 style={{ color: '#ef4444', marginTop: 0, fontSize: '0.9rem' }}>Danger Zone</h3>
                                <button
                                    onClick={async () => {
                                        if (await window.confirm("Are you sure you want to delete ALL clips? This cannot be undone.")) {
                                            try {
                                                await invoke("clear_clips");
                                                window.alert("Clipboard history cleared successfully.");
                                            } catch (e) {
                                                console.error(e);
                                                window.alert("Failed to clear clipboard history.");
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
                                        fontWeight: 600,
                                        marginRight: '12px'
                                    }}
                                >
                                    🗑️ Clear Clipboard History
                                </button>
                                <button
                                    onClick={async () => {
                                        if (await window.confirm("Are you sure you want to delete ALL snippets? This cannot be undone.")) {
                                            try {
                                                await invoke("clear_snippets");
                                                window.alert("Snippet library cleared successfully.");
                                            } catch (e) {
                                                console.error(e);
                                                window.alert("Failed to clear snippet library.");
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
                                    🗑️ Clear Snippet Library
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

                    {activeTab === 'snippets' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Snippet Library</h2>
                            <p style={{ opacity: 0.7, marginBottom: '24px' }}>Configure the appearance and behavior of the snippet editor.</p>

                            <div className="setting-item" style={{ background: 'rgba(128,128,128,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                <h3 style={{ marginTop: 0, fontSize: '0.9rem', marginBottom: '16px' }}>Editor Preferences</h3>

                                <div className="settings-grid">
                                    <label>
                                        <span className="settings-label">Font Size ({snippetFontSize}px)</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input
                                                type="range" min="10" max="24" step="1"
                                                value={snippetFontSize}
                                                onChange={(e) => {
                                                    const v = parseInt(e.target.value);
                                                    setSnippetFontSize(v);
                                                    localStorage.setItem('snippetFontSize', v.toString());
                                                }}
                                                style={{ flex: 1, accentColor: 'var(--accent-color)' }}
                                            />
                                        </div>
                                    </label>

                                    <label>
                                        <span className="settings-label">Tab Size</span>
                                        <select
                                            className="settings-select"
                                            value={snippetTabSize}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value);
                                                setSnippetTabSize(v);
                                                localStorage.setItem('snippetTabSize', v.toString());
                                            }}
                                        >
                                            <option value="2">2 Spaces</option>
                                            <option value="4">4 Spaces</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="settings-grid">
                                    <label>
                                        <span className="settings-label">Default Language</span>
                                        <select
                                            className="settings-select"
                                            value={snippetDefaultLanguage}
                                            onChange={(e) => {
                                                setSnippetDefaultLanguage(e.target.value);
                                                localStorage.setItem('snippetDefaultLanguage', e.target.value);
                                            }}
                                        >
                                            {LANGUAGES.map(l => (
                                                <option key={l} value={l}>{l}</option>
                                            ))}
                                        </select>
                                    </label>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={snippetLineNumbers}
                                                onChange={(e) => {
                                                    setSnippetLineNumbers(e.target.checked);
                                                    localStorage.setItem('snippetLineNumbers', e.target.checked ? 'true' : 'false');
                                                }}
                                                style={{ accentColor: 'var(--accent-color)' }}
                                            />
                                            Show Line Numbers
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={snippetWordWrap}
                                                onChange={(e) => {
                                                    setSnippetWordWrap(e.target.checked);
                                                    localStorage.setItem('snippetWordWrap', e.target.checked ? 'true' : 'false');
                                                }}
                                                style={{ accentColor: 'var(--accent-color)' }}
                                            />
                                            Word Wrap
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="setting-item" style={{ background: 'rgba(128,128,128,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                <h3 style={{ marginTop: 0, fontSize: '0.9rem', marginBottom: '16px' }}>Syntax Highlighting</h3>
                                <div className="settings-grid">
                                    <label>
                                        <span className="settings-label">Light Mode Theme</span>
                                        <select
                                            className="settings-select"
                                            value={snippetThemeLight}
                                            onChange={(e) => {
                                                setSnippetThemeLight(e.target.value);
                                                localStorage.setItem('snippetThemeLight', e.target.value);
                                            }}
                                        >
                                            {THEMES.light.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span className="settings-label">Dark Mode Theme</span>
                                        <select
                                            className="settings-select"
                                            value={snippetThemeDark}
                                            onChange={(e) => {
                                                setSnippetThemeDark(e.target.value);
                                                localStorage.setItem('snippetThemeDark', e.target.value);
                                            }}
                                        >
                                            {THEMES.dark.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div className="setting-item" style={{ borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '20px' }}>
                                <h3 style={{ marginTop: 0, fontSize: '0.9rem', marginBottom: '16px' }}>Templates</h3>
                                <p style={{ opacity: 0.7, marginBottom: '20px', fontSize: '0.8rem' }}>Create reusable clips with placeholders (e.g. <code>{"{{name}}"}</code>).</p>

                                <div style={{ background: 'rgba(128,128,128,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                    <h3 style={{ marginTop: 0, fontSize: '0.85rem' }}>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="Template Name"
                                            value={newTemplateName}
                                            onChange={e => setNewTemplateName(e.target.value)}
                                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'var(--bg-input)', color: 'inherit' }}
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Content (use {{placeholder}} for dynamic values)"
                                        value={newTemplateContent}
                                        onChange={e => setNewTemplateContent(e.target.value)}
                                        style={{ width: '100%', height: '100px', padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'var(--bg-input)', color: 'inherit', marginBottom: '10px', fontFamily: 'monospace' }}
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
                        </div>
                    )}

                    {activeTab === 'automations' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Automations (Regex)</h2>
                            <p style={{ opacity: 0.7, marginBottom: '20px' }}>Automatically trigger actions when copied text matches a pattern.</p>

                            <div style={{ background: 'rgba(128,128,128,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                <h3 style={{ marginTop: 0 }}>New Rule</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="Regex Pattern (e.g. https://example.com/item/(\d+))"
                                        value={newAutoPattern}
                                        onChange={e => setNewAutoPattern(e.target.value)}
                                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit', fontFamily: 'monospace' }}
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <select
                                            value={newAutoAction}
                                            onChange={e => setNewAutoAction(e.target.value)}
                                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'var(--bg-card)', color: 'inherit' }}
                                        >
                                            <option value="open_url">Open URL</option>
                                            <option value="notify">Show Notification</option>
                                        </select>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <input
                                                type="text"
                                                placeholder={newAutoAction === 'open_url' ? "Target URL (use $1, $2 for captures)" : "Notification Message"}
                                                value={newAutoPayload}
                                                onChange={e => setNewAutoPayload(e.target.value)}
                                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit' }}
                                            />
                                        </div>
                                    </div>
                                    <button onClick={addRegexRule} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                                        Add Rule
                                    </button>
                                </div>
                            </div>

                            <div className="rule-list">
                                {regexRules.map(r => (
                                    <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--accent-color)' }}>{r.pattern}</div>
                                            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '4px' }}>
                                                <span style={{ textTransform: 'uppercase', fontSize: '0.7rem', opacity: 0.6, border: '1px solid rgba(128,128,128,0.3)', padding: '2px 4px', borderRadius: '3px', marginRight: '8px' }}>{r.action_type.replace('_', ' ')}</span>
                                                {r.action_payload}
                                            </div>
                                        </div>
                                        <button onClick={() => deleteRegexRule(r.id)} className="icon-btn" title="Delete Rule">🗑️</button>
                                    </div>
                                ))}
                                {regexRules.length === 0 && <p style={{ opacity: 0.5, fontStyle: 'italic' }}>No automation rules defined.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
