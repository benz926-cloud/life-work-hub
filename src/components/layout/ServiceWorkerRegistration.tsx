"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for offline support and PWA capabilities.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            console.log("SW registered:", reg.scope);

            // Refresh when new SW activates
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (
                    newWorker.state === "activated" &&
                    navigator.serviceWorker.controller
                  ) {
                    // New version available - could show update prompt here
                    console.log("New SW version available!");
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn("SW registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
