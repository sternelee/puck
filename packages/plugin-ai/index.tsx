import { useState, useCallback, useEffect, useRef, type ReactNode, type ReactElement } from "react";
import type { PuckAction, Data, Config, Plugin } from "@puckeditor/core";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useStickToBottom } from "use-stick-to-bottom";
import { Sparkles, Send, Loader2, User, Bot } from "lucide-react";

// Type definitions
export type JSONSchema = {
  [k: string]: unknown;
  $schema?: "https://json-schema.org/draft/2020-12/schema" | "http://json-schema.org/draft-07/schema#" | "http://json-schema.org/draft-04/schema#";
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  type?: "object" | "array" | "string" | "number" | "boolean" | "null" | "integer";
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  const?: string | number | boolean | null;
  title?: string;
  description?: string;
  default?: unknown;
  format?: string;
};

export type ComponentAiParams = {
  instructions?: string;
  exclude?: boolean;
  defaultZone?: { allow?: string[]; disallow?: string[]; disabled?: boolean };
};

export type FieldAiParams = {
  instructions?: string;
  exclude?: boolean;
  required?: boolean;
  stream?: boolean;
  schema?: JSONSchema;
  bind?: string;
};

// Operation types
export type AddOperation = { op: "add"; id: string; index: number; zone: string; type: string; props: object };
export type UpdateOperation = { op: "update"; id: string; props: object };
export type UpdateRootOperation = { op: "updateRoot"; props: object };
export type MoveOperation = { op: "move"; zone: string; id: string; index: number };
export type DeleteOperation = { op: "delete"; id: string };
export type DuplicateOperation = { op: "duplicate"; id: string };
export type ResetOperation = { op: "reset" };
export type Operation = AddOperation | UpdateOperation | UpdateRootOperation | MoveOperation | DeleteOperation | DuplicateOperation | ResetOperation;

// Tool status types
export type ToolStatus = { loading: boolean; label: string; error?: { message: string } };
export type DataToolStatus = { status: ToolStatus; toolCallId: string };
export type TokenUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number; cachedInputTokens?: number };
export type DataFinish = { totalCost: number; tokenUsage: TokenUsage };

// Puck data parts
export type PuckDataParts = {
  "new-chat-created": { chatId: string };
  "puck-actions": PuckAction[];
  "build-op": Operation;
  "tool-status": DataToolStatus;
  "user-tool": { toolCallId: string; tools: { name: string; input: unknown }[] };
  "send-screenshot": { id: string; urls: { [breakpoint: number]: string }[] };
  finish: DataFinish;
  page: Data;
};

// Message type
export type PuckMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: unknown[];
};

