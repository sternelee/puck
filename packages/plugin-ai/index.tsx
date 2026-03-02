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
  type UIMessage,
  type DataUIPart,
  type ChatStatus,
  type CreateUIMessage,
  type LanguageModelUsage,
} from "ai";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { useStickToBottom } from "use-stick-to-bottom";
import {
  ArrowUp,
  Bot,
  Check,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import qler from "qler";
import { ulid } from "ulid";
import html2canvas from "html2canvas-pro";
import "./styles.css";

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
  defaultLabel = "Thinking...",
}: {
  toolCallId: string;
  output?: any;
  defaultLabel?: string;
}) {
  const toolStatusMap = useContext(toolStatusContext);
  const contextStatus = toolStatusMap[toolCallId];
  const outputObj = output as any;
  const status: ToolStatus =
    outputObj && "status" in outputObj
      ? outputObj.status
      : contextStatus ?? { loading: true, label: defaultLabel };
  return <ToolStatusDisplay status={status} />;
}

// ============================================================
// ChatMessagePart
// ============================================================

function ChatMessagePart({ part, role }: { part: any; role: string }) {
  if (part.type === "text") {
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
  if (
    part.type === "tool-createPage" ||
    part.type === "tool-updatePage" ||
    part.type === "tool-userTool"
  ) {
    return <PuckTool {...part} />;
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
}: {
  handleSubmit: (prompt: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  isLoading?: boolean;
  glow?: boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  value?: string;
}) {
  const [prompt, setPrompt] = useState(value);
  const hasSetInitialPrompt = useRef(false);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

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

  const sendPrompt = () => {
    if (isLoading) return;
    if (prompt.trim()) {
      handleSubmit(prompt);
    }
    setPrompt("");
  };

  const classNames = [
    "puck-ai-prompt-form",
    glow ? "puck-ai-prompt-form--glow" : "",
    isLoading ? "puck-ai-prompt-form--is-loading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div className="puck-ai-prompt-form-inner">
        <span className="puck-ai-prompt-form-glow" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt();
          }}
        >
          <div className="puck-ai-prompt-form-form-inner">
            <TextareaAutosize
              className="puck-ai-prompt-form-input"
              name="prompt"
              minRows={minRows}
              maxRows={maxRows}
              placeholder={placeholder}
              disabled={isLoading}
              value={prompt}
              ref={(node) => {
                if (inputRef) {
                  (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
                }
                internalRef.current = node;
              }}
              onChange={(e) => setPrompt(e.target.value)}
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
              />
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
}: {
  chat?: AiPluginProps["chat"];
  host?: string;
  prepareRequest?: AiPluginProps["prepareRequest"];
}) {
  const { examplePrompts } = chat ?? {};
  const puckDispatch = (usePuck as any)((s: any) => s.dispatch);
  const getPuck = useGetPuck();
  const localChatId = useRef("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pluginRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [toolStatus, setToolStatus] = useState<Record<string, ToolStatus>>({});

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

        const defaultBody = {
          ...opts.body,
          chatId: localChatId.current,
          trigger: opts.trigger,
          messages: opts.messages,
          pageData: appState.data,
          config: configWithRoot,
          // Read from ref to avoid stale closure — targetComponent state would
          // always be null here because useChat captures the initial render value.
          ...(targetComponentRef.current
            ? { selectedComponentId: targetComponentRef.current.id }
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
    if (!text) return;
    setError("");
    setPromptValue("");
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
      <div className="puck-ai-chat-header">AI page builder</div>
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
        >
          <Placeholder dispatch={puckDispatch} inputRef={inputRef} pluginRef={pluginRef} />
        </ChatBody>
      </ToolStatusProvider>
    </div>
  );
}

// ============================================================
// createAiPlugin
// ============================================================

export function createAiPlugin(opts: AiPluginProps = {}): Plugin {
  const { scrollTracking = true, host, chat, prepareRequest } = opts;

  return {
    label: "AI",
    name: "ai",
    icon: <Bot />,
    mobilePanelHeight: "min-content",
    render: (): ReactElement => (
      <Chat host={host} chat={chat} prepareRequest={prepareRequest} />
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
