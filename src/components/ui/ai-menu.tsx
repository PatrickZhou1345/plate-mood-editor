'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import {
  AIChatPlugin,
  AIPlugin,
  useEditorChat,
  useLastAssistantMessage,
} from '@platejs/ai/react';
import { BlockSelectionPlugin, useIsSelecting } from '@platejs/selection/react';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Album,
  BadgeHelp,
  BookOpenCheck,
  Check,
  CornerUpLeft,
  FeatherIcon,
  ListEnd,
  ListMinus,
  ListPlus,
  Loader2Icon,
  PauseIcon,
  PenLine,
  SmileIcon,
  Wand,
  X,
} from 'lucide-react';
import { type NodeEntry, type SlateEditor, isHotkey, NodeApi } from 'platejs';
import { useEditorPlugin, useHotkeys, usePluginOption } from 'platejs/react';
import { type PlateEditor, useEditorRef } from 'platejs/react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useChat } from '@/components/use-chat';

import { AIChatEditor } from './ai-chat-editor';

const toneCommands = {
  happyTone: {
    icon: <SmileIcon />,
    label: 'Rewrite to happy tone',
    value: 'happyTone',
    onSelect: ({ editor }: { editor: PlateEditor }) => {
      const aiEditor = editor.getOption(AIChatPlugin, 'aiEditor') as SlateEditor;
      if (!aiEditor) return;  
      const txt = NodeApi.string(aiEditor);
      void editor.getApi(AIChatPlugin).aiChat.submit({
        prompt: `Rewrite the following text in a happy, upbeat tone:\n\n${txt}`,
      });
    },
  },
  sadTone: {
    icon: <BadgeHelp />,
    label: 'Rewrite to sad tone',
    value: 'sadTone',
    onSelect: ({ editor }: { editor: PlateEditor }) => {
      const aiEditor = editor.getOption(AIChatPlugin, 'aiEditor') as SlateEditor;
      if (!aiEditor) return;  
      const txt = NodeApi.string(aiEditor);
      void editor.getApi(AIChatPlugin).aiChat.submit({
        prompt: `Rewrite the following text in a sad, melancholic tone:\n\n${txt}`,
      });
    },
  },
};

