import * as vscode from 'vscode';

const CSS_FILENAME = 'statusline.css';
const JS_FILENAME = 'statusline.min.js';
const ASSETS_DIR = 'assets';

type StyleRecord = Record<string, string>;

// Per-mode map: key is %predefinedName or custom selector suffix (may contain %refs)
type ElementStyleMap = Record<string, StyleRecord>;

type ModeStyleMap = {
  default?: ElementStyleMap;
  normal?: ElementStyleMap;
  insert?: ElementStyleMap;
  visual?: ElementStyleMap;
  replace?: ElementStyleMap;
  command?: ElementStyleMap;
};

// Custom UI Style external.imports entry (string URL or object)
type ImportEntry = string | { type: string; url: string };

// Predefined aliases for common selectors. Use %name (e.g. %modeBadge) to refer to these.
const ELEMENT_SUFFIXES: Record<string, string> = {
  statusBar: '[id="workbench.parts.statusbar"]',
  statusBarItem: '[id="asvetliakov.vscode-neovim.vscode-neovim-status"]',
  modeBadge: '#nvim-mode-badge',
  message: '#nvim-msg-text',
  messagePart: '.nvim-msg-part',
  cursor: '.monaco-editor.focused .cursors-layer .cursor',
  currentLine: '.monaco-editor.focused .view-overlays .current-line',
  currentLineNumber: '.monaco-editor.focused .line-numbers.active-line-number',
  editor: '.monaco-editor',
  focusedEditor: '.monaco-editor.focused',
  workbench: '.monaco-workbench',
};

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('neovim-statusline');
}

const CONFIG_KEYS = ['styles', 'variables', 'autoInject', 'enabled'] as const;

function configHasNonGlobalValues(): boolean {
  const config = getConfig();
  for (const key of CONFIG_KEYS) {
    const info = config.inspect(key);
    if (
      info?.workspaceValue !== undefined ||
      info?.workspaceFolderValue !== undefined
    ) {
      return true;
    }
  }
  return false;
}

function isNonEmptyObject(obj: unknown): obj is Record<string, unknown> {
  return (
    !!obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.keys(obj).length > 0
  );
}

const SELECTOR_REF_PATTERN = /%(\w+)/g;

const VALID_REF_LIST = Object.keys(ELEMENT_SUFFIXES)
  .map((k) => `%${k}`)
  .join(', ');

// Expands %refs in a selector suffix (e.g. %cursor, %message span). Throws on unknown ref.
function expandSelectorRefs(suffix: string): string {
  return suffix.replace(SELECTOR_REF_PATTERN, (_, name) => {
    const built = ELEMENT_SUFFIXES[name];
    if (built === undefined) {
      throw new Error(
        `Unknown selector reference: %${name}. Valid: ${VALID_REF_LIST}`,
      );
    }
    return built;
  });
}

// Prepend body prefix to each selector in a comma-separated list.
function scopeSelector(modePrefix: string, suffix: string): string {
  const parts = suffix
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return `${modePrefix} ${suffix}`.trim();
  return parts.map((part) => `${modePrefix} ${part}`).join(', ');
}

function buildRuleset(selector: string, styles: StyleRecord): string {
  const props: string[] = [];
  for (const [prop, value] of Object.entries(styles)) {
    if (typeof value === 'string') {
      props.push(`${prop}: ${value}`);
    }
  }
  return `${selector}{${props.join(';')}}`;
}

function getJsImportUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(
    context.extensionUri,
    ASSETS_DIR,
    JS_FILENAME,
  ).with({ scheme: 'file' });
}

function getCssImportUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, CSS_FILENAME).with({
    scheme: 'file',
  });
}

type VariablesMap = Record<string, string>;

function buildRootVariables(vars: VariablesMap): string {
  const props: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value !== 'string') continue;
    props.push(`${key}: ${value}`);
  }
  return props.length > 0 ? `:root{${props.join(';')}}` : '';
}

