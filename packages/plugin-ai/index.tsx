"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
  createContext,
  useMemo,
  type ReactNode,
  type ReactElement,
} from "react";
import type { PuckAction, Data, Config, Plugin } from "@puckeditor/core";
import { useGetPuck, createUsePuck } from "@puckeditor/core";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isDataUIPart,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type DataUIPart,
  type DynamicToolUIPart,
  type ChatStatus,
  type CreateUIMessage,
  type LanguageModelUsage,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useStickToBottom } from "use-stick-to-bottom";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  RotateCcw,
  Settings,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import qler from "qler";
import { ulid } from "ulid";
import html2canvas from "html2canvas-pro";
import "./styles.css";

// ============================================================
// Image attachment helpers
// ============================================================

export interface AttachedImage {
  /** Unique key for React lists */
  id: string;
  /** base64 data URL e.g. "data:image/png;base64,..." */
  dataUrl: string;
  /** Original file name */
  name: string;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToAttachedImages(files: FileList | File[]): Promise<AttachedImage[]> {
  const results: AttachedImage[] = [];
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await readFileAsDataURL(file);
    results.push({ id: prefixedUlid("img"), dataUrl, name: file.name });
  }
  return results;
}

// ============================================================
// Type definitions
// ============================================================

type _JSONSchema = boolean | JSONSchema;
export type JSONSchema = {
  [k: string]: unknown;
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  type?: "object" | "array" | "string" | "number" | "boolean" | "null" | "integer";
  additionalItems?: _JSONSchema;
  unevaluatedItems?: _JSONSchema;
  prefixItems?: _JSONSchema[];
  items?: _JSONSchema | _JSONSchema[];
  contains?: _JSONSchema;
  additionalProperties?: _JSONSchema;
  unevaluatedProperties?: _JSONSchema;
  properties?: Record<string, _JSONSchema>;
  patternProperties?: Record<string, _JSONSchema>;
  dependentSchemas?: Record<string, _JSONSchema>;
  propertyNames?: _JSONSchema;
  if?: _JSONSchema;
  then?: _JSONSchema;
  else?: _JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: _JSONSchema;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number | boolean;
  minimum?: number;
  exclusiveMinimum?: number | boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxContains?: number;
  minContains?: number;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  dependentRequired?: Record<string, string[]>;
  enum?: Array<string | number | boolean | null>;
  const?: string | number | boolean | null;
  id?: string;
  title?: string;
  description?: string;
  default?: unknown;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  nullable?: boolean;
  examples?: unknown[];
  format?: string;
  contentMediaType?: string;
  contentEncoding?: string;
  contentSchema?: JSONSchema;
  _prefault?: unknown;
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

export type AddOperation = { op: "add"; id: string; index: number; zone: string; type: string; props: object };
export type UpdateOperation = { op: "update"; id: string; props: object };
export type UpdateRootOperation = { op: "updateRoot"; props: object };
export type MoveOperation = { op: "move"; zone: string; id: string; index: number };
export type DeleteOperation = { op: "delete"; id: string };
export type DuplicateOperation = { op: "duplicate"; id: string };
export type ResetOperation = { op: "reset" };
export type Operation = AddOperation | UpdateOperation | UpdateRootOperation | MoveOperation | DeleteOperation | DuplicateOperation | ResetOperation;

export type ToolStatus = { loading: boolean; label: string; error?: { message: string } };
export type DataToolStatus = { status: ToolStatus; toolCallId: string };

type TokenUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
  reasoningTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
};

type DataFinish = {
  totalCost: number;
  tokenUsage: TokenUsage;
};

type PuckDataParts = {
  "new-chat-created": { chatId: string };
  "puck-actions": PuckAction[];
  "build-op": Operation;
  "tool-status": DataToolStatus;
  "user-tool": { toolCallId: string; tools: { name: string; input: any }[] };
  "send-screenshot": { id: string; urls: { [breakpoint: number]: string }[] };
  finish: DataFinish;
  page: Data;
};

type PuckProviderMetadata = {
  tokenUsage?: LanguageModelUsage;
};

export type PuckMessage = UIMessage<PuckProviderMetadata, PuckDataParts>;

export type RequestOptions = {
  body?: {
    chatId?: string;
    trigger?: string;
    messages?: PuckMessage[];
    pageData?: Data;
    config?: Config;
    [key: string]: any;
  };
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

export type ThinkingLevel = "none" | "low" | "medium" | "high";

export type AiSettings = {
  thinkingLevel: ThinkingLevel;
  urlContext: boolean;
  googleSearch: boolean;
  enterpriseWebSearch: boolean;
  figmaToken: string;
};

const DEFAULT_AI_SETTINGS: AiSettings = {
  thinkingLevel: "none",
  urlContext: false,
  googleSearch: false,
  enterpriseWebSearch: false,
  figmaToken: "",
};

const AI_SETTINGS_STORAGE_KEY = "puck-ai-settings";

function useAiSettings(storageKey = AI_SETTINGS_STORAGE_KEY): [AiSettings, (update: Partial<AiSettings>) => void] {
  const [settings, setSettingsState] = useState<AiSettings>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(storageKey);
        if (stored) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {}
    return { ...DEFAULT_AI_SETTINGS };
  });

  const setSettings = useCallback(
    (update: Partial<AiSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...update };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  return [settings, setSettings];
}

export type AiPluginProps = {
  host?: string;
  chat?: {
    onSubmit?: (prompt: string) => void;
    examplePrompts?: { label: string; href?: string; onClick?: () => void }[];
  };
  scrollTracking?: boolean;
  prepareRequest?: (opts: RequestOptions) => RequestOptions | Promise<RequestOptions>;
  settings?: {
    storageKey?: string;
  };
};

