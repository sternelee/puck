export const PUCK_BLOCK_SEARCH_ID = "puck-block-search";
export const PUCK_FOCUS_BLOCKS_EVENT = "puck:focus-block-search";

export const focusBlocksSearch = () => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(PUCK_FOCUS_BLOCKS_EVENT));

  requestAnimationFrame(() => {
    const input = document.getElementById(
      PUCK_BLOCK_SEARCH_ID
    ) as HTMLInputElement | null;

    input?.focus();
    input?.select();
  });
};

export const getBlocksShortcutLabel = () => {
  if (typeof navigator === "undefined") {
    return "Cmd/Ctrl+K";
  }

  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "Cmd+K" : "Ctrl+K";
};
