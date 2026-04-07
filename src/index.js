import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Suppress ResizeObserver loop error (harmless browser warning)
const ro = window.ResizeObserver;
window.ResizeObserver = class extends ro {
  constructor(cb) {
    super((entries, observer) => { window.requestAnimationFrame(() => { cb(entries, observer); }); });
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