function generateCss(
  styles: ModeStyleMap,
  variables: VariablesMap = {},
): string {
  const parts: string[] = [];

  const rootVars = buildRootVariables(variables);
  if (rootVars) parts.push(rootVars);

  if (!isNonEmptyObject(styles)) return parts.join('\n');

  const rulesets: string[] = [];

  for (const [mode, elementMap] of Object.entries(styles)) {
    const modePrefix =
      mode === 'default'
        ? 'body[data-nvim-mode]'
        : `body[data-nvim-mode^="${mode}"]`;

    for (const [key, style] of Object.entries(elementMap)) {
      if (!isNonEmptyObject(style)) continue;

      const suffix = expandSelectorRefs(key);
      const sel = scopeSelector(modePrefix, suffix);
      rulesets.push(buildRuleset(sel, style));
    }
  }

  parts.push(rulesets.join('\n'));
  return parts.join('\n');
}

async function writeCssToFile(css: string, uri: vscode.Uri) {
  let existingCssBuf: Uint8Array | null = null;
  try {
    existingCssBuf = await vscode.workspace.fs.readFile(uri);
  } catch {
    // No file
  }
  const newCssBuf = new TextEncoder().encode(css);
  const cssChanged =
    existingCssBuf === null || Buffer.compare(existingCssBuf, newCssBuf) !== 0;
  if (cssChanged) {
    await vscode.workspace.fs.writeFile(uri, newCssBuf);
  }
  return cssChanged;
}

function getStyleImportEntries(): ImportEntry[] {
  const config = vscode.workspace.getConfiguration('custom-ui-style');
  return config.get<ImportEntry[]>('external.imports', []);
}

async function setStyleImportEntries(entries: ImportEntry[]) {
  const config = vscode.workspace.getConfiguration('custom-ui-style');
  await config.update(
    'external.imports',
    entries,
    vscode.ConfigurationTarget.Global,
  );
}

async function updateStyleImportEntries(
  context: vscode.ExtensionContext,
  uris: vscode.Uri[],
) {
  const entries = getStyleImportEntries();
  const extId = context.extension.id;

  // Filter out our existing entries by checking if the path contains the extension id,
  // not the full path to storage directory. This is to avoid duplicate imports when settings
  // are imported from another VS Code fork, i.e. we don't want this to happen:
  // ~/.vscode/extensions/why-trv.neovim-statusline/...
  // ~/.vscode-oss/extensions/why-trv.neovim-statusline/...
  const imports = entries.filter((e) => {
    if (typeof e !== 'string') return true;
    return !e.includes(extId);
  });

  for (const uri of uris) {
    imports.push(uri.toString());
  }

  await setStyleImportEntries(imports);
}

function styleImportEntriesContainAnyOf(uris: vscode.Uri[]): boolean {
  const entries = getStyleImportEntries();
  const uriStrs = uris.map((uri) => uri.toString());

  for (const e of entries) {
    if (typeof e !== 'string') continue;
    if (uriStrs.includes(e)) return true;
  }

  return false;
}

// Old 0.1.x selector names → new %ref names
const V0_1_SELECTOR_MAP: Record<string, string> = {
  line: '%statusBarItem',
  mode: '%modeBadge',
  msg: '%message',
};

