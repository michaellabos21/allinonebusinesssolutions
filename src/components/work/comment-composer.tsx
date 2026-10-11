"use client";

import { useId, useMemo, useRef, useState } from "react";

import { UserAvatar } from "@/components/common/user-avatar";
import { useDemoStore } from "@/components/providers/demo-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The "@partial name" being typed just before the caret, if any. */
const MENTION_QUERY = /(?:^|\s)@([\p{L}\p{N}.'-]*(?: [\p{L}\p{N}.'-]*)?)$/u;

type Props = {
  initialBody?: string;
  initialMentions?: string[];
  submitLabel: string;
  placeholder?: string;
  /** Resolves true when saved, so the box can clear. */
  onSubmit: (body: string, mentions: string[]) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
};

/**
 * A comment box. Typing @ suggests teammates; choosing one writes "@Name"
 * and records them as mentioned. Only people whose "@Name" is still in the
 * text when it is sent count as mentioned. Ctrl or Cmd + Enter sends.
 */
export function CommentComposer({
  initialBody = "",
  initialMentions = [],
  submitLabel,
  placeholder = "Write a comment. Type @ to mention someone.",
  onSubmit,
  onCancel,
  autoFocus,
}: Props) {
  const { team } = useDemoStore();
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initialBody);
  const [mentioned, setMentioned] = useState<string[]>(initialMentions);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const text = query.toLowerCase();
    return team.filter((member) => member.name.toLowerCase().includes(text)).slice(0, 6);
  }, [query, team]);

  function readQuery(value: string, caret: number) {
    const match = MENTION_QUERY.exec(value.slice(0, caret));
    setQuery(match ? match[1] : null);
    setActive(0);
  }

  function choose(memberId: string) {
    const member = team.find((item) => item.id === memberId);
    const element = box.current;
    if (!member || !element) return;
    const caret = element.selectionStart;
    const before = body.slice(0, caret).replace(/@[^@\s]*(?: [^@\s]*)?$/u, `@${member.name} `);
    const next = before + body.slice(caret);
    setBody(next);
    setMentioned((current) => (current.includes(member.id) ? current : [...current, member.id]));
    setQuery(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(before.length, before.length);
    });
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    const stillMentioned = mentioned.filter((memberId) => {
      const name = team.find((member) => member.id === memberId)?.name;
      return name ? text.includes(`@${name}`) : false;
    });
    setBusy(true);
    const saved = await onSubmit(text, stillMentioned);
    setBusy(false);
    if (saved && !initialBody) {
      setBody("");
      setMentioned([]);
    }
  }

  const listId = `${id}-mentions`;
  const open = suggestions.length > 0;

  return (
    <form
      className="relative grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {initialBody ? "Edit comment" : "Comment"}
      </label>
      <Textarea
        ref={box}
        id={id}
        value={body}
        rows={3}
        maxLength={5000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setBody(event.target.value);
          readQuery(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) => readQuery(body, event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((current) => (current + step + suggestions.length) % suggestions.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              choose(suggestions[active].id);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setQuery(null);
              return;
            }
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape" && onCancel) onCancel();
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Mention a teammate"
        hidden={!open}
        className="absolute top-full left-0 z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-popover"
      >
        {suggestions.map((member, index) => (
          <li
            key={member.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => {
              event.preventDefault();
              choose(member.id);
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
              index === active && "bg-accent text-accent-foreground",
            )}
          >
            <UserAvatar
              name={member.name}
              photoPath={member.photoPath}
              className="size-5 [&_[data-slot=avatar-fallback]]:text-[10px]"
            />
            <span className="truncate">{member.name}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">
          <kbd className="font-sans">Ctrl</kbd> + <kbd className="font-sans">Enter</kbd> to send
        </p>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** A comment's text, with mentions of people still in the team highlighted. */
export function CommentBody({ body, mentions }: { body: string; mentions: string[] }) {
  const { team } = useDemoStore();
  const names = mentions
    .map((memberId) => team.find((member) => member.id === memberId)?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => b.length - a.length);
  if (!names.length) return <p className="whitespace-pre-wrap break-words">{body}</p>;

  const pattern = new RegExp(
    `(${names.map((name) => `@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).join("|")})`,
    "g",
  );
  return (
    <p className="whitespace-pre-wrap break-words">
      {body.split(pattern).map((part, index) =>
        index % 2 === 1 ? (
          <span key={index} className="rounded-sm bg-primary-soft px-0.5 font-medium text-primary">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}
