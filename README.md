# Resume Tailor

Next.js app for editing a resume as LaTeX (`.tex`), previewing the parsed resume, getting Gemini-powered JD-specific suggestions, accepting or declining suggestions inline, and downloading either the `.tex` source or a PDF export.

## Setup

Create `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

Install and run:

```bash
pnpm install
pnpm dev
```

## LaTeX PDF compilation

PDF export compiles the `.tex` source through a real LaTeX engine on the server.
Install one of these and make it available on `PATH`:

- MiKTeX or TeX Live with `pdflatex` or `xelatex`
- Tectonic with `tectonic`

The app tries `pdflatex`, then `xelatex`, then `tectonic`.

### Windows apply method

1. Install one compiler:
   - MiKTeX: install from <https://miktex.org/download>, then enable package installation on demand.
   - Tectonic: install from <https://tectonic-typesetting.github.io/> and add it to `PATH`.
2. Open a new PowerShell window and verify one command works:

```powershell
pdflatex --version
# or
xelatex --version
# or
tectonic --version
```

3. Restart the Next.js dev server so it receives the updated `PATH`:

```powershell
pnpm dev
```

4. In the app, use **Parsed view** only for editable resume review. Use **Compile PDF** or **Download PDF** for the real compiled `.tex` output.

If PDF export says no compiler was found even after installation, close the old terminal completely, open a new PowerShell window, and run `pnpm dev` again.
