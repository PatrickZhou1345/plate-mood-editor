// src/pages/happy.tsx
import dynamic from "next/dynamic";
import React from "react";

const RichTextEditor = dynamic(
  () => import("../components/RichTextEditor"),
  { ssr: false }
);

export default function HappyPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Happy Editor</h1>
      <RichTextEditor
        tone="happy"
        highlightWord="happy"
        storageKey="happy-content"
      />
    </div>
  );
}
