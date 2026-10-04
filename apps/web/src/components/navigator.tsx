'use client';

import type { ConversationMessage } from '@permit-readiness/contracts';
import { useState, useTransition } from 'react';
import { invokeNavigatorAction } from '../app/actions';
import { Button } from './button';

export function Navigator({
  projectId,
  initialMessages,
}: {
  projectId: string;
  initialMessages: ConversationMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function send() {
    const message = draft.trim();
    if (!message) return;
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await invokeNavigatorAction(projectId, message);
        setMessages(result.messages);
        setDraft('');
      } catch {
        setError(
          'The navigator is unavailable. Your structured project information remains saved.',
        );
      }
    });
  }

  return (
    <>
      {messages.length ? (
        <section className="conversation" aria-label="Conversation history">
          {messages.map((message) => (
            <article className="message" key={message.id}>
              <div className="message__role">
                {message.role === 'user' ? 'You' : 'Navigator'}
              </div>
              <p className="message__body">{message.content}</p>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <h2>No questions yet</h2>
          <p>
            Ask about a saved field, information gap, or the limits of the
            demonstration.
          </p>
        </div>
      )}
      <div className="field">
        <label htmlFor="navigator-message">Your question</label>
        <textarea
          id="navigator-message"
          maxLength={20_000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <div className="actions">
        <Button disabled={isPending || !draft.trim()} onClick={send}>
          {isPending ? 'Preparing explanation…' : 'Ask the navigator'}
        </Button>
      </div>
      {error ? (
        <div className="notice notice--danger" role="alert">
          <strong>Navigator unavailable.</strong> {error}
        </div>
      ) : null}
    </>
  );
}
