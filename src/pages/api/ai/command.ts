// src/pages/api/ai/command.ts

import type { TextStreamPart, ToolSet } from 'ai';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createOpenAI } from '@ai-sdk/openai';
import { InvalidArgumentError } from '@ai-sdk/provider';
import { delay as originalDelay } from '@ai-sdk/provider-utils';
import { convertToCoreMessages, streamText } from 'ai';

export const config = {
  runtime: 'edge',
};

export type ChunkDetector = (buffer: string) => string | null;

/**
 * Smooths text streaming output.
 */
function smoothStream<TOOLS extends ToolSet>(
  {
    _internal: { delay = originalDelay } = {},
    chunking = 'word',
    delayInMs = 10,
  }: {
    /** For testing only */
    _internal?: { delay?: (delayInMs: number | null) => Promise<void> };
    chunking?: ChunkDetector | RegExp | 'line' | 'word';
    delayInMs?: ((buffer: string) => number) | number | null;
  } = {}
): (options: { tools: TOOLS }) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>> {
  let detectChunk: ChunkDetector;

  if (typeof chunking === 'function') {
    detectChunk = (buffer) => {
      const match = chunking(buffer);
      if (match == null) return null;
      if (match.length === 0) {
        throw new Error('Chunking function must return a non-empty string.');
      }
      if (!buffer.startsWith(match)) {
        throw new Error(`Chunking function must return a prefix match. Got "${match}".`);
      }
      return match;
    };
  } else {
    const regex = typeof chunking === 'string' ? CHUNKING_REGEXPS[chunking] : chunking;
    if (!regex) {
      throw new InvalidArgumentError({
        argument: 'chunking',
        message: `Chunking must be "word", "line", or a RegExp. Received: ${chunking}`,
      });
    }
    detectChunk = (buffer) => {
      const m = regex.exec(buffer);
      if (!m) return null;
      return buffer.slice(0, m.index) + m[0];
    };
  }

  return () => {
    let buffer = '';

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      async transform(chunk, controller) {
        if (chunk.type !== 'text-delta') {
          if (buffer.length > 0) {
            controller.enqueue({ textDelta: buffer, type: 'text-delta' });
            buffer = '';
          }
          controller.enqueue(chunk);
          return;
        }

        buffer += chunk.textDelta;
        let match: string | null;
        while ((match = detectChunk(buffer)) !== null) {
          controller.enqueue({ textDelta: match, type: 'text-delta' });
          buffer = buffer.slice(match.length);
          const ms =
            typeof delayInMs === 'number'
              ? delayInMs
              : delayInMs?.(buffer) ?? 10;
          await delay(ms);
        }
      },
    });
  };
}

const CHUNKING_REGEXPS = {
  line: /\n+/m,
  list: /.{8}/m,
  word: /\S+\s+/m,
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { apiKey: key, messages, system } = body;
  const apiKey = key || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OpenAI API key.' }, { status: 401 });
  }

  try {
    const debugMsgs = system
      ? [{ role: 'system', content: system }, ...messages]
      : messages;

    const debugRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: debugMsgs,
        max_tokens: 512,
        stream: false,
      }),
    });
    const debugJson = await debugRes.json();
    console.log('✅ AI full (non-stream) response:', debugJson.choices?.[0]?.message?.content);
  } catch (err) {
    console.error('❌ AI non-stream error:', err);
  }

  const openai = createOpenAI({ apiKey });

  try {
    const result = streamText({
      experimental_transform: smoothStream({
        chunking: (buffer) => {
          // fallback to word-chunking
          const m = CHUNKING_REGEXPS.word.exec(buffer);
          return m ? buffer.slice(0, m.index) + m[0] : null;
        },
        delayInMs: () => 30,
      }),
      maxTokens: 2048,
      messages: convertToCoreMessages(messages),
      model: openai('gpt-4o'),
      system,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error('❌ Streaming AI error:', err);
    return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
  }
}
