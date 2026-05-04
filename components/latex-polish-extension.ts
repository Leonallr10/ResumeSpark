import { RangeSetBuilder, StateField, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  showTooltip,
  WidgetType,
  type DecorationSet,
  type Tooltip,
} from "@codemirror/view";
import {
  FiTrendingUp,   // improve
  FiFileText,     // elaborate
  FiBriefcase,    // professional
  FiScissors,     // concise
  FiBarChart2     // quantify
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { PolishAction, PolishState } from "@/types/resume";

type CreatePolishExtensionInput = {
  polishState: PolishState;
  hasSuggestions: boolean;
  onTriggerPolish: (
    action: PolishAction,
    text: string,
    range: { from: number; to: number },
  ) => void;
  onAcceptPolish: (polished: string, range: { from: number; to: number }) => void;
  onRejectPolish: () => void;
};

const POLISH_ACTIONS: { action: PolishAction; label: string; icon: IconType }[] = [
  { action: "improve", label: "Improve writing", icon: FiTrendingUp },
  { action: "elaborate", label: "Elaborate details", icon: FiFileText },
  { action: "professional", label: "Professional tone", icon: FiBriefcase },
  { action: "concise", label: "Make concise", icon: FiScissors },
  { action: "quantify", label: "Quantify impact", icon: FiBarChart2 },
];

export function createPolishExtension({
  polishState,
  hasSuggestions,
  onTriggerPolish,
  onAcceptPolish,
  onRejectPolish,
}: CreatePolishExtensionInput): Extension {
  const tooltipField = StateField.define<Tooltip | null>({
    create(state) {
      if (polishState || hasSuggestions) return null;
      return computeTooltip(state.selection.main.from, state.selection.main.to, onTriggerPolish);
    },
    update(value, tr) {
      if (polishState || hasSuggestions) return null;
      if (!tr.selection && !tr.docChanged) return value;
      const { from, to } = tr.state.selection.main;
      return computeTooltip(from, to, onTriggerPolish);
    },
    provide: (field) => showTooltip.from(field),
  });

  const diffField = StateField.define<DecorationSet>({
    create() {
      return buildDiffDecorations(polishState, onAcceptPolish, onRejectPolish);
    },
    update(value, tr) {
      if (!tr.docChanged) return value;
      return buildDiffDecorations(polishState, onAcceptPolish, onRejectPolish);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [polishTheme, tooltipField, diffField];
}

function computeTooltip(
  from: number,
  to: number,
  onTriggerPolish: CreatePolishExtensionInput["onTriggerPolish"],
): Tooltip | null {
  if (from === to) return null;

  return {
    pos: from,
    end: to,
    above: true,
    strictSide: false,
    create(view) {
      const selectedText = view.state.sliceDoc(from, to);
      const { dom, destroy } = buildTooltipDom(selectedText, { from, to }, onTriggerPolish);
      return { dom, offset: { x: 0, y: 4 }, destroy };
    },
  };
}

function buildTooltipDom(
  selectedText: string,
  range: { from: number; to: number },
  onTriggerPolish: CreatePolishExtensionInput["onTriggerPolish"],
): { dom: HTMLElement; destroy: () => void } {
  const container = document.createElement("div");
  container.className = "cm-polishTooltip";

  const roots: Root[] = [];

  const header = document.createElement("div");
  header.className = "cm-polishTooltipHeader";
  header.textContent = "AI Polish Actions";
  container.appendChild(header);

  for (const { action, label, icon } of POLISH_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-polishTooltipButton";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    button.appendChild(labelSpan);

    const iconSpan = document.createElement("span");
    iconSpan.className = "cm-polishTooltipButtonIcon";
    button.appendChild(iconSpan);

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTriggerPolish(action, selectedText, range);
    });
    container.appendChild(button);

    const root = createRoot(iconSpan);
    root.render(createElement(icon));
    roots.push(root);
  }

  return {
    dom: container,
    destroy: () => {
      setTimeout(() => roots.forEach((r) => r.unmount()), 0);
    },
  };
}

function buildDiffDecorations(
  polishState: PolishState,
  onAcceptPolish: CreatePolishExtensionInput["onAcceptPolish"],
  onRejectPolish: CreatePolishExtensionInput["onRejectPolish"],
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  if (!polishState) return builder.finish();

  const { range } = polishState;

  builder.add(
    range.to,
    range.to,
    Decoration.widget({
      block: true,
      side: 1,
      widget: new PolishDiffWidget(polishState, onAcceptPolish, onRejectPolish),
    }),
  );

  return builder.finish();
}

class PolishDiffWidget extends WidgetType {
  constructor(
    private readonly state: NonNullable<PolishState>,
    private readonly onAccept: CreatePolishExtensionInput["onAcceptPolish"],
    private readonly onReject: CreatePolishExtensionInput["onRejectPolish"],
  ) {
    super();
  }

  eq(other: PolishDiffWidget) {
    return (
      this.state.original === other.state.original &&
      this.state.polished === other.state.polished &&
      this.state.loading === other.state.loading &&
      this.state.action === other.state.action
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "cm-polishDiffWidget";

    const header = document.createElement("div");
    header.className = "cm-polishDiffHeader";

    const badge = document.createElement("span");
    badge.className = "cm-polishDiffBadge";
    badge.textContent = this.state.action;
    header.appendChild(badge);

    const title = document.createElement("span");
    title.className = "cm-polishDiffTitle";
    title.textContent = "Polish suggestion";
    header.appendChild(title);

    root.appendChild(header);

    if (this.state.loading) {
      const loading = document.createElement("div");
      loading.className = "cm-polishDiffLoading";
      loading.textContent = "Polishing";

      const dots = document.createElement("span");
      dots.className = "cm-polishDiffDots";
      dots.textContent = "...";
      loading.appendChild(dots);

      if (this.state.polished) {
        const preview = document.createElement("pre");
        preview.className = "cm-polishDiffLine cm-polishDiffLineNew";
        preview.textContent = this.state.polished;
        root.appendChild(preview);
      }

      root.appendChild(loading);
      return root;
    }

    if (this.state.polished) {
      const diff = document.createElement("div");
      diff.className = "cm-polishDiffBody";

      const oldLine = document.createElement("pre");
      oldLine.className = "cm-polishDiffLine cm-polishDiffLineOld";
      oldLine.textContent = this.state.original;
      diff.appendChild(oldLine);

      const newLine = document.createElement("pre");
      newLine.className = "cm-polishDiffLine cm-polishDiffLineNew";
      newLine.textContent = this.state.polished;
      diff.appendChild(newLine);

      root.appendChild(diff);

      const actions = document.createElement("div");
      actions.className = "cm-polishDiffActions";

      const acceptButton = document.createElement("button");
      acceptButton.type = "button";
      acceptButton.className = "cm-polishDiffButton cm-polishDiffButtonPrimary";
      acceptButton.textContent = "Accept";
      acceptButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      acceptButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onAccept(this.state.polished!, this.state.range);
      });

      const rejectButton = document.createElement("button");
      rejectButton.type = "button";
      rejectButton.className = "cm-polishDiffButton";
      rejectButton.textContent = "Reject";
      rejectButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      rejectButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onReject();
      });

      actions.appendChild(acceptButton);
      actions.appendChild(rejectButton);
      root.appendChild(actions);
    }

    return root;
  }

  ignoreEvent() {
    return false;
  }
}

const polishTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-polishTooltip": {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    padding: "4px",
    borderRadius: "10px",
    background: "white",
    border: "1px solid rgb(226, 232, 240)",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    fontFamily: "var(--font-sans), Arial, sans-serif",
    zIndex: "100",
    minWidth: "180px",
  },
  ".cm-polishTooltipHeader": {
    padding: "6px 10px 4px 10px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.025em",
    color: "rgb(148, 163, 184)",
  },
  ".cm-polishTooltipButton": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "rgb(51, 65, 85)",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    textAlign: "left",
  },
  ".cm-polishTooltipButton:hover": {
    background: "rgb(241, 245, 249)",
    color: "rgb(15, 23, 42)",
  },
  ".cm-polishTooltipButtonIcon": {
    display: "flex",
    alignItems: "center",
    opacity: "0.4",
    transition: "opacity 150ms",
  },
  ".cm-polishTooltipButton:hover .cm-polishTooltipButtonIcon": {
    opacity: "1",
  },
  ".cm-polishDiffWidget": {
    margin: "4px 0 6px 0",
    padding: "0",
    borderRadius: "0",
    background: "transparent",
    color: "rgb(15, 23, 42)",
    fontFamily: "var(--font-sans), Arial, sans-serif",
    whiteSpace: "normal",
  },
  ".cm-polishDiffHeader": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    fontSize: "12px",
  },
  ".cm-polishDiffBadge": {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "4px",
    padding: "1px 7px",
    background: "rgb(124, 58, 237)",
    color: "white",
    fontWeight: "700",
    fontSize: "11px",
    textTransform: "capitalize",
  },
  ".cm-polishDiffTitle": {
    color: "rgb(71, 85, 105)",
    fontWeight: "600",
  },
  ".cm-polishDiffBody": {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  ".cm-polishDiffLine": {
    overflowX: "auto",
    boxSizing: "border-box",
    width: "100%",
    margin: "0",
    padding: "7px 9px",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "12px",
    lineHeight: "1.45",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-polishDiffLineOld": {
    border: "1px solid rgb(252, 165, 165)",
    background: "rgb(254, 226, 226)",
    color: "rgb(127, 29, 29)",
    textDecoration: "line-through",
  },
  ".cm-polishDiffLineNew": {
    border: "1px solid rgb(134, 239, 172)",
    background: "rgb(220, 252, 231)",
    color: "rgb(20, 83, 45)",
  },
  ".cm-polishDiffActions": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "5px",
  },
  ".cm-polishDiffButton": {
    height: "28px",
    borderRadius: "6px",
    border: "1px solid rgb(203, 213, 225)",
    padding: "0 10px",
    background: "white",
    color: "rgb(15, 23, 42)",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    pointerEvents: "auto",
  },
  ".cm-polishDiffButton:hover": {
    background: "rgb(241, 245, 249)",
    borderColor: "rgb(148, 163, 184)",
  },
  ".cm-polishDiffButtonPrimary": {
    borderColor: "rgb(124, 58, 237)",
    background: "rgb(124, 58, 237)",
    color: "white",
  },
  ".cm-polishDiffButtonPrimary:hover": {
    background: "rgb(109, 40, 217)",
  },
  ".cm-polishDiffLoading": {
    padding: "6px 9px",
    fontSize: "12px",
    fontStyle: "italic",
    color: "rgb(100, 116, 139)",
  },
  "@keyframes cm-polishDots": {
    "0%, 20%": { content: "''" },
    "40%": { content: "'.'" },
    "60%": { content: "'..'" },
    "80%, 100%": { content: "'...'" },
  },
  ".cm-polishDiffDots": {
    animation: "cm-polishDots 1.4s steps(1) infinite",
  },
});
