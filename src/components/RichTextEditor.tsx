// src/components/RichTextEditor.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { YjsPlugin } from "@platejs/yjs/react";
import { nanoid } from "nanoid";
import { RemoteCursorOverlay } from "@/components/ui/remote-cursor-overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EditorKit } from "@/components/editor-kit";
import { AILeaf } from "@/components/ui/ai-node";
import type { Value } from "platejs";

interface RichTextEditorProps {
  tone: "happy" | "sad";
  highlightWord: string;
  storageKey: string;
  initialRoomId?: string;
}

const INITIAL_CONTENT: Value = [{ type: "p", children: [{ text: "" }] }];

const randomColor = () => {
  const hex = "0123456789ABCDEF";
  return (
    "#" +
    Array.from({ length: 6 })
      .map(() => hex[Math.floor(Math.random() * 16)])
      .join("")
  );
};

const persistedRoom = () =>
  typeof window === "undefined"
    ? nanoid()
    : localStorage.getItem("plate-room-id") ?? nanoid();

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  tone,
  highlightWord,
  storageKey,
  initialRoomId,
}) => {
  const [roomId, setRoomId] = useState(() => initialRoomId || persistedRoom());
  const [username] = useState(() => `user-${Math.floor(Math.random() * 1000)}`);
  const [cursorColor] = useState(randomColor);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("plate-room-id", roomId);
    }
  }, [roomId]);

  const editor = usePlateEditor(
    {
      plugins: [
        ...EditorKit,
        YjsPlugin.configure({
          options: {
            cursors: { data: { name: username, color: cursorColor } },
            providers: [
              {
                type: "hocuspocus",
                options: { name: roomId, url: "ws://localhost:8888" },
              },
              {
                type: "webrtc",
                options: {
                  roomName: roomId,
                  maxConns: 9,
                  signaling: [
                    process.env.NODE_ENV === "production"
                      ? "wss://signaling.yjs.dev"
                      : "ws://localhost:4444",
                  ],
                },
              },
            ],
          },
          render: { afterEditable: RemoteCursorOverlay },
        }),
      ],
      value: INITIAL_CONTENT,
    },
    [roomId]
  );

  useEffect(() => {
    const api = editor.getApi(YjsPlugin).yjs;
    console.log("[RichTextEditor] Initialising Yjs room", roomId);
    api.init({ id: roomId, autoSelect: "end", value: INITIAL_CONTENT });
    return () => api.destroy();
  }, [editor, roomId]);

  const decorate = useCallback(
    ({ entry }: any) => {
      const [node, path] = entry;
      const ranges: any[] = [];
      if ("text" in node) {
        const text: string = (node as any).text;
        const idx = text.toLowerCase().indexOf(highlightWord.toLowerCase());
        if (idx !== -1) {
          ranges.push({
            anchor: { path, offset: idx },
            focus: { path, offset: idx + highlightWord.length },
            highlight: true,
          });
        }
      }
      return ranges;
    },
    [highlightWord]
  );

  const renderLeaf = useCallback((props: any) => {
    const { leaf, attributes, children } = props;
    if ((leaf as any).ai) return <AILeaf {...props} />;
    if ((leaf as any).highlight) {
      return (
        <span
          {...attributes}
          style={{ backgroundColor: "rgba(254,240,138,0.5)", cursor: "pointer" }}
        >
          {children}
        </span>
      );
    }
    return <span {...attributes}>{children}</span>;
  }, []);

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      if (
        typeof window !== "undefined" &&
        !editor.getOptions(YjsPlugin)._isConnected
      ) {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    },
    [editor, storageKey]
  );

  const { _providers: providers, _isConnected: isConnected } = editor.getOptions(YjsPlugin);
  const toggleConnection = () => {
    const api = editor.getApi(YjsPlugin).yjs;
    isConnected ? api.disconnect() : api.connect();
  };
  const newRoom = () => setRoomId(nanoid());

  return (
    <div className="flex flex-col border-2 border-dashed border-blue-500">
      <div className="bg-blue-100 px-4 py-1 text-sm text-blue-800">
        RichTextEditor mounted – room <strong>{roomId}</strong>
      </div>
      <div className="flex items-center gap-2 bg-muted px-4 py-2 text-sm text-muted-foreground">
        <div className="flex-1">
          <label htmlFor="room-id" className="mb-0.5 block text-[11px] font-medium">
            Room ID
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="room-id"
              className="h-[28px] bg-background px-1.5 py-1"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <Button size="icon" variant="outline" onClick={newRoom} title="New room">
              ↻
            </Button>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={toggleConnection} className="ml-auto">
          {isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>
      <div className="flex gap-2 bg-muted px-4 py-1 text-xs">
        Connected as <span style={{ color: cursorColor }}>{username}</span>
        {providers.map((p: any) => (
          <span
            key={p.type}
            className={`rounded px-2 py-0.5 ${p.isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {p.type}: {p.isConnected ? "connected" : "disconnected"}
          </span>
        ))}
      </div>
      <Plate editor={editor} onChange={handleChange}>
        <PlateContent
          placeholder="Start typing…"
          decorate={decorate}
          renderLeaf={renderLeaf}
          className="min-h-[200px] rounded border p-4"
        />
      </Plate>
    </div>
  );
};

export default RichTextEditor;
