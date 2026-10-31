
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "./index.css";

import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";

import HamporiumNavigationTransition from "./components/HamporiumRouteTransition.jsx";
import CookieConsent from "./components/CookieConsent.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <HamporiumNavigationTransition />

      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>

      <CookieConsent />
    </BrowserRouter>
  </StrictMode>
);
