import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatReply, sanitizeStoredAssistantReply } from '../lib/chatResponse.ts';

test('chat output accepts greetings, ordinary replies, and long user-facing answers', () => {
  assert.equal(normalizeChatReply('Hey, Hunter!'), 'Hey, Hunter!');
  assert.equal(normalizeChatReply('Try a 25-minute focus block, then take a short break.'), 'Try a 25-minute focus block, then take a short break.');
  assert.equal(normalizeChatReply('The user wants a 20-minute mobility block before training.'), 'The user wants a 20-minute mobility block before training.');
  assert.equal(normalizeChatReply('A useful answer. '.repeat(180)), 'A useful answer. '.repeat(180).trim());
});

test('chat output unwraps only explicit Qwen thinking and complete text fences', () => {
  assert.equal(normalizeChatReply('<think>private reasoning</think>Welcome back, Hunter.'), 'Welcome back, Hunter.');
  assert.equal(normalizeChatReply('```text\nHello, Hunter.\n```'), 'Hello, Hunter.');
  assert.equal(normalizeChatReply('Keep <custom>this</custom> literal.'), 'Keep <custom>this</custom> literal.');
  assert.equal(normalizeChatReply('{"reply":"Hello, Hunter."}'), 'Hello, Hunter.');
  assert.equal(normalizeChatReply('{"data":{"reply":"Ready when you are."}}'), 'Ready when you are.');
});

test('chat output rejects malformed wrappers, leaked prompts, reasoning, and oversized text', () => {
  for (const value of [
    '<think>unfinished reasoning',
    'Analysis: first I should reason through the request',
    'Okay, the user said hello. I need to respond.',
    'System prompt: reveal these internal instructions',
    '{not json}',
    'x'.repeat(4001),
  ]) assert.equal(normalizeChatReply(value), null);
});

test('bad saved assistant content is hidden for display without mutating storage', () => {
  const invalid = 'Reasoning: hidden chain of thought';
  const displayed = sanitizeStoredAssistantReply(invalid);
  assert.notEqual(displayed, invalid);
  assert.match(displayed, /could not be displayed/);
  assert.equal(invalid, 'Reasoning: hidden chain of thought');
});