// Extend @puckeditor/core types
declare module "@puckeditor/core" {
  export interface ComponentMetadata { ai?: ComponentAiParams }
  export interface ComponentConfigExtensions { ai?: ComponentAiParams }
  export interface FieldMetadata { ai?: FieldAiParams }
  export interface BaseField { ai?: FieldAiParams }
}

export type TargetComponent = {
  id: string;
  type: string;
  label?: string;
};

declare global {
  interface Window {
    __PUCK_AI: {
      sendMessage: (message: CreateUIMessage<PuckMessage>) => void;
      setMessages: (_messages: PuckMessage[]) => void;
      processData: (_dataPart: DataUIPart<PuckDataParts>) => void;
      setStatus: (_status: ChatStatus) => void;
      setPrompt: (_value: string) => void;
      setTargetComponent: (_target: TargetComponent | null) => void;
    };
  }
}

// ============================================================
// Helpers
// ============================================================

const prefixedUlid = (prefix = "") => `${prefix ? `${prefix}_` : ""}${ulid()}`;

const q = qler();

// ============================================================
// dispatchOp - sophisticated version that uses state lookups
// ============================================================

const getSelectorForId = (state: any, id: string) => {
  const node = state?.indexes?.nodes?.[id];
  if (!node) return undefined;
  const zoneCompound = `${node.parentId}:${node.zone}`;
  const index = state.indexes.zones[zoneCompound]?.contentIds?.indexOf(id);
  return { zone: zoneCompound, index };
};

const getItemById = (state: any, id: string) => state?.indexes?.nodes?.[id]?.data;

const applyArrayDefaults = (oldProps: any, newProps: any, fields: any) => {
  const updatedProps = { ...oldProps, ...newProps };
  for (const fieldName in fields) {
    const field = fields[fieldName];
    if (field.type === "array") {
      const arrayField = field;
      const arrayFields = arrayField.arrayFields;
      updatedProps[fieldName] = (updatedProps[fieldName] || []).map((item: any, index: number) => {
        const newItem: any = {};
        const defaultValue =
          typeof arrayField.defaultItemProps === "function"
            ? arrayField.defaultItemProps(index)
            : arrayField.defaultItemProps;
        for (const arrayFieldName in arrayFields) {
          const subField = arrayFields[arrayFieldName];
          if (subField.type === "slot") {
            newItem[arrayFieldName] =
              item[arrayFieldName] ??
              oldProps[fieldName]?.[index]?.[arrayFieldName] ??
              defaultValue?.[arrayFieldName];
          } else {
            newItem[arrayFieldName] = item[arrayFieldName] ?? defaultValue?.[arrayFieldName];
          }
        }
        return newItem;
      });
    }
  }
  return updatedProps;
};

const dispatchOp = (
  operation: Operation,
  { getState, dispatchAction, config }: { getState: () => any; dispatchAction: (action: any) => void; config: Config }
) => {
  const state = getState();
  try {
    if (operation.op === "add") {
      if (operation.zone) {
        dispatchAction({
          type: "insert",
          destinationIndex: operation.index,
          destinationZone: operation.zone,
          componentType: operation.type,
          id: operation.id,
          recordHistory: false,
        });
        const existing = getItemById(getState(), operation.id);
        if (!existing) {
          throw new Error(`Tried to update an item that doesn't exist: ${operation.id}`);
        }
        const newData = {
          ...existing,
          props: applyArrayDefaults(
            existing.props,
            operation.props,
            config.components[existing.type]?.fields ?? {}
          ),
        };
        dispatchAction({
          type: "replace",
          destinationIndex: operation.index,
          destinationZone: operation.zone,
          data: newData,
          recordHistory: false,
        });
      }
    } else if (operation.op === "update") {
      const selector = getSelectorForId(state, operation.id);
      const existing = getItemById(state, operation.id);
      if (!selector || !existing) {
        throw new Error(`Tried to update an item that doesn't exist: ${operation.id}`);
      }
      const newData = {
        ...existing,
        props: applyArrayDefaults(
          existing.props,
          operation.props,
          config.components[existing.type]?.fields ?? {}
        ),
      };
      dispatchAction({
        type: "replace",
        destinationIndex: selector.index,
        destinationZone: selector.zone,
        data: newData,
        recordHistory: false,
      });
    } else if (operation.op === "updateRoot") {
      const existing = state?.data?.root;
      const defaultProps = (config as any).root?.defaultProps ?? {};
      dispatchAction({
        type: "replaceRoot",
        root: {
          ...existing,
          props: {
            ...defaultProps,
            ...existing?.props,
            ...operation.props,
          },
        },
        recordHistory: false,
      });
    } else if (operation.op === "delete") {
      const selector = getSelectorForId(state, operation.id);
      if (!selector) {
        throw new Error(`Tried to delete an item that doesn't exist: ${operation.id}`);
      }
      dispatchAction({
        type: "remove",
        zone: selector.zone,
        index: selector.index,
        recordHistory: false,
      });
    } else if (operation.op === "duplicate") {
      const selector = getSelectorForId(state, operation.id);
      if (!selector) {
        throw new Error(`Tried to duplicate an item that doesn't exist: ${operation.id}`);
      }
      dispatchAction({
        type: "duplicate",
        sourceZone: selector.zone,
        sourceIndex: selector.index,
        recordHistory: false,
      });
    } else if (operation.op === "move") {
      const selector = getSelectorForId(state, operation.id);
      if (!selector) {
        throw new Error(`Tried to move an item that doesn't exist: ${operation.id}`);
      }
      dispatchAction({
        type: "move",
        sourceZone: selector.zone,
        sourceIndex: selector.index,
        destinationIndex: operation.index,
        destinationZone: operation.zone,
        recordHistory: false,
      });
    } else if ((operation as Operation).op === "reset") {
      const defaultRootProps = (config as any).root?.defaultProps ?? {};
      dispatchAction({
        type: "setData",
        data: { content: [], root: defaultRootProps },
        recordHistory: false,
      });
    } else {
      throw new Error(`Unknown operation: ${(operation as any).op}`);
    }
  } catch (e) {
    console.error("Error applying operation, skipping...", operation, e);
  }
};

