import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const CSS_FILENAME = 'statusline.css';
const JS_FILENAME = 'statusline.js';
const ASSETS_DIR = 'assets';

// Arbitrary CSS properties (kebab-case, e.g. "background-color")
type CssStyle = Record<string, string>;

// Per-mode keys: default (all modes), normal, command, insert, visual, replace
type ModeStyleMap = Record<string, CssStyle>;

interface StylesConfig {
  line?: ModeStyleMap;
  mode?: ModeStyleMap;
  msg?: ModeStyleMap;
}

interface Config {
  styles: StylesConfig;
}

// Custom UI Style external.imports entry (string URL or object)
type ImportEntry = string | { type: string; url: string };

const SEL = '[id="asvetliakov.vscode-neovim.vscode-neovim-status"]';

function getConfig(): Config {
  const c = vscode.workspace.getConfiguration('neovim-statusline');
  const styles = c.get<StylesConfig>('styles') ?? {};
  return { styles };
}

function propsToCss(style: CssStyle): string {
  return Object.entries(style)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

function emitStyleGroup(
  lines: string[],
  root: string,
  suffix: string,
  modeMap: ModeStyleMap | undefined
): void {
  if (!modeMap || Object.keys(modeMap).length === 0) return;
  const sel = root + suffix;

  const def = modeMap.default;
  if (def && Object.keys(def).length > 0) {
    const css = propsToCss(def);
    if (css) lines.push(`${sel} { ${css} }`);
  }
  for (const [modeName, style] of Object.entries(modeMap)) {
    if (modeName === 'default' || !style || Object.keys(style).length === 0) continue;
    const css = propsToCss(style);
    if (!css) continue;
    lines.push(`${root}[data-mode^="${modeName}"]${suffix} { ${css} }`);
  }
}

function generateCss(config: Config): string {
  const lines: string[] = [];
  const { line, mode, msg } = config.styles ?? {};

  emitStyleGroup(lines, SEL, '', line);
  emitStyleGroup(lines, SEL, ' .nvim-mode', mode);
  emitStyleGroup(lines, SEL, ' .nvim-msg', msg);

  return lines.join('\n');
}

function isOurImport(storagePath: string, entry: ImportEntry): boolean {
  if (typeof entry !== 'string') return false;
  try {
    const p = vscode.Uri.parse(entry).fsPath;
    return p.startsWith(storagePath) && (p.endsWith(CSS_FILENAME) || p.endsWith(JS_FILENAME));
  } catch {
    return false;
  }
}

function injectIntoCustomUiStyle(context: vscode.ExtensionContext): Thenable<void> {
  const storagePath = context.globalStorageUri.fsPath;
  const cssPath = path.join(storagePath, CSS_FILENAME);
  const jsPath = path.join(storagePath, JS_FILENAME);
  const cssFileUri = vscode.Uri.file(cssPath).toString();
  const jsFileUri = vscode.Uri.file(jsPath).toString();

  const customUi = vscode.workspace.getConfiguration('custom-ui-style');
  let imports: unknown = customUi.get('external.imports') ?? [];
  if (!Array.isArray(imports)) imports = [];

  const filtered = (imports as ImportEntry[]).filter((entry) => !isOurImport(storagePath, entry));
  const newImports = [...filtered, cssFileUri, jsFileUri];

  return customUi.update('external.imports', newImports, vscode.ConfigurationTarget.Global);
}

function run(context: vscode.ExtensionContext): Thenable<void> {
  const storagePath = context.globalStorageUri.fsPath;
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  const config = getConfig();
  const css = generateCss(config);
  const cssPath = path.join(storagePath, CSS_FILENAME);
  fs.writeFileSync(cssPath, css, 'utf8');

  const jsPath = path.join(storagePath, JS_FILENAME);
  const srcJs = path.join(context.extensionPath, ASSETS_DIR, JS_FILENAME);
  if (fs.existsSync(srcJs)) {
    fs.copyFileSync(srcJs, jsPath);
  }

  const autoInject = vscode.workspace.getConfiguration('neovim-statusline').get<boolean>('autoInject', true);
  if (autoInject) {
    return injectIntoCustomUiStyle(context);
  }
  return Promise.resolve();
}

function getStorageFileUris(context: vscode.ExtensionContext): { css: string; js: string } {
  const storagePath = context.globalStorageUri.fsPath;
  return {
    css: vscode.Uri.file(path.join(storagePath, CSS_FILENAME)).toString(),
    js: vscode.Uri.file(path.join(storagePath, JS_FILENAME)).toString(),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const reloadCmd = vscode.commands.registerCommand('neovim-statusline.reload', () => {
    run(context)
      .then(() => vscode.commands.executeCommand('custom-ui-style.reload'))
      .then(() => {
        vscode.window.setStatusBarMessage('Neovim Statusline reloaded', 2000);
      });
  });
  context.subscriptions.push(reloadCmd);

  const copyCssCmd = vscode.commands.registerCommand('neovim-statusline.copyCssPath', async () => {
    await run(context);
    const uris = getStorageFileUris(context);
    await vscode.env.clipboard.writeText(uris.css);
    vscode.window.setStatusBarMessage('CSS path copied to clipboard', 2000);
  });
  context.subscriptions.push(copyCssCmd);

  const copyJsCmd = vscode.commands.registerCommand('neovim-statusline.copyJsPath', async () => {
    await run(context);
    const uris = getStorageFileUris(context);
    await vscode.env.clipboard.writeText(uris.js);
    vscode.window.setStatusBarMessage('JS path copied to clipboard', 2000);
  });
  context.subscriptions.push(copyJsCmd);

  run(context).then(() => {
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('neovim-statusline')) {
        run(context);
      }
    });
    context.subscriptions.push(disposable);
  });
}
