import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import MainView from "./components/MainView";
import SettingsPage from "./pages/SettingsPage";
import SnippetsPage from "./pages/SnippetsPage";
import ColorToolPage from "./pages/ColorToolPage";
import OrganizerPage from "./pages/OrganizerPage";
import TitleBar from "./components/TitleBar";
import { Clip } from "./types";

function App() {
  const [view, setView] = useState<'main' | 'settings' | 'snippets' | 'colors' | 'organizer'>('main');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('compactMode') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [useSystemAccent, setUseSystemAccent] = useState(() => localStorage.getItem('useSystemAccent') === 'true');
  const [accentColor, setAccentColor] = useState('#4f46e5');

  // Lifted State
  const [incognitoMode, setIncognitoMode] = useState(() => localStorage.getItem('incognitoMode') === 'true');
  const [queueMode, setQueueMode] = useState(() => localStorage.getItem('queueMode') === 'true');
  const [pasteQueue, setPasteQueue] = useState<Clip[]>([]);
  const [showTimeline, setShowTimeline] = useState(() => localStorage.getItem('showTimeline') === 'true');

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('incognitoMode', incognitoMode.toString());
    invoke('set_incognito_mode', { enabled: incognitoMode }).catch(() => { });
  }, [incognitoMode]);

  useEffect(() => {
    localStorage.setItem('showTimeline', showTimeline.toString());
  }, [showTimeline]);

  useEffect(() => {
    localStorage.setItem('queueMode', queueMode.toString());
  }, [queueMode]);

  // Load incognito state on mount
  useEffect(() => {
    invoke<boolean>("get_incognito_mode").then(setIncognitoMode);
  }, []);

  const toggleIncognito = async () => {
    const newState = !incognitoMode;
    setIncognitoMode(newState);
    await invoke("set_incognito_mode", { enabled: newState });
  };

  // Theme & Accent Effect
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('useSystemAccent', useSystemAccent.toString());
    localStorage.setItem('compactMode', compactMode.toString());

    // Clear any previous custom color inline styles on body to let CSS take over
    const colorVars = ['--bg-app', '--bg-card', '--text-primary'];
    colorVars.forEach(v => document.body.style.removeProperty(v));

    // Apply Theme
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.body.classList.toggle('dark', isDark);
    };
    applyTheme();

    const savedOpacity = localStorage.getItem("opacity");
    if (savedOpacity) {
      const opacityValue = `${parseInt(savedOpacity) / 100}`;
      document.documentElement.style.setProperty('--window-opacity', opacityValue);
      document.body.style.setProperty('--window-opacity', opacityValue);
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handler);

    // Apply Accent
    if (useSystemAccent) {
      invoke<string>('get_system_accent_color')
        .then(color => setAccentColor(color))
        .catch(e => console.error(e));
    } else {
      // Load custom accent color from localStorage, or use default
      const savedCustomColors = localStorage.getItem('customColors');
      if (savedCustomColors) {
        try {
          const parsed = JSON.parse(savedCustomColors);
          if (parsed.accentColor) {
            setAccentColor(parsed.accentColor);
          }
        } catch (e) { console.error('Failed to parse customColors', e); }
      } else {
        setAccentColor('#4f46e5');
      }
    }

    // NOTE: We only apply custom bg/text colors to :root (not body) to avoid breaking dark mode CSS
    // The accent color is applied separately via the second useEffect and works in both themes

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, useSystemAccent, compactMode]);

  // Apply accent color variable (to both :root and body - accent works in both themes)
  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    };
    const rgb = hexToRgb(accentColor);

    // Apply accent to both :root and body - accent overrides both themes
    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.body.style.setProperty('--accent-color', accentColor);
    if (rgb) {
      document.documentElement.style.setProperty('--accent-rgb', rgb);
      document.body.style.setProperty('--accent-rgb', rgb);
    }
  }, [accentColor]);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (import.meta.env.PROD) e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);

    // Listen for Tray Events
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      await listen('open-settings', () => setView('settings'));
      await listen('run-maintenance', () => {
        // Find and click maintenance button or trigger it directly
        // For now just switch view
        setView('settings');
        // Ideally we would pass a param to open maintenance tab directly
      });
      // Incognito toggle is handled by backend state but we might want to refresh UI
      // Store unlisteners to cleanup if needed, though App component usually doesn't unmount
    });

    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Always on Top Persistence
  useEffect(() => {
    const applyAlwaysOnTop = async () => {
      const alwaysOnTop = localStorage.getItem('alwaysOnTop') === 'true';
      if (alwaysOnTop) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(true);
      }
    };
    applyAlwaysOnTop();
  }, []);

  // Window Position Management
  useEffect(() => {
    const rememberPosition = localStorage.getItem('rememberWindowPosition') === 'true';

    const showWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().show();
    };

    const positionWindowBottomLeft = async () => {
      const { getCurrentWindow, LogicalPosition } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const size = await win.outerSize();
      const screenHeight = window.screen.availHeight;
      const x = 20;
      const y = screenHeight - size.height - 60;
      await win.setPosition(new LogicalPosition(x, y));
      await win.show();
    };

    const loadAndValidatePosition = async () => {
      try {
        const result = await invoke<{ x: number; y: number; width: number; height: number } | [number, number, number, number] | null>("load_window_position");

        const { getCurrentWindow, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();

        if (!result) {
          await positionWindowBottomLeft();
          return;
        }

        // Handle different data formats (tuple vs object)
        let x: number, y: number, width: number, height: number;
        if (Array.isArray(result)) {
          [x, y, width, height] = result;
        } else if (typeof result === 'object' && result !== null) {
          if ('0' in result) {
            x = (result as any)['0'];
            y = (result as any)['1'];
            width = (result as any)['2'];
            height = (result as any)['3'];
          } else {
            x = result.x;
            y = result.y;
            width = result.width;
            height = result.height;
          }
        } else {
          await positionWindowBottomLeft();
          return;
        }

        const screenWidth = window.screen.availWidth;
        const screenHeight = window.screen.availHeight;

        // Validate position is within screen bounds
        const isOutOfBounds =
          x < -width + 50 ||
          y < -height + 50 ||
          x > screenWidth - 50 ||
          y > screenHeight - 50;

        if (isOutOfBounds || width <= 0 || height <= 0) {
          await positionWindowBottomLeft();
          return;
        }

        // Valid position - restore it then show
        await win.setSize(new LogicalSize(width, height));
        await win.setPosition(new LogicalPosition(x, y));
        await win.show();
      } catch (e) {
        console.error("[WindowPos] Failed to restore:", e);
        positionWindowBottomLeft();
      }
    };

    if (rememberPosition) {
      // Position window then show
      setTimeout(loadAndValidatePosition, 50);
    } else {
      // Just show the window at default position
      showWindow();
    }

    // Save position function with debouncing
    let lastPosition = { x: 0, y: 0, width: 0, height: 0 };
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    const savePositionDebounced = async () => {
      if (localStorage.getItem('rememberWindowPosition') !== 'true') return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const size = await win.outerSize();

        // Only save if position actually changed
        if (pos.x === lastPosition.x && pos.y === lastPosition.y &&
          size.width === lastPosition.width && size.height === lastPosition.height) {
          return;
        }

        lastPosition = { x: pos.x, y: pos.y, width: size.width, height: size.height };

        await invoke("save_window_position", {
          x: pos.x, y: pos.y,
          width: size.width, height: size.height
        });
      } catch (e) {
        console.error("[WindowPos] Save error:", e);
      }
    };

    const triggerSave = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(savePositionDebounced, 500); // 500ms debounce
    };

    // Listen for window move and resize events
    let unlistenMove: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    if (localStorage.getItem('rememberWindowPosition') === 'true') {
      // Set up event listeners
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.onMoved(() => triggerSave()).then(fn => { unlistenMove = fn; });
        win.onResized(() => triggerSave()).then(fn => { unlistenResize = fn; });
      });

      // Save initial position after 1 second
      setTimeout(savePositionDebounced, 1000);
    }

    // Also save on visibility change and before unload
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') savePositionDebounced();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', savePositionDebounced);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', savePositionDebounced);
      if (saveTimeout) clearTimeout(saveTimeout);
      if (unlistenMove) unlistenMove();
      if (unlistenResize) unlistenResize();
    };
  }, []);

  return (
    <div className="app-container">
      <TitleBar
        incognitoMode={incognitoMode}
        toggleIncognito={toggleIncognito}
        queueMode={queueMode}
        toggleQueueMode={() => setQueueMode(!queueMode)}
        pasteQueueLength={pasteQueue.length}
        showTimeline={showTimeline}
        toggleTimeline={() => setShowTimeline(!showTimeline)}
        currentView={view}
        onOpenMain={() => setView('main')}
        onOpenSettings={() => setView('settings')}
        onOpenSnippets={() => setView('snippets')}
        onOpenColors={() => setView('colors')}
        onOpenOrganizer={() => setView('organizer')}
      />
      {view === 'main' ? (
        <MainView
          compactMode={compactMode}
          queueMode={queueMode}
          pasteQueue={pasteQueue}
          setPasteQueue={setPasteQueue}
          showTimeline={showTimeline}
        />
      ) : view === 'snippets' ? (
        <SnippetsPage
          theme={theme}
        />
      ) : view === 'colors' ? (
        <ColorToolPage />
      ) : view === 'organizer' ? (
        <OrganizerPage theme={theme} />
      ) : (
        <SettingsPage
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          theme={theme}
          setTheme={setTheme}
          useSystemAccent={useSystemAccent}
          setUseSystemAccent={setUseSystemAccent}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
        />
      )}
    </div>
  );
}

export default App;
