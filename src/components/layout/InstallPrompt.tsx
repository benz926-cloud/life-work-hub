"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, X, ChevronDown } from "lucide-react";

/**
 * iOS PWA Install Prompt — shows a banner guiding users to
 * "Share → Add to Home Screen" for a native app experience.
 *
 * Only shows on:
 * - iOS Safari (not Chrome/Firefox on iOS)
 * - Not already in standalone/PWA mode
 * - Not dismissed before in this session
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOSSafari = useCallback(() => {
    if (typeof window === "undefined") return false;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
    const isStandalone = "standalone" in window.navigator
      && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    return isIOS && isSafari && !isStandalone;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isIOSSafari()) {
        setShow(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isIOSSafari]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
  };

  if (!show || dismissed) return null;

  return (
    <div className="install-prompt">
      {/* Arrow pointing to share button */}
      <div className="install-prompt-arrow">
        <ChevronDown className="w-8 h-8 text-blue-600 animate-bounce" />
      </div>

      {/* Banner */}
      <div className="install-prompt-banner">
        <div className="flex items-center gap-3">
          <Share2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              安装到主屏幕
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              点击下方 <span className="font-medium text-blue-600">分享</span> →
              选择 <span className="font-medium text-blue-600">添加到主屏幕</span>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .install-prompt {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          animation: slideUp 0.4s ease-out;
        }
        .install-prompt-arrow {
          display: flex;
          justify-content: flex-end;
          padding-right: 24px;
          margin-bottom: -4px;
        }
        .install-prompt-banner {
          background: white;
          border-top: 1px solid #e5e7eb;
          padding: 14px 16px;
          padding-bottom: max(14px, env(safe-area-inset-bottom));
          box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (min-width: 768px) {
          .install-prompt { display: none; }
        }
        @media (display-mode: standalone) {
          .install-prompt { display: none !important; }
        }
      `}</style>
    </div>
  );
}
