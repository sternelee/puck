import { act, fireEvent, render, screen } from "@testing-library/react";
import { ReactNode } from "react";
import { Config } from "../../../types";
import "@testing-library/jest-dom";
import { rootDroppableId } from "../../../lib/root-droppable-id";

jest.mock("../styles.module.css");
jest.mock("@dnd-kit/react");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false, // default → desktop
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(), // ⬅️ legacy APIs some libs still call
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

jest.mock("@dnd-kit/react", () => {
  const original = jest.requireActual("@dnd-kit/react");
  return {
    ...original,
    // Provider becomes a no-op wrapper
    DragDropProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),

    // Hooks return dummy objects so destructuring works
    useDroppable: () => ({
      ref: () => undefined,
      setNodeRef: () => undefined,
      isOver: false,
    }),
    useDraggable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => undefined,
      isDragging: false,
    }),
  };
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as any).ResizeObserver = ResizeObserver;
window.HTMLElement.prototype.scrollIntoView = jest.fn();

type PuckInternal = {
  appStore: AppStoreApi;
};

const getInternal = () => {
  return (window as any).__PUCK_INTERNAL_DO_NOT_USE as PuckInternal;
};

import { Puck } from "../index";
import { AppStoreApi } from "../../../store";

describe("Puck", () => {
  const componentARender = jest.fn(() => null);
  const componentBRender = jest.fn(() => null);
  const containerRender = jest.fn(() => null);
  const rootRender = jest.fn(() => null);

  const config: Config = {
    root: {
      render: ({ children }: { children?: ReactNode }) => {
        rootRender();
        return <div>Root{children}</div>;
      },
    },
    components: {
      componentA: {
        render: () => {
          componentARender();
          return <div>Component A</div>;
        },
      },
      componentB: {
        render: () => {
          componentBRender();
          return <div>Component B</div>;
        },
      },
      container: {
        fields: {
          content: { type: "slot" },
        },
        render: ({
          content,
        }: {
          content?: (props?: { className?: string }) => ReactNode;
        }) => {
          containerRender();
          return <div>Container{content?.()}</div>;
        },
      },
    },
  };

  afterEach(() => {
    rootRender.mockClear();
    componentARender.mockClear();
    componentBRender.mockClear();
    containerRender.mockClear();
    window.localStorage.clear();
  });

  // flush any queued state updates
  const flush = () => act(async () => {});

  it("root renders", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    expect(rootRender).toHaveBeenCalled();
    expect(screen.getByText("Root")).toBeInTheDocument();
  });

  it("should generate the correct state on mount", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    const { appStore } = getInternal();

    expect(appStore.getState()).toMatchSnapshot();
  });

  it("should index slots on mount", async () => {
    render(
      <Puck
        config={{
          root: {
            fields: {
              content: { type: "slot" },
            },
          },
          components: {},
        }}
        data={{
          root: {
            props: {
              content: [],
            },
          },
        }}
        iframe={{ enabled: false }}
      />
    );

    await flush();

    const { appStore } = getInternal();

    expect(appStore.getState().state.indexes).toMatchInlineSnapshot(`
      {
        "nodes": {
          "root": {
            "data": {
              "props": {
                "content": [],
                "id": "root",
              },
              "type": "root",
            },
            "flatData": {
              "props": {
                "content": null,
                "id": "root",
              },
              "type": "root",
            },
            "parentId": null,
            "path": [],
            "zone": "",
          },
        },
        "zones": {
          "root:content": {
            "contentIds": [],
            "type": "slot",
          },
          "root:default-zone": {
            "contentIds": [],
            "type": "root",
          },
        },
      }
    `);
  });

  it("filters blocks in the left sidebar", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    const searchInput = screen.getByLabelText("Search blocks");

    expect(screen.getByText("componentA")).toBeInTheDocument();
    expect(screen.getByText("componentB")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "componenta" } });

    expect(screen.getByText("componentA")).toBeInTheDocument();
    expect(screen.queryByText("componentB")).not.toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("shows a quick insert helper on an empty canvas", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    expect(screen.getByText("Start with your first block")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Click to insert a block here, or open the sidebar browser."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quick insert" })
    ).toBeInTheDocument();
  });

  it("inserts a block from the quick insert modal", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Quick insert" }));

    expect(screen.getByText("Insert your first block")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /componentA/i }));

    await flush();

    expect(screen.getByText("Component A")).toBeInTheDocument();
  });

  it("opens the global quick insert with the keyboard shortcut", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.keyDown(document, { code: "ControlLeft" });
    fireEvent.keyDown(document, { code: "KeyK" });

    await flush();

    expect(
      screen.getByRole("heading", { name: "Quick insert" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search blocks to insert")).toHaveFocus();
  });

  it("inserts a block from the global quick insert modal", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.keyDown(document, { code: "ControlLeft" });
    fireEvent.keyDown(document, { code: "KeyK" });

    await flush();

    fireEvent.click(screen.getByRole("button", { name: /componentB/i }));

    await flush();

    expect(
      screen.queryByRole("heading", { name: "Quick insert" })
    ).not.toBeInTheDocument();
    expect(componentBRender).toHaveBeenCalled();
  });

  it("reuses the drawer item override inside global quick insert", async () => {
    render(
      <Puck
        config={config}
        data={{}}
        iframe={{ enabled: false }}
        overrides={{
          drawerItem: ({
            children,
            name,
          }: {
            children?: ReactNode;
            name: string;
          }) => (
            <div data-testid={`drawer-item-override:${name}`}>{children}</div>
          ),
        }}
      />
    );

    await flush();

    expect(screen.getAllByTestId(/drawer-item-override:/)).toHaveLength(2);

    fireEvent.keyDown(document, { code: "ControlLeft" });
    fireEvent.keyDown(document, { code: "KeyK" });

    await flush();

    expect(screen.getAllByTestId(/drawer-item-override:/)).toHaveLength(4);
  });

  it("supports keyboard selection and enter insertion in global quick insert", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.keyDown(document, { code: "ControlLeft" });
    fireEvent.keyDown(document, { code: "KeyK" });

    await flush();

    const searchInput = screen.getByLabelText("Search blocks to insert");

    fireEvent.keyDown(searchInput, { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: /componentB/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.keyDown(searchInput, { key: "Enter" });

    await flush();

    expect(componentBRender).toHaveBeenCalled();
  });

  it("wraps keyboard selection when pressing arrow up in global quick insert", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.keyDown(document, { code: "ControlLeft" });
    fireEvent.keyDown(document, { code: "KeyK" });

    await flush();

    const searchInput = screen.getByLabelText("Search blocks to insert");

    fireEvent.keyDown(searchInput, { key: "ArrowUp" });

    expect(screen.getByRole("option", { name: /componentB/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("opens a contextual quick insert before the selected component", async () => {
    render(
      <Puck
        config={config}
        data={{
          content: [
            {
              type: "componentA",
              props: {
                id: "component-a-1",
              },
            },
          ],
        }}
        iframe={{ enabled: false }}
      />
    );

    await flush();

    fireEvent.click(screen.getByText("Component A"));

    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Insert before" }));

    expect(
      screen.getByRole("heading", { name: "Insert block before" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /componentB/i }));

    await flush();

    const { appStore } = getInternal();

    expect(appStore.getState().state.data.content?.[0]?.type).toBe(
      "componentB"
    );
    expect(appStore.getState().state.ui.itemSelector).toEqual({
      index: 0,
      zone: rootDroppableId,
    });
  });

  it("inserts a block into the selected component slot", async () => {
    render(
      <Puck
        config={config}
        data={{
          content: [
            {
              type: "container",
              props: {
                id: "container-1",
                content: [],
              },
            },
          ],
        }}
        iframe={{ enabled: false }}
      />
    );

    await flush();

    fireEvent.click(screen.getByText("Container"));

    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Insert into" }));

    expect(
      screen.getByRole("heading", { name: "Insert block into" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /componentA/i }));

    await flush();

    const { appStore } = getInternal();

    expect(
      appStore.getState().state.data.zones?.["container-1:content"]?.[0]?.type
    ).toBe("componentA");
    expect(appStore.getState().state.ui.itemSelector).toEqual({
      index: 0,
      zone: "container-1:content",
    });
  });

  it("opens a context menu with component commands on right click", async () => {
    render(
      <Puck
        config={config}
        data={{
          content: [
            {
              type: "componentA",
              props: {
                id: "component-a-1",
              },
            },
          ],
        }}
        iframe={{ enabled: false }}
      />
    );

    await flush();

    fireEvent.contextMenu(screen.getByText("Component A"));

    expect(screen.getByText("Insert before")).toBeInTheDocument();
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("renders injected component commands from the command registry", async () => {
    const customCommand = jest.fn();

    render(
      <Puck
        commands={{
          component: [
            () => [
              {
                id: "custom-command",
                label: "Custom command",
                surfaces: ["contextMenu"],
                execute: customCommand,
              },
            ],
          ],
        }}
        config={config}
        data={{
          content: [
            {
              type: "componentA",
              props: {
                id: "component-a-1",
              },
            },
          ],
        }}
        iframe={{ enabled: false }}
      />
    );

    await flush();

    fireEvent.contextMenu(screen.getByText("Component A"));
    fireEvent.click(screen.getByRole("button", { name: "Custom command" }));

    expect(customCommand).toHaveBeenCalled();
  });

  it("renders favorite component blocks ahead of the regular list", async () => {
    window.localStorage.setItem(
      "puck-favorites",
      JSON.stringify([
        {
          id: "favorite-component",
          kind: "component",
          name: "Favorite hero",
          createdAt: "2026-04-14T00:00:00.000Z",
          componentType: "componentA",
          data: {
            type: "componentA",
            props: {
              id: "favorite-instance",
            },
          },
        },
        {
          id: "favorite-page",
          kind: "page",
          name: "Favorite page",
          createdAt: "2026-04-14T00:00:00.000Z",
          data: {
            root: { props: { id: "root" } },
            content: [],
          },
        },
      ])
    );

    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Favorite hero")).toBeInTheDocument();
    expect(screen.queryByText("Favorite page")).not.toBeInTheDocument();
  });

  it("shows a built-in block preview when hovering a drawer item", async () => {
    render(<Puck config={config} data={{}} iframe={{ enabled: false }} />);

    await flush();

    fireEvent.mouseEnter(screen.getByTestId("drawer-item:componentA"));

    expect(screen.getByText("Component A")).toBeInTheDocument();
  });
});
