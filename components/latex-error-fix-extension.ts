import { RangeSetBuilder, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

export type ErrorFixState = {
  line: number;
  message: string;
  loading: boolean;
  fixedCode?: string;
  explanation?: string;
  error?: string;
} | null;

type CreateErrorFixExtensionInput = {
  activeFix: ErrorFixState;
  onApplyFix: (fixedCode: string) => void;
  onDismiss: () => void;
};

export function createErrorFixExtension({
  activeFix,
  onApplyFix,
  onDismiss,
}: CreateErrorFixExtensionInput): Extension {
  const decorationField = StateField.define<DecorationSet>({
    create(state) {
      return buildErrorFixDecorations(state.doc, activeFix, onApplyFix, onDismiss);
    },
    update(value, transaction) {
      if (!transaction.docChanged) return value;
      return buildErrorFixDecorations(transaction.state.doc, activeFix, onApplyFix, onDismiss);
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [errorFixTheme, decorationField];
}

function buildErrorFixDecorations(
  doc: Text,
  activeFix: ErrorFixState,
  onApplyFix: (fixedCode: string) => void,
  onDismiss: () => void,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  if (!activeFix || activeFix.line < 1 || activeFix.line > doc.lines) {
    return builder.finish();
  }

  const targetLine = doc.line(activeFix.line);

  builder.add(
    targetLine.from,
    targetLine.from,
    Decoration.line({ class: "cm-errorFixHighlightLine" }),
  );

  builder.add(
    targetLine.to,
    targetLine.to,
    Decoration.widget({
      block: true,
      side: 1,
      widget: new ErrorFixWidget({
        message: activeFix.message,
        loading: activeFix.loading,
        fixedCode: activeFix.fixedCode,
        explanation: activeFix.explanation,
        error: activeFix.error,
        originalCode: targetLine.text,
        onApplyFix,
        onDismiss,
      }),
    }),
  );

  return builder.finish();
}

type ErrorFixWidgetData = {
  message: string;
  loading: boolean;
  fixedCode?: string;
  explanation?: string;
  error?: string;
  originalCode: string;
  onApplyFix: (fixedCode: string) => void;
  onDismiss: () => void;
};

class ErrorFixWidget extends WidgetType {
  constructor(private readonly data: ErrorFixWidgetData) {
    super();
  }

  eq(other: ErrorFixWidget) {
    return (
      this.data.message === other.data.message &&
      this.data.loading === other.data.loading &&
      this.data.fixedCode === other.data.fixedCode &&
      this.data.explanation === other.data.explanation &&
      this.data.error === other.data.error
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "cm-errorFixWidget";

    // Header with error badge
    const header = document.createElement("div");
    header.className = "cm-errorFixHeader";

    const badge = document.createElement("span");
    badge.className = "cm-errorFixBadge";
    badge.textContent = "ERROR";
    header.appendChild(badge);

    const msg = document.createElement("span");
    msg.className = "cm-errorFixMessage";
    msg.textContent = this.data.message;
    header.appendChild(msg);

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "cm-errorFixDismissBtn";
    dismissBtn.textContent = "×";
    dismissBtn.title = "Dismiss";
    dismissBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.data.onDismiss();
    });
    header.appendChild(dismissBtn);

    root.appendChild(header);

    // Loading state
    if (this.data.loading) {
      const loading = document.createElement("div");
      loading.className = "cm-errorFixLoading";
      loading.textContent = "Generating fix";
      const dots = document.createElement("span");
      dots.className = "cm-errorFixDots";
      dots.textContent = "...";
      loading.appendChild(dots);
      root.appendChild(loading);
      return root;
    }

    // Error state (API failure)
    if (this.data.error) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "cm-errorFixError";
      errorDiv.textContent = this.data.error;
      root.appendChild(errorDiv);
      return root;
    }

    // Fix suggestion
    if (this.data.fixedCode) {
      // Explanation
      if (this.data.explanation) {
        const explanationDiv = document.createElement("div");
        explanationDiv.className = "cm-errorFixExplanation";
        explanationDiv.textContent = this.data.explanation;
        root.appendChild(explanationDiv);
      }

      // Diff
      const diff = document.createElement("div");
      diff.className = "cm-errorFixDiff";

      const oldLine = document.createElement("pre");
      oldLine.className = "cm-errorFixLine cm-errorFixLineOld";
      oldLine.textContent = this.data.originalCode;
      diff.appendChild(oldLine);

      const newLine = document.createElement("pre");
      newLine.className = "cm-errorFixLine cm-errorFixLineNew";
      newLine.textContent = this.data.fixedCode;
      diff.appendChild(newLine);

      root.appendChild(diff);

      // Actions
      const actions = document.createElement("div");
      actions.className = "cm-errorFixActions";

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "cm-errorFixButton cm-errorFixButtonPrimary";
      applyBtn.textContent = "Apply Fix";
      applyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.data.onApplyFix(this.data.fixedCode!);
      });
      actions.appendChild(applyBtn);

      const dismissAction = document.createElement("button");
      dismissAction.type = "button";
      dismissAction.className = "cm-errorFixButton";
      dismissAction.textContent = "Dismiss";
      dismissAction.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.data.onDismiss();
      });
      actions.appendChild(dismissAction);

      root.appendChild(actions);
    }

    return root;
  }

  ignoreEvent() {
    return false;
  }
}

