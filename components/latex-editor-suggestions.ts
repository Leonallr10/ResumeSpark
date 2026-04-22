import { RangeSetBuilder, StateField, type Extension, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import { previewSuggestionLatexLine } from "@/lib/latex-resume";
import type { AiSuggestion, ResumeSection } from "@/types/resume";

type CreateLatexSuggestionExtensionInput = {
  sections: ResumeSection[];
  suggestionsByLine: Record<string, AiSuggestion[]>;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
};

export function createLatexSuggestionExtension({
  sections,
  suggestionsByLine,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: CreateLatexSuggestionExtensionInput): Extension {
  const suggestionField = StateField.define<DecorationSet>({
    create(state) {
      return buildLatexSuggestionDecorations(state.doc, {
        sections,
        suggestionsByLine,
        onAcceptSuggestion,
        onDeclineSuggestion,
      });
    },
    update(value, transaction) {
      if (!transaction.docChanged) {
        return value;
      }

      return buildLatexSuggestionDecorations(transaction.state.doc, {
        sections,
        suggestionsByLine,
        onAcceptSuggestion,
        onDeclineSuggestion,
      });
    },
    provide: (field) => EditorView.decorations.from(field),
  });

  return [latexSuggestionTheme, suggestionField];
}

function buildLatexSuggestionDecorations(
  doc: Text,
  {
    sections,
    suggestionsByLine,
    onAcceptSuggestion,
    onDeclineSuggestion,
  }: CreateLatexSuggestionExtensionInput,
) {
  const builder = new RangeSetBuilder<Decoration>();

  sections.forEach((section) => {
    section.lines.forEach((line) => {
      const lineSuggestions = suggestionsByLine[line.id] ?? [];

      if (lineSuggestions.length === 0 || typeof line.sourceLine !== "number") {
        return;
      }

      const sourceLineNumber = line.sourceLine + 1;

      if (sourceLineNumber > doc.lines) {
        return;
      }

      const sourceLine = doc.line(sourceLineNumber);

      lineSuggestions.forEach((suggestion, index) => {
        const sourceText = line.sourceText ?? line.text;

        builder.add(
          sourceLine.to,
          sourceLine.to,
          Decoration.widget({
            block: true,
            side: index + 1,
            widget: new LatexInlineSuggestionWidget({
              sectionTitle: section.title,
              sourceLineNumber,
              sourceText,
              suggestedSourceText: previewSuggestionLatexLine(
                sourceText,
                suggestion.suggestedText,
                suggestion.action,
                section.title,
              ),
              suggestion,
              onAcceptSuggestion: () => onAcceptSuggestion(suggestion),
              onDeclineSuggestion: () => onDeclineSuggestion(suggestion.id),
            }),
          }),
        );
      });
    });
  });

  return builder.finish();
}

const latexSuggestionTheme = EditorView.baseTheme({
  ".cm-latexSuggestionWidget": {
    margin: "4px 0 6px 0",
    padding: "0",
    borderRadius: "0",
    background: "transparent",
    color: "rgb(15, 23, 42)",
    fontFamily: "var(--font-sans), Arial, sans-serif",
    whiteSpace: "normal",
  },
  ".cm-latexSuggestionHeader": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
    fontSize: "12px",
  },
  ".cm-latexSuggestionBadge": {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "4px",
    padding: "1px 7px",
    background: "rgb(13, 148, 136)",
    color: "white",
    fontWeight: "700",
  },
  ".cm-latexSuggestionMeta": {
    color: "rgb(71, 85, 105)",
    fontWeight: "600",
  },
  ".cm-latexSuggestionDiff": {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  ".cm-latexSuggestionLine": {
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
  ".cm-latexSuggestionLineOld": {
    border: "1px solid rgb(252, 165, 165)",
    background: "rgb(254, 226, 226)",
    color: "rgb(127, 29, 29)",
  },
  ".cm-latexSuggestionLineNew": {
    border: "1px solid rgb(134, 239, 172)",
    background: "rgb(220, 252, 231)",
    color: "rgb(20, 83, 45)",
  },
  ".cm-latexSuggestionActions": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "5px",
  },
  ".cm-latexSuggestionButton": {
    height: "28px",
    borderRadius: "6px",
    border: "1px solid rgb(203, 213, 225)",
    padding: "0 10px",
    background: "white",
    color: "rgb(15, 23, 42)",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  ".cm-latexSuggestionButtonPrimary": {
    borderColor: "rgb(13, 148, 136)",
    background: "rgb(13, 148, 136)",
    color: "white",
  },
});

type LatexInlineSuggestionWidgetData = {
  sectionTitle: string;
  sourceLineNumber: number;
  sourceText: string;
  suggestedSourceText: string;
  suggestion: AiSuggestion;
  onAcceptSuggestion: () => void;
  onDeclineSuggestion: () => void;
};

class LatexInlineSuggestionWidget extends WidgetType {
  constructor(private readonly data: LatexInlineSuggestionWidgetData) {
    super();
  }

  eq(other: LatexInlineSuggestionWidget) {
    return (
      other.data.suggestion.id === this.data.suggestion.id &&
      other.data.sourceText === this.data.sourceText &&
      other.data.suggestedSourceText === this.data.suggestedSourceText &&
      other.data.suggestion.suggestedText === this.data.suggestion.suggestedText
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "cm-latexSuggestionWidget";

    const header = document.createElement("div");
    header.className = "cm-latexSuggestionHeader";

    const action = document.createElement("span");
    action.className = "cm-latexSuggestionBadge";
    action.textContent = this.data.suggestion.action.replace("_", " ");
    header.append(action);

    const section = document.createElement("span");
    section.className = "cm-latexSuggestionMeta";
    section.textContent = this.data.sectionTitle;
    header.append(section);

    const line = document.createElement("span");
    line.className = "cm-latexSuggestionMeta";
    line.textContent = `line ${this.data.sourceLineNumber}`;
    header.append(line);
    root.append(header);

    const diff = document.createElement("div");
    diff.className = "cm-latexSuggestionDiff";

    if (this.data.suggestion.action === "replace" || this.data.suggestion.action === "delete") {
      diff.append(createSuggestionLine(this.data.sourceText, "old"));
    }

    if (this.data.suggestion.action !== "delete") {
      diff.append(
        createSuggestionLine(
          this.data.suggestedSourceText || this.data.suggestion.suggestedText,
          "new",
        ),
      );
    }

    root.append(diff);

    const actions = document.createElement("div");
    actions.className = "cm-latexSuggestionActions";
    actions.append(
      createSuggestionButton("Accept", true, this.data.onAcceptSuggestion),
      createSuggestionButton("Decline", false, this.data.onDeclineSuggestion),
    );

    root.append(actions);
    return root;
  }

  ignoreEvent() {
    return false;
  }
}

function createSuggestionLine(value: string, tone: "old" | "new") {
  const line = document.createElement("pre");
  line.className =
    tone === "old"
      ? "cm-latexSuggestionLine cm-latexSuggestionLineOld"
      : "cm-latexSuggestionLine cm-latexSuggestionLineNew";
  line.textContent = value;
  return line;
}

function createSuggestionButton(
  label: string,
  primary: boolean,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary
    ? "cm-latexSuggestionButton cm-latexSuggestionButtonPrimary"
    : "cm-latexSuggestionButton";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  return button;
}
