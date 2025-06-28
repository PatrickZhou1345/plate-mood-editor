// src/app/page.tsx
"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1.5rem",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>Welcome to Tone Editor</h1>
      <p>Select an editor:</p>
      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/happy"
          style={{
            padding: "0.75rem 1.25rem",
            backgroundColor: "#4CAF50",
            color: "#fff",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          Happy Editor
        </Link>
        <Link
          href="/sad"
          style={{
            padding: "0.75rem 1.25rem",
            backgroundColor: "#2196F3",
            color: "#fff",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          Sad Editor
        </Link>
      </div>
    </main>
  );
}
