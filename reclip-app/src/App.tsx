import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import MainView from "./components/MainView";
import SettingsPage from "./pages/SettingsPage";

function App() {
  const [view, setView] = useState<'main' | 'settings'>('main');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('compactMode') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [useSystemAccent, setUseSystemAccent] = useState(() => localStorage.getItem('useSystemAccent') === 'true');
  const [accentColor, setAccentColor] = useState('#4f46e5');

  // Theme & Accent Effect
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('useSystemAccent', useSystemAccent.toString());
    localStorage.setItem('compactMode', compactMode.toString());

    // Apply Theme
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.body.classList.toggle('dark', isDark);
    };
    applyTheme();

    const savedOpacity = localStorage.getItem("opacity");
    if (savedOpacity) {
      document.documentElement.style.setProperty('--window-opacity', `${parseInt(savedOpacity) / 100}`);
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
      setAccentColor('#4f46e5');
    }

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, useSystemAccent, compactMode]);

  // Apply accent color variable
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    };
    const rgb = hexToRgb(accentColor);
    if (rgb) document.documentElement.style.setProperty('--accent-rgb', rgb);
  }, [accentColor]);

  // Prevent context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (import.meta.env.PROD) e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Window Position Management
  useEffect(() => {
    const rememberPosition = localStorage.getItem('rememberWindowPosition') === 'true';

    if (rememberPosition) {
      // Load saved position on startup
      invoke<[number, number, number, number] | null>("load_window_position")
        .then(async (pos) => {
          if (pos) {
            const [x, y, width, height] = pos;
            const { getCurrentWindow, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.setPosition(new LogicalPosition(x, y));
            await win.setSize(new LogicalSize(width, height));
          }
        })
        .catch(console.error);
    }

    // Save position on window close/move
    const savePosition = async () => {
      if (localStorage.getItem('rememberWindowPosition') !== 'true') return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        const size = await win.outerSize();
        await invoke("save_window_position", {
          x: pos.x, y: pos.y,
          width: size.width, height: size.height
        });
      } catch (e) {
        console.error("Failed to save window position:", e);
      }
    };

    // Save on visibility change (when app goes to background)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        savePosition();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also save before unload
    window.addEventListener('beforeunload', savePosition);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', savePosition);
    };
  }, []);

  return (
    <div className="app-container">
      {view === 'main' ? (
        <MainView
          compactMode={compactMode}
          onOpenSettings={() => setView('settings')}
        />
      ) : (
        <SettingsPage
          onBack={() => setView('main')}
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          theme={theme}
          setTheme={setTheme}
          useSystemAccent={useSystemAccent}
          setUseSystemAccent={setUseSystemAccent}
        />
      )}
    </div>
  );
}

export default App;
