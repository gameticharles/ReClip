import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { THEMES } from "../utils/themes";
import { LANGUAGES } from "../utils/languages";
import { getVersion } from '@tauri-apps/api/app';
import { ChangelogViewer } from '../components/ChangelogViewer';

interface SettingsPageProps {
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

    // Sidebar State
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('settingsSidebarCollapsed') === 'true');

    // Handle sidebar responsive collapse
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 800) { // Threshold for auto-collapse
                setSidebarCollapsed(true);
            }
        };

        // Initial check if not already set by user preference logic (optional, but good for first run)
        // Actually, we trust localStorage first. But if no localStorage, maybe auto-collapse?
        // Let's just listen for resize to auto-collapse on small screens.
        if (window.innerWidth < 800 && localStorage.getItem('settingsSidebarCollapsed') === null) {
            setSidebarCollapsed(true);
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Persist sidebar state
    useEffect(() => {
        localStorage.setItem('settingsSidebarCollapsed', sidebarCollapsed.toString());
    }, [sidebarCollapsed]);

    // Privacy states
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
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate' | 'error' | 'downloading'>('idle');
    const [updateError, setUpdateError] = useState("");
    const [appVersion, setAppVersion] = useState("...");
    const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number, total: number } | null>(null);
    const [colorPaletteLimit, setColorPaletteLimit] = useState(() => parseInt(localStorage.getItem('colorPaletteLimit') || '15'));
    const [showTooltipPreview, setShowTooltipPreview] = useState(() => localStorage.getItem('showTooltipPreview') === 'true');
    const [autoHideDuration, setAutoHideDuration] = useState(() => parseInt(localStorage.getItem('autoHideDuration') || '0'));

    // Google Drive
    const [driveConnected, setDriveConnected] = useState(false);
    const [driveUser, setDriveUser] = useState<string | null>(null);
    const [driveEmail, setDriveEmail] = useState<string | null>(null);
    const [driveClientId, setDriveClientId] = useState(() => localStorage.getItem('driveClientId') || '');
    const [driveClientSecret, setDriveClientSecret] = useState(() => localStorage.getItem('driveClientSecret') || '');

    const [driveStatusMsg, setDriveStatusMsg] = useState("");
    const [syncing, setSyncing] = useState(false);

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

    const handleSyncNow = async () => {
        setSyncing(true);
        setDriveStatusMsg("Syncing...");
        try {
            const msg = await invoke<string>("sync_clips");
            setDriveStatusMsg(msg);
        } catch (e) {
            setDriveStatusMsg("Sync Failed: " + e);
        } finally {
            setSyncing(false);
        }
    };

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
        if (activeTab === 'backup') {
            fetchDriveStatus();
        }
    }, [activeTab]);

    useEffect(() => {
        // Listen for Google Auth Code
        const unlisten = listen<string>("google-auth-code", async (event) => {
            console.log("Received Auth Code", event.payload);
            setDriveStatusMsg("Authenticating...");
            try {
                const info = await invoke<any>("finish_google_auth", { code: event.payload });
                setDriveConnected(info.connected);
                setDriveUser(info.user_name);
                setDriveEmail(info.user_email);
                setDriveStatusMsg("Connected successfully!");
            } catch (e) {
                console.error(e);
                setDriveStatusMsg("Auth Failed: " + e);
            }
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    const fetchDriveStatus = async () => {
        try {
            // In a real app we might not want to expose sensitive info in plain text return, but for local it's okay
            const info = await invoke<any>("get_drive_status");
            setDriveConnected(info.connected);
            setDriveUser(info.user_name);
            setDriveEmail(info.user_email);
        } catch (e) { console.error(e); }
    };

    const handleConnectDrive = async () => {
        if (!driveClientId || !driveClientSecret) {
            alert("Please enter Client ID and Secret");
            return;
        }
        localStorage.setItem('driveClientId', driveClientId);
        localStorage.setItem('driveClientSecret', driveClientSecret);

        try {
            setDriveStatusMsg("Starting Auth...");
            await invoke("start_google_auth", { clientId: driveClientId, clientSecret: driveClientSecret });
            // Backend opens URL
            // Backend opens the URL now
            setDriveStatusMsg("Please check your browser...");
        } catch (e) {
            setDriveStatusMsg("Error: " + e);
        }
    };

    const handleDisconnectDrive = async () => {
        if (!confirm("Disconnect Google Drive?")) return;
        try {
            await invoke("disconnect_google_drive");
            setDriveConnected(false);
            setDriveUser(null);
            setDriveEmail(null);
            setDriveStatusMsg("Disconnected");
        } catch (e) { console.error(e); }
    };

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

        // Set up progress listener
        const unlisten = await listen<{ downloaded: number, total: number }>("update-progress", (event) => {
            setDownloadProgress(event.payload);
        });

        try {
            setUpdateStatus('downloading');
            setDownloadProgress({ downloaded: 0, total: 0 });
            await invoke("install_update", { url: updateInfo.url });
        } catch (e) {
            setUpdateStatus('error');
            setUpdateError("Install failed: " + e);
        } finally {
            unlisten();
            setDownloadProgress(null);
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
        { id: 'backup', label: 'Backup & Cloud', icon: '☁️' },
        { id: 'about', label: 'About', icon: 'ℹ️' }
    ];

    return (
        <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent' }}>
            {/* Settings Title Bar */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar */}
                <div style={{
                    width: sidebarCollapsed ? '64px' : '200px',
                    padding: '16px 0',
                    borderRight: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                title={sidebarCollapsed ? tab.label : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                    gap: sidebarCollapsed ? 0 : '12px',
                                    width: sidebarCollapsed ? '48px' : 'calc(100% - 24px)',
                                    margin: sidebarCollapsed ? '0 auto 4px auto' : '0 12px 4px 12px',
                                    padding: sidebarCollapsed ? '0' : '10px 12px',
                                    height: '40px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: activeTab === tab.id ? 'var(--accent-color, #4f46e5)' : 'transparent',
                                    color: activeTab === tab.id ? 'white' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '0.95rem',
                                    fontWeight: activeTab === tab.id ? 600 : 500,
                                    transition: 'all 0.2s',
                                    opacity: activeTab === tab.id ? 1 : 0.8,
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    if (activeTab !== tab.id) {
                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                        e.currentTarget.style.opacity = '1';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (activeTab !== tab.id) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.opacity = '0.8';
                                    }
                                }}
                            >
                                <span style={{ fontSize: '1.2rem', minWidth: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tab.icon}</span>
                                <span style={{
                                    whiteSpace: 'nowrap',
                                    opacity: sidebarCollapsed ? 0 : 1,
                                    width: sidebarCollapsed ? 0 : 'auto',
                                    overflow: 'hidden',
                                    transition: 'opacity 0.2s, width 0.2s',
                                    pointerEvents: sidebarCollapsed ? 'none' : 'auto'
                                }}>
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Collapse Toggle */}
                    <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            style={{
                                width: sidebarCollapsed ? '40px' : '100%',
                                padding: '8px',
                                background: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {sidebarCollapsed ? '»' : '« Collapse Sidebar'}
                        </button>
                    </div>
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

                            {/* Tooltip Preview */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Show Tooltip Preview</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Hover over clips to see full content preview.</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={showTooltipPreview}
                                        onChange={(e) => {
                                            setShowTooltipPreview(e.target.checked);
                                            localStorage.setItem('showTooltipPreview', String(e.target.checked));
                                            window.dispatchEvent(new Event('storage')); // Notify other components
                                        }}
                                        style={{ accentColor: 'var(--accent-color)' }}
                                    />
                                </label>
                            </div>

                            {/* Color Palette Limit */}
                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Image Color Palette Limit</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Maximum colors to extract from images ({colorPaletteLimit}).</div>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="30"
                                        value={colorPaletteLimit}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setColorPaletteLimit(val);
                                            localStorage.setItem('colorPaletteLimit', e.target.value);
                                            window.dispatchEvent(new Event('storage'));
                                        }}
                                        className="custom-range"
                                        style={{
                                            width: '100%', maxWidth: '300px',
                                            '--range-value': `${((colorPaletteLimit - 5) / 25) * 100}%`,
                                            '--range-fill': 'var(--accent-color)',               // filled side
                                            '--range-track': 'rgba(128,128,128,0.25)' // non-fill side
                                        } as React.CSSProperties}
                                    />
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
                                            className="primary-btn"
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
                                        className="primary-btn"
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
                                    className="custom-range"
                                    style={{
                                        width: '100%', maxWidth: '300px',
                                        '--range-value': `${((opacity - 20) / 80) * 100}%`,
                                        '--range-fill': 'var(--accent-color)',               // filled side
                                        '--range-track': 'rgba(128,128,128,0.25)' // non-fill side
                                    } as React.CSSProperties}
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
                                        type="number" min="0" max="600" value={autoHideDuration}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setAutoHideDuration(val);
                                            localStorage.setItem('autoHideDuration', e.target.value);
                                        }}
                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.3)', background: 'var(--bg-card)', color: 'var(--text-primary, inherit)' }}
                                    />
                                    <span>seconds (0 to disable)</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '4px' }}>Note: Requires restart or reload to take effect fully.</p>
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
                                        className="primary-btn"
                                        style={{
                                            padding: '8px 16px',
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
                                        className="primary-btn"
                                        style={{
                                            padding: '8px 16px',
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
                                            <button onClick={() => handleDeleteRule(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}>🗑️</button>
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
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to delete ALL clips? This cannot be undone.")) {
                                                try {
                                                    await invoke("clear_clips");
                                                    window.alert("All clips cleared successfully.");
                                                } catch (e) {
                                                    console.error(e);
                                                    window.alert("Failed to clear clips.");
                                                }
                                            }
                                        }}
                                        className="primary-btn"
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
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                    >
                                        🗑️ Clear All Clips
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to delete ALL snippets? This cannot be undone.")) {
                                                try {
                                                    await invoke("clear_snippets");
                                                    window.alert("All snippets cleared successfully.");
                                                } catch (e) {
                                                    console.error(e);
                                                    window.alert("Failed to clear snippets.");
                                                }
                                            }
                                        }}
                                        className="primary-btn"
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
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                    >
                                        🗑️ Clear All Snippets
                                    </button>
                                </div>
                            </div>
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
                                                className="custom-range"
                                                style={{
                                                    width: '100%', maxWidth: '300px',
                                                    '--range-value': `${((snippetFontSize - 10) / 14) * 100}%`,
                                                    '--range-fill': 'var(--accent-color)',               // filled side
                                                    '--range-track': 'rgba(128,128,128,0.25)' // non-fill side
                                                } as React.CSSProperties}
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
                                        <button onClick={saveTemplate}
                                            className="primary-btn"
                                            style={{
                                                padding: '8px 16px',
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
                                        <input
                                            type="text"
                                            placeholder={newAutoAction === 'open_url' ? "Target URL (use $1, $2 for captures)" : "Notification Message"}
                                            value={newAutoPayload}
                                            onChange={e => setNewAutoPayload(e.target.value)}
                                            style={{ flex: 1, minWidth: 0, padding: '8px', borderRadius: '4px', border: '1px solid rgba(128,128,128,0.2)', background: 'transparent', color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                        />
                                    </div>
                                    <button onClick={addRegexRule}
                                        className="primary-btn"
                                        style={{
                                            padding: '8px 16px',
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

                    {activeTab === 'backup' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0 }}>Backup & Cloud Sync</h2>

                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ marginBottom: '16px' }}>Local Backup</h3>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={handleExport}
                                        className="primary-btn"
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
                                        className="primary-btn"
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
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                    >
                                        📥 Import Backup
                                    </button>
                                </div>
                                {exportStatus && <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.8 }}>{exportStatus}</div>}
                            </div>

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                                <h3 style={{ marginBottom: '16px' }}>Google Drive Sync</h3>

                                {!driveConnected ? (
                                    <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', opacity: 0.8 }}>
                                            Connect Google Drive to sync your clips across devices. You need to provide your own Google Cloud Project credentials.
                                        </p>

                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Client ID</label>
                                            <input
                                                type="text"
                                                value={driveClientId}
                                                onChange={e => setDriveClientId(e.target.value)}
                                                placeholder="xxx.apps.googleusercontent.com"
                                                className="input-field"
                                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit' }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Client Secret</label>
                                            <input
                                                type="password"
                                                value={driveClientSecret}
                                                onChange={e => setDriveClientSecret(e.target.value)}
                                                placeholder="Client Secret"
                                                className="input-field"
                                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'inherit' }}
                                            />
                                        </div>

                                        <button
                                            onClick={handleConnectDrive}
                                            className="primary-btn"
                                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>🌐</span> Connect to Google Drive
                                        </button>

                                        {driveStatusMsg && <div style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center', color: 'var(--accent-color)' }}>{driveStatusMsg}</div>}
                                    </div>
                                ) : (
                                    <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e8f0fe', color: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>G</div>
                                            <div>
                                                <div style={{ fontWeight: 700 }}>Connected</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{driveUser}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{driveEmail}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={handleSyncNow}
                                                className="primary-btn"
                                                style={{ flex: 1 }}
                                                disabled={syncing}
                                            >
                                                {syncing ? 'Syncing...' : 'Sync Now'}
                                            </button>
                                            <button
                                                onClick={handleDisconnectDrive}
                                                style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                        {driveStatusMsg && <div style={{ marginTop: '12px', fontSize: '0.85rem', textAlign: 'center', color: 'var(--accent-color)' }}>{driveStatusMsg}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="setting-section">
                            <h2 style={{ marginTop: 0, marginBottom: '32px' }}>About</h2>

                            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '8px' }}>
                                        <img src="/icon.png" alt="ReClip" style={{ width: '80px', height: '80px', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }} />
                                        <div>
                                            <h3 style={{ margin: '0', fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>ReClip</h3>
                                            <a
                                                href="https://github.com/gameticharles/ReClip/releases"
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ fontSize: '1.1rem', opacity: 0.6, fontWeight: 500, marginTop: '4px', textDecoration: 'none', color: 'inherit', display: 'inline-block', transition: 'opacity 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                                title="View Releases on GitHub"
                                            >
                                                Version {appVersion}
                                            </a>
                                            {/* Status Badge */}
                                            <div style={{
                                                marginTop: '8px',
                                                display: 'inline-block',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                background: updateStatus === 'uptodate' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(128,128,128,0.1)',
                                                color: updateStatus === 'uptodate' ? '#22c55e' : 'inherit',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                border: '1px solid transparent',
                                                borderColor: updateStatus === 'uptodate' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(128,128,128,0.2)'
                                            }}>
                                                {updateStatus === 'uptodate' ? 'Stable Channel' : updateStatus === 'available' ? 'Update Available' : 'Stable Channel'}
                                            </div>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '1.05rem', lineHeight: '1.6', opacity: 0.8, maxWidth: '500px', marginBottom: '32px', marginTop: '24px' }}>
                                        ReClip is your ultimate clipboard companion. Seamlessly manage your history, organize code snippets, and streamline your workflow with a beautiful, keyboard-centric interface.
                                    </p>

                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '40px' }}>
                                        {updateStatus === 'available' && updateInfo ? (
                                            <button
                                                onClick={installUpdate}
                                                className="primary-btn"
                                                style={{ padding: '10px 24px', fontSize: '1rem' }}
                                            >
                                                🚀 Install Update {updateInfo.version}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={checkForUpdates}
                                                disabled={updateStatus === 'checking'}
                                                className="primary-btn"
                                                style={{ padding: '10px 24px', opacity: updateStatus === 'checking' ? 0.7 : 1 }}
                                            >
                                                {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '32px' }}>
                                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '12px', fontWeight: 700 }}>Developed By</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <a
                                                href="https://github.com/gameticharles"
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '16px' }}
                                            >
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700 }}>CG</div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Charles Gameti</div>
                                                    <div style={{ opacity: 0.6, fontSize: '0.9rem' }}>Full Stack Developer</div>
                                                </div>
                                            </a>
                                        </div>
                                    </div>

                                    {/* Update Info / Error Display */}
                                    {updateStatus === 'error' && (
                                        <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem' }}>
                                            {updateError}
                                        </div>
                                    )}
                                    {updateStatus === 'downloading' && (
                                        <div style={{ marginTop: '24px' }}>
                                            <div style={{ marginBottom: '8px', fontSize: '0.9rem' }}>Downloading update... {downloadProgress ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100) : 0}%</div>
                                            <div style={{ width: '100%', height: '4px', background: 'rgba(128,128,128,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', background: 'var(--accent-color)', width: `${downloadProgress ? (downloadProgress.downloaded / downloadProgress.total) * 100 : 0}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    <ChangelogViewer />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
