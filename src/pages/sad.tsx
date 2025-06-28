// src/pages/sad.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("../components/RichTextEditor"),
  { ssr: false }
);

export default function SadPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Sad Editor</h1>
      <RichTextEditor
        tone="sad"
        highlightWord="sad"
        storageKey="sad-content"
      />
    </div>
  );
}