const errorFixTheme = EditorView.baseTheme({
  ".cm-errorFixHighlightLine": {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderLeft: "3px solid rgb(239, 68, 68)",
  },
  ".cm-errorFixWidget": {
    margin: "4px 8px 8px 8px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgb(252, 165, 165)",
    background: "rgb(255, 251, 251)",
    fontFamily: "var(--font-sans), Arial, sans-serif",
    fontSize: "12px",
    whiteSpace: "normal",
    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.1)",
  },
  ".cm-errorFixHeader": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
  },
  ".cm-errorFixBadge": {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "4px",
    padding: "2px 6px",
    background: "rgb(239, 68, 68)",
    color: "white",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.5px",
    flexShrink: "0",
  },
  ".cm-errorFixMessage": {
    color: "rgb(127, 29, 29)",
    fontSize: "12px",
    fontWeight: "500",
    flex: "1",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ".cm-errorFixDismissBtn": {
    border: "none",
    background: "transparent",
    color: "rgb(156, 163, 175)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: "1",
    flexShrink: "0",
    "&:hover": {
      color: "rgb(75, 85, 99)",
    },
  },
  ".cm-errorFixLoading": {
    color: "rgb(107, 114, 128)",
    fontSize: "12px",
    padding: "4px 0",
  },
  ".cm-errorFixDots": {
    animation: "cm-errorFixPulse 1.5s infinite",
  },
  "@keyframes cm-errorFixPulse": {
    "0%, 100%": { opacity: "1" },
    "50%": { opacity: "0.3" },
  },
  ".cm-errorFixError": {
    color: "rgb(185, 28, 28)",
    fontSize: "12px",
    padding: "4px 0",
  },
  ".cm-errorFixExplanation": {
    color: "rgb(55, 65, 81)",
    fontSize: "12px",
    marginBottom: "8px",
    lineHeight: "1.4",
    padding: "6px 8px",
    background: "rgb(249, 250, 251)",
    borderRadius: "4px",
    borderLeft: "3px solid rgb(59, 130, 246)",
  },
  ".cm-errorFixDiff": {
    marginBottom: "8px",
  },
  ".cm-errorFixLine": {
    margin: "2px 0",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    lineHeight: "1.5",
  },
  ".cm-errorFixLineOld": {
    border: "1px solid rgb(252, 165, 165)",
    background: "rgb(254, 226, 226)",
    color: "rgb(127, 29, 29)",
    textDecoration: "line-through",
  },
  ".cm-errorFixLineNew": {
    border: "1px solid rgb(134, 239, 172)",
    background: "rgb(220, 252, 231)",
    color: "rgb(20, 83, 45)",
  },
  ".cm-errorFixActions": {
    display: "flex",
    gap: "8px",
  },
  ".cm-errorFixButton": {
    height: "28px",
    borderRadius: "6px",
    border: "1px solid rgb(203, 213, 225)",
    padding: "0 12px",
    background: "white",
    color: "rgb(15, 23, 42)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  ".cm-errorFixButtonPrimary": {
    borderColor: "rgb(34, 197, 94)",
    background: "rgb(34, 197, 94)",
    color: "white",
  },
});
