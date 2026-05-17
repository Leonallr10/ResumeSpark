import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { StreamLanguage } from "@codemirror/language";

const latexLanguage = StreamLanguage.define(stex);

const state = EditorState.create({
  doc: "\\textbf{Hello}",
  extensions: [latexLanguage]
});

const tree = syntaxTree(state);
console.log("\\textbf:", tree.resolveInner(1, 1).name);
