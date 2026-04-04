import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEmulationMessages,
  useSendEmulationMessage,
  type EmulationMessage,
} from "@/hooks/use-emulation";
import type { EntityPayload, ThreadPayload } from "@/hooks/use-entities";
import { EntityType } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DeviceCardProps {
  entity: EntityPayload;
  threads: ThreadPayload[];
  sessionActive: boolean;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: EmulationMessage;
  isOwnMessage: boolean;
}) {
  const visibleContent =
    message.content.trim().length > 0 ? message.content : message.preview_label;

  return (
    <div className={cn("flex w-full", isOwnMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          isOwnMessage ? "bg-blue-600 text-white" : "bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{visibleContent}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isOwnMessage ? "text-blue-200" : "text-muted-foreground",
          )}
        >
          {formatTime(message.created_at)}
          {message.source_type !== "text" && (
            <span className="ml-1 uppercase">· {message.source_type}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function DeviceCard({ entity, threads, sessionActive }: DeviceCardProps) {
  const privateThread = threads.find((t) => t.type === "private");
  const [selectedThreadId, setSelectedThreadId] = useState(
    privateThread?.id ?? threads[0]?.id ?? "",
  );
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const { data } = useEmulationMessages(selectedThreadId || null);
  const sendMessage = useSendEmulationMessage();

  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  function handleSend(content: string, sourceType: "text" | "reaction" = "text") {
    if (!content.trim() || !sessionActive || !selectedThreadId) return;

    sendMessage.mutate({
      entity_id: entity.id,
      thread_id: selectedThreadId,
      content: content.trim(),
      source_type: sourceType,
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSend(inputValue);
    setInputValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend(inputValue);
      setInputValue("");
    }
  }

  const typeBadgeVariant = entity.type === EntityType.Adult ? "secondary" : "outline";

  return (
    <Card className="flex h-[540px] flex-col">
      <CardHeader className="flex-none space-y-2 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{entity.name}</CardTitle>
          <Badge variant={typeBadgeVariant} className="text-[10px] capitalize">
            {entity.type}
          </Badge>
        </div>
        {threads.length > 1 && (
          <Select value={selectedThreadId} onValueChange={setSelectedThreadId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {threads.map((thread) => (
                <SelectItem key={thread.id} value={thread.id}>
                  {thread.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pb-3">
        <ScrollArea ref={scrollRef} className="flex-1 rounded-md border bg-background/50 p-3">
          <div className="flex flex-col gap-2">
            {messages.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {sessionActive ? "Send a message to start" : "Start a session to begin"}
              </p>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.sender === entity.id} />
            ))}
          </div>
        </ScrollArea>

        <div className="flex flex-none gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!sessionActive}
            onClick={() => handleSend("Yes", "reaction")}
          >
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!sessionActive}
            onClick={() => handleSend("No", "reaction")}
          >
            No
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-none gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            disabled={!sessionActive}
            className="h-8 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 px-3"
            disabled={!sessionActive || !inputValue.trim()}
          >
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