// ============================================================
// Tool status context
// ============================================================

const toolStatusContext = createContext<Record<string, ToolStatus>>({});
const ToolStatusProvider = toolStatusContext.Provider;

// ============================================================
// Loader component
// ============================================================

function Loader({ size = 16 }: { size?: number }) {
  return (
    <span
      className="puck-ai-loader"
      style={{ width: size, height: size }}
      aria-label="loading"
    />
  );
}

// ============================================================
// ToolStatus display component
// ============================================================

function ToolStatusDisplay({ status }: { status: ToolStatus }) {
  return (
    <div className="puck-ai-chat-message-data">
      <div className="puck-ai-chat-message-data-inner">
        <div className="puck-ai-chat-message-data-icon">
          {status.error ? (
            <TriangleAlert size={18} />
          ) : status.loading ? (
            <Loader size={16} />
          ) : (
            <Check size={18} />
          )}
        </div>
        <div>{status.label}</div>
      </div>
    </div>
  );
}

// ============================================================
// PuckTool component for tool call parts
// ============================================================

function PuckTool({
  toolCallId,
  output,
  status: mergedStatus,
  defaultLabel = "Thinking...",
}: {
  toolCallId: string;
  output?: any;
  status?: ToolStatus;
  defaultLabel?: string;
}) {
  const toolStatusMap = useContext(toolStatusContext);
  const contextStatus = toolStatusMap[toolCallId];
  const outputObj = output as any;
  const status: ToolStatus =
    mergedStatus ??
    (outputObj && "status" in outputObj
      ? outputObj.status
      : contextStatus ?? { loading: true, label: defaultLabel });
  return <ToolStatusDisplay status={status} />;
}

