"use client";

import { useEffect, useState } from "react";

export type CheckState = "checking" | "ok" | "error";

interface Props {
  visible: boolean;             // true = initial app load; drives auto-dismiss
  checkState?: CheckState;      // set by user-triggered "Check data" button
  onDismiss?: () => void;       // called when user closes the result screen
}

export default function LoadingScreen({ visible, checkState, onDismiss }: Props) {
  const active = visible || !!checkState;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (active) {
      setGone(false);
    } else {
      const t = setTimeout(() => setGone(true), 700);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (gone) return null;

  const showResult = checkState === "ok" || checkState === "error";
  const isOk = checkState === "ok";

  return (
    <div className={`idle-overlay${!active ? " idle-overlay--out" : ""}`}>
      <div className="idle-center">

        {/* ── Globe + result badge ── */}
        <div className="idle-globe-wrap">
          <svg
            viewBox="0 0 200 200"
            width="200"
            height="200"
            aria-hidden="true"
            className={showResult ? "idle-globe-svg idle-globe-svg--dimmed" : "idle-globe-svg"}
          >
            <defs>
              <radialGradient id="idle-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.22" />
                <stop offset="65%"  stopColor="#38bdf8" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0"    />
              </radialGradient>
              <clipPath id="idle-clip">
                <circle cx="100" cy="100" r="72" />
              </clipPath>
            </defs>

            <circle cx="100" cy="100" r="118" fill="url(#idle-glow)" />

            <circle cx="100" cy="100" r="84"
              fill="none" stroke="#38bdf8" strokeWidth="0.5"
              className="idle-pulse-ring" />
            <circle cx="100" cy="100" r="96"
              fill="none" stroke="#38bdf8" strokeWidth="0.3"
              className="idle-pulse-ring idle-pulse-ring--slow" />

            <circle cx="100" cy="100" r="72" fill="rgba(9,14,26,0.65)" />

            <g clipPath="url(#idle-clip)">
              <ellipse cx="100" cy="100" rx="72" ry="18"
                fill="none" stroke="#38bdf8" strokeWidth="0.85"
                className="idle-lat-0" />
              <ellipse cx="100" cy="76" rx="62" ry="14"
                fill="none" stroke="#38bdf8" strokeWidth="0.75"
                className="idle-lat-1" />
              <ellipse cx="100" cy="55" rx="37" ry="9"
                fill="none" stroke="#38bdf8" strokeWidth="0.6"
                className="idle-lat-2" />
              <ellipse cx="100" cy="124" rx="62" ry="14"
                fill="none" stroke="#38bdf8" strokeWidth="0.75"
                className="idle-lat-3" />
              <ellipse cx="100" cy="100" rx="22" ry="72"
                fill="none" stroke="#38bdf8" strokeWidth="0.85"
                className="idle-lon-0" />
              <g className="idle-lon-spin">
                <ellipse cx="100" cy="100" rx="55" ry="72"
                  fill="none" stroke="#38bdf8"
                  strokeWidth="0.5" strokeOpacity="0.2" />
              </g>
            </g>

            <circle cx="100" cy="100" r="72"
              fill="none" stroke="#38bdf8" strokeWidth="1.5"
              className="idle-globe-outline" />

            <circle cx="136" cy="68" r="2.5" fill="#38bdf8"
              className="idle-ping idle-ping-0" />
            <circle cx="136" cy="68" r="3"
              fill="none" stroke="#38bdf8" strokeWidth="1.5"
              className="idle-ping-ring idle-ping-ring-0" />

            <circle cx="82" cy="86" r="2.5" fill="#34d399"
              className="idle-ping idle-ping-1" />
            <circle cx="82" cy="86" r="3"
              fill="none" stroke="#34d399" strokeWidth="1.5"
              className="idle-ping-ring idle-ping-ring-1" />

            <circle cx="120" cy="106" r="2.5" fill="#38bdf8"
              className="idle-ping idle-ping-2" />
            <circle cx="120" cy="106" r="3"
              fill="none" stroke="#38bdf8" strokeWidth="1.5"
              className="idle-ping-ring idle-ping-ring-2" />
          </svg>

          {/* Magnifying glass — hidden once result arrives */}
          {!showResult && (
            <div className="idle-mag-wrap">
              <svg viewBox="0 0 44 48" width="40" height="44" aria-hidden="true">
                <circle cx="17" cy="17" r="13"
                  fill="rgba(56,189,248,0.08)"
                  stroke="#38bdf8" strokeWidth="2.5" />
                <path d="M9 11 A 10 10 0 0 1 14.5 8"
                  fill="none" stroke="#38bdf8"
                  strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                <line x1="26" y1="26" x2="41" y2="44"
                  stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Result badge — drawn-in checkmark or X over the dimmed globe */}
          {showResult && (
            <div className="idle-result-badge">
              <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                {/* Circle border */}
                <circle
                  cx="40" cy="40" r="33"
                  fill={isOk ? "rgba(52,211,153,0.14)" : "rgba(244,63,94,0.14)"}
                  stroke={isOk ? "#34d399" : "#f43f5e"}
                  strokeWidth="2.5"
                  className="idle-result-circle"
                />
                {isOk ? (
                  /* Checkmark */
                  <path
                    d="M21 40 L33 52 L59 27"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="idle-result-check"
                  />
                ) : (
                  /* X — two separate lines so each draws independently */
                  <>
                    <line x1="26" y1="26" x2="54" y2="54"
                      stroke="#f43f5e" strokeWidth="4" strokeLinecap="round"
                      className="idle-result-x1" />
                    <line x1="54" y1="26" x2="26" y2="54"
                      stroke="#f43f5e" strokeWidth="4" strokeLinecap="round"
                      className="idle-result-x2" />
                  </>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* ── Text & actions ── */}
        <div className="idle-text">
          {showResult ? (
            <>
              <div className={`idle-title ${isOk ? "idle-title--ok" : "idle-title--error"}`}>
                {isOk ? "Данные подключены" : "Нет подключения"}
              </div>
              <div className="idle-subtitle idle-result-sub">
                {isOk ? "GISSS.RU доступен · данные получены" : "Не удалось получить данные с сервера"}
              </div>
              <button className="idle-dismiss-btn" onClick={onDismiss}>
                Закрыть
              </button>
            </>
          ) : (
            <>
              <div className="idle-title">ЗдравМонитор</div>
              <div className="idle-subtitle">
                {checkState === "checking" ? "Проверка соединения" : "Загрузка данных"}
                <span className="idle-ellipsis">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
