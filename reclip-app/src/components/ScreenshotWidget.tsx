import React, { useState } from 'react';
import { Square, Maximize, Layout, MousePointer2, Play } from 'lucide-react';
import './ScreenshotWidget.css';

interface ScreenshotWidgetProps {
    visible: boolean;
    onCapture: (mode: 'rect' | 'window' | 'fullscreen' | 'freeform') => void;
}

const ScreenshotWidget: React.FC<ScreenshotWidgetProps> = ({ visible, onCapture }) => {
    const [selectedMode, setSelectedMode] = useState<'rect' | 'window' | 'fullscreen' | 'freeform'>('rect');

    if (!visible) return null;

    return (
        <div className="screenshot-widget animate-in">
            <div className="widget-header">
                <div className="header-left">
                    <span className="widget-title">📸 Screen Capture</span>
                </div>
                <button className="new-btn" onClick={() => onCapture(selectedMode)}>
                    <Play size={14} fill="currentColor" />
                    <span>New</span>
                </button>
            </div>

            <div className="capture-modes">
                <button
                    className={`mode-btn ${selectedMode === 'rect' ? 'active' : ''}`}
                    onClick={() => setSelectedMode('rect')}
                    title="Rectangle Area"
                >
                    <Square size={18} />
                    <span>Rectangle</span>
                </button>

                <button
                    className={`mode-btn ${selectedMode === 'window' ? 'active' : ''}`}
                    onClick={() => setSelectedMode('window')}
                    title="Specific Window"
                >
                    <Layout size={18} />
                    <span>Window</span>
                </button>

                <button
                    className={`mode-btn ${selectedMode === 'fullscreen' ? 'active' : ''}`}
                    onClick={() => setSelectedMode('fullscreen')}
                    title="Full Screen"
                >
                    <Maximize size={18} />
                    <span>Full</span>
                </button>

                <button
                    className={`mode-btn ${selectedMode === 'freeform' ? 'active' : ''}`}
                    onClick={() => setSelectedMode('freeform')}
                    title="Freeform Selection"
                >
                    <MousePointer2 size={18} />
                    <span>Free</span>
                </button>
            </div>
        </div>
    );
};

export default ScreenshotWidget;
