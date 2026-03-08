import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import MainView from "./components/MainView";
import SettingsPage from "./pages/SettingsPage";
import SnippetsPage from "./pages/SnippetsPage";
import ColorToolPage from "./pages/ColorToolPage";
import OrganizerPage from "./pages/OrganizerPage";
import TitleBar from "./components/TitleBar";
import GlobalSearch from "./components/GlobalSearch";
import Onboarding from "./components/Onboarding";
import PinLock from "./components/PinLock";
import { useSettingsStore } from "./store/useSettingsStore";
import { useClipStore } from "./store/useClipStore";

function App() {
  const {
    view, setView,
    theme, setTheme,
    compactMode, setCompactMode,
    useSystemAccent, setUseSystemAccent,
    accentColor, setAccentColor,
    incognitoMode, loadIncognito, loadListenToSelf, toggleIncognito,
    queueMode, setQueueMode,
    showTimeline, setShowTimeline,
    showOnboarding, setShowOnboarding,
    isLocked, setIsLocked,
    applyTheme
  } = useSettingsStore();

  const { pasteQueue } = useClipStore();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [standaloneId, setStandaloneId] = useState<{ type: 'snippet' | 'note', id: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const snippetId = params.get('snippetId');
    const noteId = params.get('noteId');
    if (snippetId) {
      setStandaloneId({ type: 'snippet', id: parseInt(snippetId) });
    } else if (noteId) {
      setStandaloneId({ type: 'note', id: parseInt(noteId) });
    }
  }, []);

  // Load backend state on mount
  useEffect(() => {
    loadIncognito();
    loadListenToSelf();
  }, [loadIncognito, loadListenToSelf]);

  // Theme & Accent Effect
  useEffect(() => {
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
    }

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, useSystemAccent, applyTheme, setAccentColor]);

  // Apply accent color variable
  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    };
    const rgb = hexToRgb(accentColor);

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
      await listen('tray-toggle-incognito', () => {
        toggleIncognito();
      });

      await listen('tray-toggle-top', async () => {
        const alwaysOnTop = localStorage.getItem('alwaysOnTop') === 'true';
        const newState = !alwaysOnTop;
        localStorage.setItem('alwaysOnTop', String(newState));
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(newState);
        window.dispatchEvent(new Event('alwaysOnTopChanged'));
        await invoke('update_tray_item_state', { id: 'toggle_top', checked: newState }).catch(() => { });
      });
    });

    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [setView, toggleIncognito]);

  // Global Search Shortcut (Ctrl+K)
  useEffect(() => {
    const handleGlobalSearch = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalSearch);
    return () => window.removeEventListener('keydown', handleGlobalSearch);
  }, []);

  // Always on Top Persistence
  useEffect(() => {
    const applyAlwaysOnTop = async () => {
      const alwaysOnTop = localStorage.getItem('alwaysOnTop') === 'true';
      if (alwaysOnTop) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setAlwaysOnTop(true);
        invoke('update_tray_item_state', { id: 'toggle_top', checked: true }).catch(() => { });
      }
    };
    applyAlwaysOnTop();
  }, []);

  // Window Position Management
  useEffect(() => {
    const rememberPosition = localStorage.getItem('rememberWindowPosition') === 'true';

    const handleWindowShow = async (win: any) => {
      try {
        const isMinimized = await invoke<boolean>('is_minimized_launch');
        if (!isMinimized) {
          await win.show();
        }
      } catch (e) {
        await win.show();
      }
    };

    const showWindow = async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await handleWindowShow(getCurrentWindow());
    };

    const positionWindowBottomLeft = async () => {
      const { getCurrentWindow, LogicalPosition } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const size = await win.outerSize();
      const screenHeight = window.screen.availHeight;
      const x = 20;
      const y = screenHeight - size.height - 60;
      await win.setPosition(new LogicalPosition(x, y));
      await handleWindowShow(win);
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
        const isOutOfBounds = x < -width + 50 || y < -height + 50 || x > screenWidth - 50 || y > screenHeight - 50;

        if (isOutOfBounds || width <= 0 || height <= 0) {
          await positionWindowBottomLeft();
          return;
        }

        await win.setSize(new LogicalSize(width, height));
        await win.setPosition(new LogicalPosition(x, y));
        await handleWindowShow(win);
      } catch (e) {
        console.error("[WindowPos] Failed to restore:", e);
        positionWindowBottomLeft();
      }
    };

    if (rememberPosition) {
      setTimeout(loadAndValidatePosition, 50);
    } else {
      showWindow();
    }

    let lastPosition = { x: 0, y: 0, width: 0, height: 0 };
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    const savePositionDebounced = async () => {
      if (localStorage.getItem('rememberWindowPosition') !== 'true') return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const size = await win.outerSize();

        if (pos.x === lastPosition.x && pos.y === lastPosition.y && size.width === lastPosition.width && size.height === lastPosition.height) {
          return;
        }

        lastPosition = { x: pos.x, y: pos.y, width: size.width, height: size.height };
        await invoke("save_window_position", { x: pos.x, y: pos.y, width: size.width, height: size.height });
      } catch (e) {
        console.error("[WindowPos] Save error:", e);
      }
    };

    const triggerSave = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(savePositionDebounced, 500);
    };

    let unlistenMove: (() => void) | null = null;
    let unlistenResize: (() => void) | null = null;

    if (localStorage.getItem('rememberWindowPosition') === 'true') {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.onMoved(() => triggerSave()).then(fn => { unlistenMove = fn; });
        win.onResized(() => triggerSave()).then(fn => { unlistenResize = fn; });
      });
      setTimeout(savePositionDebounced, 1000);
    }

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

  if (standaloneId) {
    return (
      <div className="app-container" style={{ padding: 16, overflow: 'auto' }}>
        {standaloneId.type === 'snippet' ? (
          <SnippetsPage theme={theme} standaloneId={standaloneId.id} />
        ) : (
          <OrganizerPage theme={theme} standaloneNoteId={standaloneId.id} />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {isLocked && <PinLock onUnlock={() => setIsLocked(false)} />}
      {showOnboarding && !isLocked && <Onboarding onComplete={() => setShowOnboarding(false)} />}
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
        <MainView />
      ) : view === 'snippets' ? (
        <SnippetsPage theme={theme} />
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
      <GlobalSearch
        visible={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={(module) => {
          if (module === 'clip') setView('main');
          else if (module === 'snippet') setView('snippets');
          else if (module === 'note') setView('organizer');
        }}
      />
    </div>
  );
}

export default App;
