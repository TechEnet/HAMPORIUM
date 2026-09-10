import { useEffect, useRef } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";

let googleInitializedClientId = "";
let activeCredentialHandler = null;
let googleScriptPromise = null;

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      cleanup();
      resolve(Boolean(window.google?.accounts?.id));
    };

    const handleError = () => {
      cleanup();
      googleScriptPromise = null;
      reject(new Error("Unable to load Google Sign-In"));
    };

    const cleanup = () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (window.google?.accounts?.id) {
      cleanup();
      resolve(true);
    }
  });

  return googleScriptPromise;
};

const initializeGoogleOnce = (clientId) => {
  if (!window.google?.accounts?.id) return false;

  if (googleInitializedClientId && googleInitializedClientId !== clientId) {
    throw new Error("Google Sign-In is already initialized with a different client ID");
  }

  if (!googleInitializedClientId) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        activeCredentialHandler?.(response);
      },
    });

    googleInitializedClientId = clientId;
  }

  return true;
};

const GoogleAuthButton = ({
  onSuccess,
  onError,
  text = "continue_with",
  disabled = false,
}) => {
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => {
    handlerRef.current = (response) => {
      if (!response?.credential) {
        onError?.("Google login failed");
        return;
      }

      onSuccess?.(response.credential);
    };
  }, [onSuccess, onError]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;
    let renderTimer = null;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      onError?.("Google Client ID is not configured");
      return undefined;
    }

    const getButtonWidth = () => {
      const available = wrapperRef.current?.clientWidth || 350;
      return Math.max(220, Math.min(Math.floor(available), 500));
    };

    const renderButton = () => {
      if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;

      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text,
        shape: "rectangular",
        logo_alignment: "left",
        width: getButtonWidth(),
      });
    };

    const boot = async () => {
      try {
        await loadGoogleScript();
        if (cancelled) return;

        initializeGoogleOnce(clientId);
        activeCredentialHandler = (response) => handlerRef.current?.(response);
        renderButton();

        if (wrapperRef.current && typeof ResizeObserver !== "undefined") {
          let previousWidth = getButtonWidth();

          resizeObserver = new ResizeObserver(() => {
            const nextWidth = getButtonWidth();
            if (Math.abs(nextWidth - previousWidth) < 4) return;
            previousWidth = nextWidth;
            clearTimeout(renderTimer);
            renderTimer = setTimeout(renderButton, 50);
          });

          resizeObserver.observe(wrapperRef.current);
        }
      } catch (error) {
        if (!cancelled) {
          onError?.(error.message || "Unable to load Google Sign-In");
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      clearTimeout(renderTimer);
      resizeObserver?.disconnect();

      if (activeCredentialHandler && handlerRef.current) {
        activeCredentialHandler = null;
      }
    };
  }, [text, onError]);

  return (
    <div
      ref={wrapperRef}
      className={`w-full overflow-hidden rounded-[10px] bg-white ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <div
        ref={buttonRef}
        className="flex min-h-[44px] w-full items-center justify-center overflow-hidden"
      />
    </div>
  );
};

export default GoogleAuthButton;