function safeJsonPreview(value: unknown, maxLen = 4000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n…`;
  } catch {
    return String(value);
  }
}

function FileMessagePart({
  part,
  role,
}: {
  part: { mediaType: string; url: string; filename?: string };
  role: string;
}) {
  const isImage = part.mediaType.startsWith("image/");
  if (isImage) {
    return (
      <div
        className={`puck-ai-chat-message-file${role === "user" ? " puck-ai-chat-message-file--user" : ""}`}
      >
        <img
          src={part.url}
          alt={part.filename ?? "Attached image"}
          className="puck-ai-chat-message-file-image"
        />
        {part.filename ? (
          <span className="puck-ai-chat-message-file-caption">{part.filename}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="puck-ai-chat-message-file puck-ai-chat-message-file--document">
      <a href={part.url} target="_blank" rel="noopener noreferrer" download={part.filename}>
        {part.filename ?? part.mediaType}
      </a>
    </div>
  );
}

function ReasoningMessagePart({ part }: { part: { text: string; state?: string } }) {
  const streaming = part.state === "streaming";
  return (
    <details className="puck-ai-chat-message-reasoning" open={streaming}>
      <summary className="puck-ai-chat-message-reasoning-summary">
        Reasoning
        {streaming ? (
          <span className="puck-ai-chat-message-reasoning-streaming" aria-live="polite">
            <Loader size={12} />
          </span>
        ) : null}
      </summary>
      <div className="puck-ai-chat-message-reasoning-body">
        <ReactMarkdown>{part.text}</ReactMarkdown>
      </div>
    </details>
  );
}

function SdkToolInvocation({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const name = getToolName(part);
  const state = part.state;
  let stateLabel: string;
  if (state === "input-streaming") stateLabel = "Preparing…";
  else if (state === "input-available") stateLabel = "Running…";
  else if (state === "output-available") stateLabel = "Done";
  else if (state === "output-error") stateLabel = "Error";
  else if (state === "approval-requested") stateLabel = "Awaiting approval";
  else if (state === "approval-responded") stateLabel = "Approval recorded";
  else if (state === "output-denied") stateLabel = "Denied";
  else stateLabel = state;

  const loading =
    state === "input-streaming" || state === "input-available" || state === "approval-requested";

  const input = "input" in part ? part.input : undefined;
  const output = "output" in part ? part.output : undefined;
  const errorText = "errorText" in part ? part.errorText : undefined;

  return (
    <div className="puck-ai-chat-message-tool">
      <div className="puck-ai-chat-message-tool-header">
        <span className="puck-ai-chat-message-tool-icon" aria-hidden>
          <Wrench size={14} />
        </span>
        <span className="puck-ai-chat-message-tool-name">{name}</span>
        <span className="puck-ai-chat-message-tool-state">
          {loading ? <Loader size={12} /> : null}
          {stateLabel}
        </span>
      </div>
      {state === "output-error" && errorText ? (
        <div className="puck-ai-chat-message-tool-error">{errorText}</div>
      ) : null}
      <details className="puck-ai-chat-message-tool-details">
        <summary>Input / output</summary>
        {input !== undefined ? (
          <pre className="puck-ai-chat-message-tool-pre">{safeJsonPreview(input)}</pre>
        ) : null}
        {state === "output-available" && output !== undefined ? (
          <pre className="puck-ai-chat-message-tool-pre">{safeJsonPreview(output)}</pre>
        ) : null}
      </details>
    </div>
  );
}

function DataMessagePart({ part }: { part: DataUIPart<PuckDataParts> }) {
  if (part.type === "data-puck-actions") {
    const actions = part.data as PuckAction[];
    return (
      <div className="puck-ai-chat-message-data-summary">
        Applied {actions.length} editor action{actions.length === 1 ? "" : "s"}
      </div>
    );
  }
  if (part.type === "data-build-op") {
    const op = part.data as Operation;
    return (
      <div className="puck-ai-chat-message-data-summary">
        Build operation: <code>{op.op}</code>
      </div>
    );
  }
  if (part.type === "data-finish") {
    const d = part.data as DataFinish;
    return (
      <div className="puck-ai-chat-message-data-summary">
        Tokens: in {d.tokenUsage?.inputTokens ?? "—"} · out {d.tokenUsage?.outputTokens ?? "—"}
        {d.totalCost !== undefined ? ` · cost ${d.totalCost}` : ""}
      </div>
    );
  }
  if (part.type === "data-page") {
    return <div className="puck-ai-chat-message-data-summary">Page snapshot attached</div>;
  }
  if (part.type === "data-new-chat-created" || part.type === "data-tool-status" || part.type === "data-send-screenshot") {
    return null;
  }
  return (
    <details className="puck-ai-chat-message-data-raw">
      <summary>{part.type.replace(/^data-/, "")}</summary>
      <pre className="puck-ai-chat-message-tool-pre">{safeJsonPreview(part.data)}</pre>
    </details>
  );
}

// ============================================================
// ChatMessagePart
// ============================================================

function ChatMessagePart({ part, role }: { part: any; role: string }) {
  if (isTextUIPart(part)) {
    return (
      <div className="puck-ai-chat-message-text">
        {role === "assistant" || role === "user" ? (
          <ReactMarkdown>{part.text}</ReactMarkdown>
        ) : (
          <span>{part.text}</span>
        )}
      </div>
    );
  }
  if (isReasoningUIPart(part)) {
    return <ReasoningMessagePart part={part} />;
  }
  if (isFileUIPart(part)) {
    return <FileMessagePart part={part} role={role} />;
  }
  if (part.type === "source-url") {
    return (
      <div className="puck-ai-chat-message-source">
        <a href={part.url} target="_blank" rel="noopener noreferrer">
          {part.title ?? part.url}
        </a>
      </div>
    );
  }
  if (part.type === "source-document") {
    return (
      <div className="puck-ai-chat-message-source">
        <span title={part.filename}>{part.title}</span>
        <span className="puck-ai-chat-message-source-meta">{part.mediaType}</span>
      </div>
    );
  }
  if (part.type === "step-start") {
    return <div className="puck-ai-chat-message-step" aria-hidden />;
  }
  if (isToolUIPart(part)) {
    if (
      part.type === "tool-createPage" ||
      part.type === "tool-updatePage" ||
      part.type === "tool-userTool"
    ) {
      return <PuckTool {...part} />;
    }
    return <SdkToolInvocation part={part} />;
  }
  if (isDataUIPart(part)) {
    return <DataMessagePart part={part as DataUIPart<PuckDataParts>} />;
  }
  return null;
}

// ============================================================
// ChatMessage
// ============================================================

function ChatMessage({ message }: { message: PuckMessage }) {
  const { role, parts } = message;
  return (
    <div
      className={`puck-ai-chat-message${role === "user" ? " puck-ai-chat-message--user-role" : ""}`}
      data-message-id={message.id}
    >
      {parts.map((part: any, i: number) => (
        <ChatMessagePart
          key={`${message.id}-${part.type}-${i}`}
          part={part}
          role={role}
        />
      ))}
    </div>
  );
}

// ============================================================
// ExamplePrompt
// ============================================================

function ExamplePrompt({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const El = href ? "a" : "button";
  return (
    <El className="puck-ai-chatbody-example-prompt" href={href as any} onClick={onClick}>
      <div>{label}</div>
      <div className="puck-ai-chatbody-example-prompt-arrow">
        <ArrowUp size={16} />
      </div>
    </El>
  );
}

// ============================================================
// PromptForm
// ============================================================

function PromptForm({
  handleSubmit,
  inputRef,
  isLoading,
  glow,
  placeholder = "What do you want to build?",
  minRows = 2,
  maxRows = 5,
  value = "",
  images = [],
  onImagesChange,
}: {
  handleSubmit: (prompt: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  isLoading?: boolean;
  glow?: boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  value?: string;
  images?: AttachedImage[];
  onImagesChange?: (imgs: AttachedImage[]) => void;
}) {
  const [prompt, setPrompt] = useState(value);
  const [isDragOver, setIsDragOver] = useState(false);
  const hasSetInitialPrompt = useRef(false);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPrompt(value);
  }, [value]);

  useEffect(() => {
    const currentUrl = new URL(location.href);
    const initialPrompt = currentUrl.searchParams.get("initialPrompt");
    if (!hasSetInitialPrompt.current && initialPrompt && prompt === "") {
      hasSetInitialPrompt.current = true;
      setPrompt(initialPrompt);
    }
  }, []);

  const addImages = useCallback(async (files: FileList | File[]) => {
    const newImgs = await filesToAttachedImages(files);
    if (newImgs.length > 0) {
      onImagesChange?.([...images, ...newImgs]);
    }
  }, [images, onImagesChange]);

  const removeImage = useCallback((id: string) => {
    onImagesChange?.(images.filter((img) => img.id !== id));
  }, [images, onImagesChange]);

  const sendPrompt = () => {
    if (isLoading) return;
    if (prompt.trim() || images.length > 0) {
      handleSubmit(prompt);
    }
    setPrompt("");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.some((t) => t === "Files")) {
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      await addImages(e.dataTransfer.files);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length > 0) {
      await addImages(imageFiles);
    }
  };

  const classNames = [
    "puck-ai-prompt-form",
    glow ? "puck-ai-prompt-form--glow" : "",
    isLoading ? "puck-ai-prompt-form--is-loading" : "",
    isDragOver ? "puck-ai-prompt-form--drag-over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="puck-ai-prompt-form-inner">
        <span className="puck-ai-prompt-form-glow" />
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            if (e.target.files) {
              await addImages(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt();
          }}
        >
          {/* Image thumbnails strip */}
          {images.length > 0 && (
            <div className="puck-ai-image-thumbnails">
              {images.map((img) => (
                <div key={img.id} className="puck-ai-image-thumbnail">
                  <img src={img.dataUrl} alt={img.name} />
                  <button
                    type="button"
                    className="puck-ai-image-thumbnail-remove"
                    onClick={() => removeImage(img.id)}
                    title="Remove image"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="puck-ai-prompt-form-form-inner">
            <TextareaAutosize
              className="puck-ai-prompt-form-input"
              name="prompt"
              minRows={minRows}
              maxRows={maxRows}
              placeholder={
                isDragOver ? "Drop images here…" : placeholder
              }
              disabled={isLoading}
              value={prompt}
              ref={(node) => {
                if (inputRef) {
                  (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
                }
                internalRef.current = node;
              }}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (!e.shiftKey && e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              onKeyUp={(e) => {
                if (!e.shiftKey && e.key === "Enter") {
                  e.preventDefault();
                  sendPrompt();
                }
              }}
            />
            <div
              className="puck-ai-prompt-form-actions"
              onClick={() => internalRef.current?.focus()}
            >
              <div
                className="puck-ai-prompt-form-actions-left"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="puck-ai-image-attach-btn"
                  title="Attach image"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <ImageIcon size={15} />
                </button>
              </div>
              <div
                className="puck-ai-prompt-form-actions-right"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="puck-ai-prompt-form-action-submit"
                  type="submit"
                  disabled={isLoading}
                >
                  <ArrowUp size={24} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// ChatBody
// ============================================================

function ChatBody({
  children,
  examplePrompts,
  handleSubmit,
  hideInput,
  inputRef,
  messages = [],
  status,
  error,
  handleRetry,
  promptValue,
  targetComponent,
  onClearTarget,
  images,
  onImagesChange,
}: {
  children?: ReactNode;
  examplePrompts?: ReactNode;
  handleSubmit: (prompt: string) => void;
  hideInput?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  messages?: PuckMessage[];
  status: ChatStatus;
  error?: string;
  handleRetry?: () => void;
  promptValue?: string;
  targetComponent?: TargetComponent | null;
  onClearTarget?: () => void;
  images?: AttachedImage[];
  onImagesChange?: (imgs: AttachedImage[]) => void;
}) {
  const { scrollRef, contentRef } = useStickToBottom();
  const hasMessages = messages && messages.length > 0;

  const classNames = [
    "puck-ai-chatbody",
    hasMessages ? "puck-ai-chatbody--has-messages" : "",
    children ? "puck-ai-chatbody--has-children" : "",
    hideInput ? "puck-ai-chatbody--hide-input" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      {children ? <div className="puck-ai-chatbody-default">{children}</div> : null}
      <div className="puck-ai-chatbody-inner" ref={scrollRef}>
        <div className="puck-ai-chatbody-messages" ref={contentRef}>
          {[...messages].reverse().map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
        {status === "submitted" && (
          <div className="puck-ai-chatbody-loader">
            <Loader size={14} />
          </div>
        )}
        {error && (
          <div className="puck-ai-chatbody-error">
            <div className="puck-ai-chatbody-error-label">Something went wrong.</div>
            {handleRetry && (
              <div className="puck-ai-chatbody-error-action">
                <button
                  className="puck-ai-icon-button"
                  title="Retry"
                  onClick={handleRetry}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="puck-ai-chatbody-form">
          {targetComponent && (
            <div className="puck-ai-target-banner">
              <span className="puck-ai-target-banner-label">
                Targeting:
              </span>
              <span className="puck-ai-target-banner-name">
                {targetComponent.label || targetComponent.type}
              </span>
              <code className="puck-ai-target-banner-id">
                {targetComponent.id}
              </code>
              {onClearTarget && (
                <button
                  className="puck-ai-target-banner-clear"
                  onClick={onClearTarget}
                  title="Clear target"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <PromptForm
            glow={!hasMessages && !targetComponent}
            handleSubmit={handleSubmit}
            inputRef={inputRef}
            isLoading={status === "submitted" || status === "streaming"}
            placeholder={
              targetComponent
                ? `What should I do with the ${targetComponent.label || targetComponent.type}?`
                : "What do you want to build?"
            }
            value={promptValue}
            images={images}
            onImagesChange={onImagesChange}
          />
          {examplePrompts ? (
            <div className="puck-ai-chatbody-example-prompts">{examplePrompts}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Placeholder (shown when no messages)
// ============================================================

function isScrolledIntoView(el: Element) {
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

function Placeholder({
  dispatch,
  inputRef,
  pluginRef,
}: {
  dispatch: (action: any) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  pluginRef: React.RefObject<HTMLDivElement | null>;
}) {
  const handleEnterPromptClick = () => {
    inputRef.current?.focus({ preventScroll: true });
    setTimeout(() => {
      if (pluginRef.current && inputRef.current && !isScrolledIntoView(inputRef.current)) {
        const box = pluginRef.current.getBoundingClientRect();
        const top = box.top - (window.innerHeight - box.height) / 2;
        window.scrollTo({ behavior: "smooth", top });
      }
    }, 10);
  };

  return (
    <div className="puck-ai-chat-placeholder">
      <Bot size={24} />
      <div>Use AI to build a page using the available blocks</div>
      <div className="puck-ai-chat-actions">
        <button className="puck-ai-chat-action" onClick={handleEnterPromptClick}>
          Enter prompt
        </button>
        <button
          className="puck-ai-chat-action-outlined"
          onClick={() => {
            dispatch({ type: "setUi", ui: { plugin: { current: "blocks" } } });
          }}
        >
          Build manually
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ScrollTracking
// ============================================================

function scrollIntoViewLocal(el: Element, win: Window, behavior: ScrollBehavior = "smooth") {
  const scroller =
    (el.ownerDocument?.scrollingElement as HTMLElement) ||
    (el.ownerDocument?.documentElement as HTMLElement);
  const rect = el.getBoundingClientRect();
  const vpH = win.innerHeight;
  const current = scroller.scrollTop;
  const offset = win.innerHeight / 2;
  let targetTop = current;
  if (rect.top < 0) {
    targetTop = current + rect.top;
  } else if (rect.bottom > vpH) {
    targetTop = current + (rect.bottom - vpH);
  }
  if (targetTop !== current) {
    scroller.scrollTo({ top: targetTop + offset, behavior });
  }
}

function useFrameMutationObserver(callback: (entries: MutationRecord[], win: Window) => void) {
  return useCallback(() => {
    const frame = document?.getElementById("preview-frame") as HTMLIFrameElement | null;
    if (!frame) return;
    let observer: MutationObserver | null = null;
    const win = frame.contentWindow;
    let enabled = true;
    const disable = () => { enabled = false; };
    const attachObserver = () => {
      const win2 = frame.contentWindow;
      const doc = frame.contentDocument || win2?.document;
      if (!win2 || !doc) return;
      const target = doc.querySelector("#frame-root > div");
      if (!target) return;
      observer = new MutationObserver((entries) => {
        if (enabled) callback(entries, win2);
      });
      observer.observe(target, { childList: true, subtree: true });
      win2.addEventListener("pointerdown", disable);
      win2.addEventListener("wheel", disable);
    };
    if (frame.contentDocument?.readyState === "complete") {
      attachObserver();
    } else {
      frame.addEventListener("load", attachObserver, { once: true });
    }
    return () => {
      frame.removeEventListener("load", attachObserver);
      win?.removeEventListener("pointerdown", disable);
      win?.removeEventListener("wheel", disable);
      observer?.disconnect();
    };
  }, [callback]);
}

function ScrollTracking({ children }: { children: ReactNode }) {
  const followedRefs = useRef<Element[]>([]);
  const follow = useFrameMutationObserver((records, win) => {
    if (records.length > 0) {
      const lastRecord = records[records.length - 1];
      if (followedRefs.current.includes(lastRecord.target as Element)) return;
      followedRefs.current.push(lastRecord.target as Element);
      requestAnimationFrame(() => {
        const el = lastRecord.target as Element;
        scrollIntoViewLocal(el, win);
      });
    }
  });
  useEffect(() => {
    const cleanup = follow();
    return cleanup;
  }, [follow]);
  return <>{children}</>;
}

// ============================================================
// Toggle switch
// ============================================================

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label className="puck-ai-toggle" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="puck-ai-toggle-input"
      />
      <span className="puck-ai-toggle-slider" />
    </label>
  );
}

// ============================================================
// SettingsPanel
// ============================================================

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: AiSettings;
  onChange: (update: Partial<AiSettings>) => void;
}) {
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="puck-ai-settings-scroll">
      <div className="puck-ai-settings">
        <div className="puck-ai-settings-section">
          <div className="puck-ai-settings-section-title">Model settings</div>

          <div className="puck-ai-settings-row">
            <label className="puck-ai-settings-label" htmlFor="puck-ai-thinking-level">
              Thinking level
              <span className="puck-ai-settings-hint">Extended reasoning budget</span>
            </label>
            <select
              id="puck-ai-thinking-level"
              className="puck-ai-settings-select"
              value={settings.thinkingLevel}
              onChange={(e) => onChange({ thinkingLevel: e.target.value as ThinkingLevel })}
            >
              <option value="none">Off</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="puck-ai-settings-row">
            <label className="puck-ai-settings-label" htmlFor="puck-ai-url-context">
              URL context
              <span className="puck-ai-settings-hint">Fetch linked URLs during generation</span>
            </label>
            <Toggle
              id="puck-ai-url-context"
              checked={settings.urlContext}
              onChange={(v) => onChange({ urlContext: v })}
            />
          </div>

          <div className="puck-ai-settings-row">
            <label className="puck-ai-settings-label" htmlFor="puck-ai-google-search">
              Google Search
              <span className="puck-ai-settings-hint">Ground responses with live search</span>
            </label>
            <Toggle
              id="puck-ai-google-search"
              checked={settings.googleSearch}
              onChange={(v) => onChange({ googleSearch: v })}
            />
          </div>

          <div className="puck-ai-settings-row">
            <label className="puck-ai-settings-label" htmlFor="puck-ai-enterprise-search">
              Enterprise web search
              <span className="puck-ai-settings-hint">Advanced grounding via Vertex AI</span>
            </label>
            <Toggle
              id="puck-ai-enterprise-search"
              checked={settings.enterpriseWebSearch}
              onChange={(v) => onChange({ enterpriseWebSearch: v })}
            />
          </div>
        </div>

        <div className="puck-ai-settings-section">
          <div className="puck-ai-settings-section-title">Figma integration</div>

          <div className="puck-ai-settings-row puck-ai-settings-row--column">
            <label className="puck-ai-settings-label" htmlFor="puck-ai-figma-token">
              Personal access token
            </label>
            <div className="puck-ai-settings-input-wrap">
              <input
                id="puck-ai-figma-token"
                type={showToken ? "text" : "password"}
                className="puck-ai-settings-input"
                placeholder="figd_xxxxxxxxxxxx"
                value={settings.figmaToken}
                onChange={(e) => onChange({ figmaToken: e.target.value })}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="puck-ai-settings-input-action"
                onClick={() => setShowToken((v) => !v)}
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <a
              href="https://www.figma.com/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="puck-ai-settings-link"
            >
              Get your Figma access token →
            </a>
            <span className="puck-ai-settings-hint" style={{ marginTop: 4 }}>
              Paste a Figma URL in chat to generate from your design. Token overrides server config.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// usePuck store hook (singleton per plugin instance)
// ============================================================

const usePuck = createUsePuck();

// ============================================================
// Main Chat component
// ============================================================

export function Chat({
  chat,
  host = "/api/puck/chat",
  prepareRequest,
  settings,
}: {
  chat?: AiPluginProps["chat"];
  host?: string;
  prepareRequest?: AiPluginProps["prepareRequest"];
  settings?: AiPluginProps["settings"];
}) {
  const { examplePrompts } = chat ?? {};
  const puckDispatch = (usePuck as any)((s: any) => s.dispatch);
  const getPuck = useGetPuck();
  const localChatId = useRef("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pluginRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [toolStatus, setToolStatus] = useState<Record<string, ToolStatus>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useAiSettings(settings?.storageKey);
  const aiSettingsRef = useRef<AiSettings>(aiSettings);
  useEffect(() => {
    aiSettingsRef.current = aiSettings;
  }, [aiSettings]);

  const uploadScreenshot = useCallback(
    async (width: number, bucketUrl: string) => {
      const iframeDocument =
        (document?.getElementById("preview-frame") as HTMLIFrameElement | null)
          ?.contentDocument?.documentElement ?? null;
      if (!iframeDocument) return;
      const canvas = await html2canvas(iframeDocument, {
        scale: 2,
        backgroundColor: "#ffffff",
        width,
        windowWidth: width,
        foreignObjectRendering: false,
        imageTimeout: 30000,
        logging: false,
        allowTaint: false,
        useCORS: true,
        scrollY: 0,
        ignoreElements: (el: Element) =>
          Array.from(el.classList).some(
            (c) =>
              c.startsWith("_DraggableComponent--hover") ||
              c.startsWith("_ActionBar")
          ),
      });
      const image = canvas.toDataURL("image/webp", 0.8);
      const blob = await (await fetch(image)).blob();
      await fetch(bucketUrl, { method: "PUT", body: blob });
    },
    []
  );

  const processData = useCallback(
    (dataPart: DataUIPart<PuckDataParts>) => {
      switch (dataPart.type) {
        case "data-new-chat-created": {
          localChatId.current = (dataPart.data as any).chatId;
          return;
        }
        case "data-puck-actions": {
          (dataPart.data as PuckAction[]).forEach((action) => {
            try {
              puckDispatch(action);
            } catch (e) {
              console.error("Bad action: ", action);
              console.error(e);
            }
          });
          return;
        }
        case "data-build-op": {
          const data = dataPart.data as Operation;
          q.queue(() => {
            const puck = getPuck() as any;
            if (!puck) return;
            dispatchOp(data, {
              getState: () => puck.__private?.appState,
              dispatchAction: puck.dispatch,
              config: puck.config,
            });
          });
          return;
        }
        case "data-tool-status": {
          const { toolCallId, status: toolSt } = dataPart.data as DataToolStatus;
          setToolStatus((s) => ({ ...s, [toolCallId]: toolSt }));
          return;
        }
        case "data-send-screenshot": {
          const { urls } = dataPart.data as PuckDataParts["send-screenshot"];
          urls.forEach((obj) => {
            const entries = Object.entries(obj);
            if (entries.length === 0) return;
            const [key, value] = entries[0];
            const breakpoint = Number(key);
            uploadScreenshot(breakpoint, value as string);
          });
          return;
        }
        default:
          console.warn("dataPart without case:", dataPart);
          return;
      }
    },
    [getPuck, puckDispatch, uploadScreenshot]
  );

  const { messages, status, sendMessage, regenerate, setMessages } = useChat({
    generateId: () => prefixedUlid("msg"),
    messages: [],
    transport: new DefaultChatTransport({
      api: host,
      prepareSendMessagesRequest: async (opts: any) => {
        const puck = getPuck() as any;
        const config = puck?.config ?? { components: {} };
        const appState = puck?.appState ?? { data: { root: { props: {} }, content: [], zones: {} } };

        const root = config.root ?? {
          fields: {
            title: {
              type: "text",
              ai: { instructions: "The title for the page" },
            },
          },
        };
        const configWithRoot = { ...config, root };

        const currentSettings = aiSettingsRef.current;
        const geminiConfig: Record<string, unknown> = {};
        if (currentSettings.thinkingLevel !== "none") geminiConfig.thinkingLevel = currentSettings.thinkingLevel;
        if (currentSettings.urlContext) geminiConfig.urlContext = true;
        if (currentSettings.googleSearch) geminiConfig.googleSearch = true;
        if (currentSettings.enterpriseWebSearch) geminiConfig.enterpriseWebSearch = true;
        if (currentSettings.figmaToken) geminiConfig.figmaToken = currentSettings.figmaToken;

        const defaultBody = {
          ...opts.body,
          chatId: localChatId.current,
          trigger: opts.trigger,
          messages: opts.messages,
          pageData: appState.data,
          config: configWithRoot,
          ...(Object.keys(geminiConfig).length > 0 ? { geminiConfig } : {}),
          // Read from refs to avoid stale closures — state values captured at
          // initial render would always be their initial values here.
          ...(targetComponentRef.current
            ? { selectedComponentId: targetComponentRef.current.id }
            : {}),
          // Consume (read + clear) the pending images for this request.
          // The ref is populated synchronously in handleSubmit before sendMessage
          // is called, so the value is always available here even though
          // prepareSendMessagesRequest runs asynchronously after a render cycle.
          ...(pendingSendImagesRef.current.length > 0
            ? (() => {
                const imgs = pendingSendImagesRef.current;
                pendingSendImagesRef.current = [];
                return { images: imgs };
              })()
            : {}),
        };

        const defaultOptions: RequestOptions = {
          headers: opts.headers,
          credentials: opts.credentials,
          body: defaultBody,
        };

        if (prepareRequest) {
          const userOptions = await prepareRequest(defaultOptions);
          return {
            headers: { ...defaultOptions.headers, ...userOptions.headers },
            credentials: userOptions.credentials ?? defaultOptions.credentials,
            body: { ...defaultBody, ...userOptions.body },
          };
        }
        return {
          headers: defaultOptions.headers,
          credentials: defaultOptions.credentials,
          body: defaultBody,
        };
      },
    }),
    onData: processData,
    onError: (e: Error) => {
      console.error(e);
      setError(e.message);
    },
    onFinish: () => {
      const puck = getPuck() as any;
      if (puck?.appState) {
        puckDispatch({ type: "set", state: puck.appState, recordHistory: true });
      }
    },
  } as any);

  const [forcedStatus, setForcedStatus] = useState<ChatStatus | undefined>();
  const resolvedStatus = useMemo(
    () => forcedStatus ?? status,
    [status, forcedStatus]
  );

  const [promptValue, setPromptValue] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  // "Pending send" ref: populated synchronously in handleSubmit, consumed
  // (read + cleared) inside prepareSendMessagesRequest.
  // We intentionally do NOT use useEffect to sync this ref because
  // useEffect runs after render — by then the SDK may already have called
  // prepareSendMessagesRequest with a stale (empty) value.
  const pendingSendImagesRef = useRef<string[]>([]);

  const [targetComponent, setTargetComponent] = useState<TargetComponent | null>(null);
  // Ref so prepareSendMessagesRequest (defined once inside useChat) always reads the latest value.
  const targetComponentRef = useRef<TargetComponent | null>(null);
  useEffect(() => {
    targetComponentRef.current = targetComponent;
  }, [targetComponent]);

  useEffect(() => {
    window.__PUCK_AI = {
      processData: processData as any,
      setMessages: setMessages as any,
      setStatus: setForcedStatus,
      sendMessage: sendMessage as any,
      setPrompt: (value: string) => {
        setPromptValue(value);
        inputRef.current?.focus();
      },
      setTargetComponent: (target: TargetComponent | null) => {
        setTargetComponent(target);
        inputRef.current?.focus();
      },
    };
  }, [processData, setMessages, sendMessage]);

  const handleSubmit = (prompt: string) => {
    const text = prompt.trim();
    if (chat?.onSubmit) {
      chat.onSubmit(text);
      return;
    }
    if (!text && attachedImages.length === 0) return;
    setError("");
    setPromptValue("");
    // Synchronously snapshot images into the pending-send ref BEFORE calling
    // setAttachedImages([]).  prepareSendMessagesRequest is async (runs after
    // a render cycle), so we cannot rely on state or a useEffect-synced ref —
    // they would already be cleared by then.
    pendingSendImagesRef.current = attachedImages.map((img) => img.dataUrl);
    setAttachedImages([]);
    // Don't clear targetComponent on submit — let it persist across follow-up messages
    (sendMessage as any)({ text }).catch((e: Error) => {
      console.error(e);
    });
  };

  const messagesWithStatuses = useMemo(() => {
    return (messages as PuckMessage[]).map((msg) => ({
      ...msg,
      parts: msg.parts.map((part: any) => {
        if ("toolCallId" in part) {
          return { ...part, status: toolStatus[part.toolCallId] };
        }
        return part;
      }),
    }));
  }, [messages, toolStatus]);

  return (
    <div className="puck-ai-chat" ref={pluginRef}>
      <div className="puck-ai-chat-header">
        {showSettings && (
          <button
            className="puck-ai-icon-button"
            onClick={() => setShowSettings(false)}
            title="Back to chat"
            type="button"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <span className="puck-ai-chat-header-title">
          {showSettings ? "Settings" : "AI page builder"}
        </span>
        {!showSettings && (
          <button
            className="puck-ai-icon-button"
            onClick={() => setShowSettings(true)}
            title="Settings"
            type="button"
          >
            <Settings size={16} />
          </button>
        )}
      </div>
      {showSettings ? (
        <SettingsPanel settings={aiSettings} onChange={setAiSettings} />
      ) : (
        <ToolStatusProvider value={toolStatus}>
          <ChatBody
            messages={messagesWithStatuses}
            handleSubmit={handleSubmit}
            inputRef={inputRef}
            status={resolvedStatus}
            examplePrompts={examplePrompts?.map(({ label, href, onClick }) => (
              <ExamplePrompt key={label} label={label} href={href} onClick={onClick} />
            ))}
            error={error}
            handleRetry={() => {
              setError("");
              regenerate();
            }}
            promptValue={promptValue}
            targetComponent={targetComponent}
            onClearTarget={() => setTargetComponent(null)}
            images={attachedImages}
            onImagesChange={setAttachedImages}
          >
            <Placeholder dispatch={puckDispatch} inputRef={inputRef} pluginRef={pluginRef} />
          </ChatBody>
        </ToolStatusProvider>
      )}
    </div>
  );
}

// ============================================================
// createAiPlugin
// ============================================================

export function createAiPlugin(opts: AiPluginProps = {}): Plugin {
  const { scrollTracking = true, host, chat, prepareRequest, settings } = opts;

  return {
    label: "AI",
    name: "ai",
    icon: <Bot />,
    mobilePanelHeight: "min-content",
    render: (): ReactElement => (
      <Chat host={host} chat={chat} prepareRequest={prepareRequest} settings={settings} />
    ),
    overrides: {
      preview: ({ children }: { children: ReactNode }): ReactElement => {
        if (scrollTracking) {
          return <ScrollTracking>{children}</ScrollTracking> as ReactElement;
        }
        return <>{children}</> as ReactElement;
      },
    },
  };
}

export default createAiPlugin;