// Request options
export type RequestOptions = {
  body?: {
    chatId?: string;
    trigger?: string;
    messages?: PuckMessage[];
    pageData?: Data;
    config?: Config;
    [key: string]: unknown;
  };
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

// Plugin props
export type AiPluginProps = {
  host?: string;
  chat?: {
    onSubmit?: (prompt: string) => void;
    examplePrompts?: { label: string; href?: string; onClick?: () => void }[];
  };
  scrollTracking?: boolean;
  prepareRequest?: (opts: RequestOptions) => RequestOptions | Promise<RequestOptions>;
};

// Extend @puckeditor/core types
declare module "@puckeditor/core" {
  export interface ComponentMetadata { ai?: ComponentAiParams }
  export interface ComponentConfigExtensions { ai?: ComponentAiParams }
  export interface FieldMetadata { ai?: FieldAiParams }
  export interface BaseField { ai?: FieldAiParams }
}

// Global window interface
declare global {
  interface Window {
    __PUCK_AI?: {
      sendMessage: (message: PuckMessage) => void;
      setMessages: (messages: PuckMessage[]) => void;
      processData: (data: PuckDataParts) => void;
      setStatus: (status: "ready" | "streaming" | "error") => void;
    };
  }
}

// CSS styles
const css = `
.puck-ai-panel { display: flex; flex-direction: column; height: 100%; font-family: system-ui, -apple-system, sans-serif; }
.puck-ai-messages { flex: 1; overflow-y: auto; padding: 16px; }
.puck-ai-message { margin-bottom: 16px; display: flex; gap: 12px; }
.puck-ai-message.user { flex-direction: row-reverse; }
.puck-ai-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.puck-ai-avatar.user { background: #3b82f6; color: white; }
.puck-ai-avatar.assistant { background: #10b981; color: white; }
.puck-ai-content { max-width: 80%; padding: 12px 16px; border-radius: 12px; line-height: 1.5; }
.puck-ai-message.user .puck-ai-content { background: #3b82f6; color: white; }
.puck-ai-message.assistant .puck-ai-content { background: #f3f4f6; color: #1f2937; }
.puck-ai-input-area { padding: 16px; border-top: 1px solid #e5e7eb; }
.puck-ai-input-wrapper { display: flex; gap: 8px; align-items: flex-end; }
.puck-ai-input { flex: 1; resize: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 14px; outline: none; font-family: inherit; }
.puck-ai-input:focus { border-color: #3b82f6; }
.puck-ai-send { padding: 12px; border: none; border-radius: 8px; background: #3b82f6; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.puck-ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
.puck-ai-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #6b7280; text-align: center; padding: 24px; }
.puck-ai-empty-icon { margin-bottom: 16px; color: #9ca3af; }
.puck-ai-example-prompts { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.puck-ai-example-prompt { padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; text-align: left; font-size: 14px; color: #374151; }
.puck-ai-example-prompt:hover { background: #f3f4f6; border-color: #d1d5db; }
`;

// Generate unique ID
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// AI Panel component
export function AiPanel({ host = "/api/puck/chat", chat, scrollTracking = true, prepareRequest }: AiPluginProps): ReactNode {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<PuckMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "streaming" | "error">("ready");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { scrollRef, contentRef, scrollToBottom } = useStickToBottom();

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: PuckMessage = { id: generateId(), role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setStatus("streaming");

    try {
      let opts: RequestOptions = {
        body: { messages: newMessages },
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      };

      if (prepareRequest) {
        opts = await prepareRequest(opts);
      }

      const response = await fetch(host, {
        method: "POST",
        headers: opts.headers,
        body: JSON.stringify(opts.body),
        credentials: opts.credentials,
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = generateId();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages([...newMessages, { id: assistantId, role: "assistant", content: assistantContent }]);
      }

      setStatus("ready");
    } catch (error) {
      console.error("AI error:", error);
      setStatus("error");
    }
  }, [host, messages, prepareRequest]);

  useEffect(() => {
    window.__PUCK_AI = {
      sendMessage: (msg) => sendMessage(msg.content),
      setMessages: (msgs) => setMessages(msgs),
      processData: (data) => console.log("Process data:", data),
      setStatus: (s) => setStatus(s),
    };
    return () => { delete window.__PUCK_AI; };
  }, [sendMessage]);

  useEffect(() => {
    if (scrollTracking) scrollToBottom();
  }, [messages, scrollTracking, scrollToBottom]);

  const handleSend = useCallback(() => {
    if (!input.trim() || status === "streaming") return;
    chat?.onSubmit?.(input);
    sendMessage(input);
    setInput("");
  }, [input, status, chat, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleExampleClick = useCallback((prompt: { label: string; href?: string; onClick?: () => void }) => {
    if (prompt.onClick) prompt.onClick();
    else setInput(prompt.label);
  }, []);

  return (
    <div className="puck-ai-panel">
      <style>{css}</style>
      <div className="puck-ai-messages" ref={scrollRef}>
        <div ref={contentRef}>
          {messages.length === 0 ? (
            <div className="puck-ai-empty">
              <div className="puck-ai-empty-icon"><Sparkles size={48} /></div>
              <h3>AI Assistant</h3>
              <p>Describe what you want to build or modify on your page.</p>
              {chat?.examplePrompts && (
                <div className="puck-ai-example-prompts">
                  {chat.examplePrompts.map((prompt, i) => (
                    <button key={i} className="puck-ai-example-prompt" onClick={() => handleExampleClick(prompt)}>
                      {prompt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`puck-ai-message ${message.role}`}>
                <div className={`puck-ai-avatar ${message.role}`}>
                  {message.role === "user" ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="puck-ai-content">
                  {message.role === "assistant" ? <ReactMarkdown>{message.content}</ReactMarkdown> : message.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="puck-ai-input-area">
        <div className="puck-ai-input-wrapper">
          <TextareaAutosize
            className="puck-ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            minRows={1}
            maxRows={4}
            disabled={status === "streaming"}
          />
          <button className="puck-ai-send" onClick={handleSend} disabled={!input.trim() || status === "streaming"}>
            {status === "streaming" ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Preview wrapper
export function AiPreviewWrapper({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</> as ReactElement;
}

// Main plugin factory
export function createAiPlugin(opts: AiPluginProps = {}): Plugin {
  const { host = "/api/puck/chat", chat, scrollTracking = true, prepareRequest } = opts;

  return {
    label: "AI",
    name: "ai",
    icon: <Sparkles size={16} />,
    mobilePanelHeight: "min-content",
    render: (): ReactElement => <AiPanel host={host} chat={chat} scrollTracking={scrollTracking} prepareRequest={prepareRequest} />,
    overrides: { preview: AiPreviewWrapper },
  };
}

export default createAiPlugin;
