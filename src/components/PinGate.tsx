"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

const CORRECT_PIN = "1234"; // Change this to your PIN

export default function PinGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if already unlocked this session
    if (sessionStorage.getItem("saturn_unlocked") === "true") {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    // Auto-focus first input
    if (!unlocked) {
      inputRefs.current[0]?.focus();
    }
  }, [unlocked]);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError(false);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check PIN when all 4 digits entered
    if (digit && index === 3) {
      const entered = newPin.join("");
      if (entered === CORRECT_PIN) {
        sessionStorage.setItem("saturn_unlocked", "true");
        setTimeout(() => setUnlocked(true), 200);
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin(["", "", "", ""]);
          inputRefs.current[0]?.focus();
        }, 600);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0A0A0A",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 9999, padding: 24,
    }}>
      {/* Saturn Planet Logo */}
      <div style={{ marginBottom: 32 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          {/* Planet body */}
          <circle cx="50" cy="50" r="28" fill="#E63232" />
          <circle cx="50" cy="50" r="28" fill="url(#planetGrad)" />
          {/* Ring */}
          <ellipse cx="50" cy="50" rx="46" ry="14" stroke="#E63232" strokeWidth="3" fill="none" opacity="0.8"
            transform="rotate(-20 50 50)" />
          <ellipse cx="50" cy="50" rx="46" ry="14" stroke="#E63232" strokeWidth="1.5" fill="none" opacity="0.3"
            transform="rotate(-20 50 50)" strokeDasharray="4 3" />
          {/* Planet shadow overlay */}
          <circle cx="50" cy="50" r="28" fill="url(#shadowGrad)" />
          <defs>
            <radialGradient id="planetGrad" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#FF4444" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E63232" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="shadowGrad" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="60%" stopColor="rgba(0,0,0,0.4)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand name */}
      <h1 style={{
        fontSize: 32, fontWeight: 800, color: "#FFFFFF",
        letterSpacing: "6px", textTransform: "uppercase", marginBottom: 8,
      }}>
        SATURN
      </h1>
      <p style={{ fontSize: 13, color: "#9A9A9A", letterSpacing: "3px", marginBottom: 48 }}>
        MOBILE
      </p>

      {/* PIN label */}
      <p style={{
        fontSize: 13, color: error ? "#EF4444" : "#9A9A9A",
        marginBottom: 20, fontWeight: 500, transition: "color 0.2s",
      }}>
        {error ? "Wrong PIN" : "Enter PIN"}
      </p>

      {/* PIN inputs */}
      <div style={{
        display: "flex", gap: 14,
        animation: shake ? "shakeX 0.5s ease-in-out" : "none",
      }}>
        {pin.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            style={{
              width: 56, height: 64, textAlign: "center",
              fontSize: 28, fontWeight: 700, color: "#FFFFFF",
              background: digit ? "rgba(230,50,50,0.15)" : "#1A1A1A",
              border: `2px solid ${error ? "#EF4444" : digit ? "#E63232" : "#2A2A2A"}`,
              borderRadius: 12, outline: "none",
              caretColor: "#E63232",
              transition: "all 0.2s",
            }}
          />
        ))}
      </div>

      {/* Dots indicator */}
      <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
        {pin.map((digit, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: digit ? "#E63232" : "#2A2A2A",
            transition: "background 0.2s",
          }} />
        ))}
      </div>

      <style>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
