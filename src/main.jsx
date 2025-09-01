import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Import Toaster from sonner
import { Toaster } from "sonner";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    {/* Toaster must be mounted once at the root */}
    <Toaster richColors position="top-center" />
  </React.StrictMode>
);