async function migrateV01Styles(): Promise<boolean> {
  const config = getConfig();
  const styles =
    (config.inspect<Record<string, unknown>>('styles')?.globalValue as
      | Record<string, unknown>
      | undefined) ?? {};
  const oldKeys = Object.keys(styles).filter((k) => k in V0_1_SELECTOR_MAP);
  if (oldKeys.length === 0) return false;

  // Preserve any existing new-format entries (keys that aren't old selector names)
  const migrated: Record<string, ElementStyleMap> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (!(key in V0_1_SELECTOR_MAP) && isNonEmptyObject(value)) {
      migrated[key] = value as ElementStyleMap;
    }
  }

  // Transpose old entries: { selector: { mode: cssProps } } → { mode: { %ref: cssProps } }
  for (const [oldSel, modeMap] of Object.entries(styles)) {
    const newRef = V0_1_SELECTOR_MAP[oldSel];
    if (!newRef || !isNonEmptyObject(modeMap)) continue;
    for (const [mode, cssProps] of Object.entries(modeMap)) {
      if (!isNonEmptyObject(cssProps)) continue;
      migrated[mode] ??= {};
      migrated[mode][newRef] = cssProps as StyleRecord;
    }
  }

  await config.update('styles', migrated, vscode.ConfigurationTarget.Global);
  await vscode.window.showInformationMessage(
    'Neovim Statusline: Settings have been migrated from v0.1.x format.',
  );
  return true;
}

async function run(context: vscode.ExtensionContext) {
  await migrateV01Styles();

  if (configHasNonGlobalValues()) {
    await vscode.window.showWarningMessage(
      'Neovim Statusline: Non-global settings detected, but not supported at this time. Styling will be shared across all workspaces.',
    );
  }

  const config = getConfig();
  const uris = [getCssImportUri(context), getJsImportUri(context)];

  if (!config.get<boolean>('enabled', true)) {
    const hadImports = styleImportEntriesContainAnyOf(uris);
    await updateStyleImportEntries(context, []); // Remove our imports
    try {
      await vscode.workspace.fs.delete(getCssImportUri(context));
    } catch (err) {
      if (err instanceof vscode.FileSystemError && err.code !== 'FileNotFound')
        throw err;
    }
    if (hadImports) {
      await vscode.commands.executeCommand('custom-ui-style.reload');
    }
    return;
  }

  try {
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  } catch (err) {
    if (err instanceof vscode.FileSystemError && err.code !== 'FileExists') {
      throw err;
    }
  }

  // Since Custom UI Style requires VS Code restart to apply changes (and doesn't watch
  // for file changes), take care to check if the CSS content has actually changed to
  let css: string;
  try {
    css = generateCss(
      config.get<ModeStyleMap>('styles', {}),
      config.get<VariablesMap>('variables', {}),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(`Neovim Statusline: ${msg}`);
    return;
  }
  const cssUri = getCssImportUri(context);
  const cssChanged = await writeCssToFile(css, cssUri);

  const jsUri = getJsImportUri(context);
  const urisToInject = [cssUri, jsUri];

  if (config.get<boolean>('autoInject', true)) {
    await updateStyleImportEntries(context, urisToInject);
  }

  if (cssChanged && styleImportEntriesContainAnyOf(urisToInject)) {
    // NOTE: Custom UI Style reload may also be triggered if auto-inject
    // has changed the imports list, but let's KISS - worst case we just
    // get a reload notification twice.
    await vscode.commands.executeCommand('custom-ui-style.reload');
  }
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('neovim-statusline.reload', async () => {
      await run(context);
      vscode.window.setStatusBarMessage('Neovim Statusline reloaded', 2000);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'neovim-statusline.copyCssPath',
      async () => {
        await vscode.env.clipboard.writeText(
          getCssImportUri(context).toString(),
        );
        vscode.window.setStatusBarMessage('CSS path copied to clipboard', 2000);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'neovim-statusline.copyJsPath',
      async () => {
        await vscode.env.clipboard.writeText(
          getJsImportUri(context).toString(),
        );
        vscode.window.setStatusBarMessage('JS path copied to clipboard', 2000);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'neovim-statusline.toggleStyling',
      async () => {
        const config = getConfig();
        const next = !config.get<boolean>('enabled', true);
        await config.update('enabled', next, vscode.ConfigurationTarget.Global);
        vscode.window.setStatusBarMessage(
          next
            ? 'Neovim Statusline styling enabled'
            : 'Neovim Statusline styling disabled',
          2000,
        );
      },
    ),
  );

  await run(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('neovim-statusline')) {
        await run(context);
      }
    }),
  );
}