/** Main AI menu component **/
export function AIMenu() {
  const pathname = usePathname();
  const { api, editor } = useEditorPlugin(AIChatPlugin);

  const open = usePluginOption(AIChatPlugin, 'open') ?? false;
  const mode = usePluginOption(AIChatPlugin, 'mode') ?? 'chat';
  const streaming = usePluginOption(AIChatPlugin, 'streaming') ?? false;
  const isSelecting = useIsSelecting();

  const [value, setValue] = React.useState('');
  const chat = useChat();
  const { input, messages = [], setInput, status } = chat; // default messages to []
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const content = useLastAssistantMessage()?.content;

  React.useEffect(() => {
    if (streaming) {
      const node = api.aiChat.node({ anchor: true });
      setTimeout(() => {
        setAnchor(editor.api.toDOMNode(node![0])!);
      }, 0);
    }
  }, [streaming, api, editor]);

  useEditorChat({
    chat,
    onOpenBlockSelection: (blocks) => {
      const dom = editor.api.toDOMNode(blocks.at(-1)![0])!;
      setAnchor(dom);
      api.aiChat.show();
    },
    onOpenCursor: () => {
      const [blk] = editor.api.block({ highest: true })!;
      if (!editor.api.isAt({ end: true }) && !editor.api.isEmpty(blk)) {
        editor.getApi(BlockSelectionPlugin).blockSelection.set(blk.id as string);
      }
      const dom = editor.api.toDOMNode(blk)!;
      setAnchor(dom);
      api.aiChat.show();
    },
    onOpenSelection: () => {
      const last = editor.api.blocks().at(-1)![0];
      const dom = editor.api.toDOMNode(last)!;
      setAnchor(dom);
      api.aiChat.show();
    },
    onOpenChange: (o) => {
      if (!o) {
        setAnchor(null);
        setInput('');
      }
    },
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isHotkey('esc')(e)) {
        api.aiChat.hide();
        chat._abortFakeStream();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, chat]);

  if ((status === 'streaming' || status === 'submitted') && mode === 'insert') {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? api.aiChat.show() : api.aiChat.hide())} modal={false}>
      <PopoverAnchor virtualRef={{ current: anchor! }} />
      <PopoverContent
        className="border-none bg-transparent p-0 shadow-none"
        style={{ width: anchor?.offsetWidth }}
        onEscapeKeyDown={(e) => { e.preventDefault(); api.aiChat.hide(); }}
        align="center"
        side="bottom"
      >
        <Command value={value} onValueChange={setValue} className="w-full rounded-lg border shadow-md">
          {mode === 'chat' && isSelecting && content && <AIChatEditor content={content} />}

          {(status === 'streaming' || status === 'submitted') ? (
            <div className="flex grow items-center gap-2 p-2 text-sm text-muted-foreground select-none">
              <Loader2Icon className="size-4 animate-spin" />
              {messages.length > 1 ? 'Editing...' : 'Thinking...'}
            </div>
          ) : (
            <CommandPrimitive.Input
              className={cn(
                'flex h-9 w-full min-w-0 border-input bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground',
                'border-b focus-visible:ring-transparent'
              )}
              placeholder="Ask AI anything…"
              value={input}
              onValueChange={setInput}
              onKeyDown={(e) => {
                if (isHotkey('backspace')(e) && input === '') {
                  e.preventDefault();
                  api.aiChat.hide();
                }
                if (isHotkey('enter')(e) && !e.shiftKey && !value) {
                  e.preventDefault();
                  api.aiChat.submit();
                }
              }}
              data-plate-focus
              autoFocus
            />
          )}

          {!((status === 'streaming' || status === 'submitted')) && (
            <CommandList>
              <AIMenuItems pathname={pathname} setValue={setValue} />
            </CommandList>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** 2) Include discard in your aiChatItems **/
const aiChatItems = {
  accept: {
    icon: <Check />,
    label: 'Accept',
    value: 'accept',
    onSelect: ({ editor }: { editor: PlateEditor }) => {
      editor.getTransforms(AIChatPlugin).aiChat.accept();
      editor.tf.focus({ edge: 'end' });
    },
  },
  continueWrite: {
    icon: <PenLine />,
    label: 'Continue writing',
    value: 'continueWrite',
    onSelect: ({ editor }: { editor: PlateEditor }) => {
      // …your existing logic…
    },
  },
  discard: {
    icon: <X />,
    label: 'Discard',
    shortcut: 'Escape',
    value: 'discard',
    onSelect: ({ editor }: { editor: PlateEditor }) => {
      editor.getTransforms(AIPlugin).ai.undo();
      editor.getApi(AIChatPlugin).aiChat.hide();
    },
  },
  emojify: {
    icon: <SmileIcon />,
    label: 'Emojify',
    value: 'emojify',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Emojify' }),
  },
  explain: {
    icon: <BadgeHelp/>,
    label: 'Explain',
    value: 'explain',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Explain' }),
  },
  fixSpelling: {
    icon: <Check />,
    label: 'Fix spelling & grammar',
    value: 'fixSpelling',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Fix spelling & grammar' }),
  },
  improveWriting: {
    icon: <Wand />,
    label: 'Improve writing',
    value: 'improveWriting',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Improve writing' }),
  },
  makeLonger: {
    icon: <ListPlus />,
    label: 'Make longer',
    value: 'makeLonger',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Make longer' }),
  },
  makeShorter: {
    icon: <ListMinus />,
    label: 'Make shorter',
    value: 'makeShorter',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Make shorter' }),
  },
  replace: {
    icon: <Check />,
    label: 'Replace selection',
    value: 'replace',
    onSelect: ({ aiEditor, editor }: { aiEditor: SlateEditor; editor: PlateEditor }) =>
      void editor.getTransforms(AIChatPlugin).aiChat.replaceSelection(aiEditor),
  },
  summarize: {
    icon: <Album />,
    label: 'Add a summary',
    value: 'summarize',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.submit({ prompt: 'Summarize' }),
  },
  tryAgain: {
    icon: <CornerUpLeft />,
    label: 'Try again',
    value: 'tryAgain',
    onSelect: ({ editor }: { editor: PlateEditor }) =>
      void editor.getApi(AIChatPlugin).aiChat.reload(),
  },
};

/** Menu‐state groups **/
type EditorChatState = 'cursorCommand' | 'cursorSuggestion' | 'selectionCommand' | 'selectionSuggestion';
const menuStateItems: Record<EditorChatState, { items: typeof aiChatItems[keyof typeof aiChatItems][] }[]> = {
  cursorCommand: [
    { items: [aiChatItems.continueWrite, aiChatItems.summarize, aiChatItems.explain] },
  ],
  cursorSuggestion: [
    { items: [aiChatItems.accept, aiChatItems.discard, aiChatItems.tryAgain] },
  ],
  selectionCommand: [
    {
      items: [
        aiChatItems.improveWriting,
        aiChatItems.emojify,
        aiChatItems.makeLonger,
        aiChatItems.makeShorter,
        aiChatItems.fixSpelling,
      ],
    },
  ],
  selectionSuggestion: [
    {
      items: [
        aiChatItems.replace,
        aiChatItems.discard,
        aiChatItems.tryAgain,
      ],
    },
  ],
};

/** Renders the command items and injects toneCommands **/
interface AIMenuItemsProps {
  pathname: string | null;
  setValue: (v: string) => void;
}
export function AIMenuItems({ pathname, setValue }: AIMenuItemsProps) {
  const editor = useEditorRef<PlateEditor>();
  const aiEditor = usePluginOption(AIChatPlugin, 'aiEditor') as SlateEditor;
  const isSelecting = useIsSelecting();
  const chatOpt = usePluginOption(AIChatPlugin, 'chat');
  const messages = chatOpt?.messages ?? [];

  const state = React.useMemo<EditorChatState>(() => {
    if (messages.length > 0) return isSelecting ? 'selectionSuggestion' : 'cursorSuggestion';
    return isSelecting ? 'selectionCommand' : 'cursorCommand';
  }, [isSelecting, messages]);

  const groups = React.useMemo(() => {
    return menuStateItems[state].map((g) => {
      let items = [...g.items];
      if (state === 'selectionCommand' && pathname) {
        const cmd =
          pathname === '/happy' ? toneCommands.happyTone :
          pathname === '/sad'   ? toneCommands.sadTone :
          null;
        if (cmd) {
          items = [cmd, ...items.filter((i) => i.value !== cmd.value)];
        }
      }
      return { items };
    });
  }, [state, pathname]);

  React.useEffect(() => {
    const first = groups[0]?.items[0];
    if (first) setValue(first.value);
  }, [groups, setValue]);

  return (
    <>
      {groups.map((g, i) => (
        <CommandGroup key={i}>
          {g.items.map((item) => (
            <CommandItem
              key={item.value}
              value={item.value}
              className="[&_svg]:text-muted-foreground"
              onSelect={() => item.onSelect?.({ aiEditor, editor })}
            >
              {item.icon}
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </>
  );
}

/** Loading indicator **/
export function AILoadingBar() {
  const chatOpt = usePluginOption(AIChatPlugin, 'chat');
  const status = chatOpt?.status ?? 'idle';
  const mode = usePluginOption(AIChatPlugin, 'mode') ?? 'chat';
  const { api } = useEditorPlugin(AIChatPlugin);
  const visible = (status === 'streaming' || status === 'submitted') && mode === 'insert';
  if (!visible) return null;

  return (
    <div className={cn('absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border bg-muted p-3 text-sm shadow')}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      <span>{status === 'submitted' ? 'Thinking…' : 'Writing…'}</span>
      <Button size="sm" variant="ghost" onClick={() => api.aiChat.stop()}>
        <PauseIcon className="h-4 w-4" /> Stop <kbd className="ml-1 rounded bg-border px-1 text-[10px]">Esc</kbd>
      </Button>
    </div>
  );
}