import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppWagmiProvider } from "./WagmiProvider";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AppWagmiProvider>
    <App />
  </AppWagmiProvider>
);
