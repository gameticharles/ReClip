import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import QuickView from "./QuickView";
import { getCurrentWindow } from "@tauri-apps/api/window";

const Main = () => {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (!label) return null;

  return (
    <React.StrictMode>
      {label === "quick" ? <QuickView /> : <App />}
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Main />);
