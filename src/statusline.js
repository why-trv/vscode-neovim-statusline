const MODE_DELIMITER_REGEX = / --(?=[^|\n])/;
const COMMAND_CHARS = [':', '/', '?'];

// Returns [ mode, ...messageParts ]. Splits by | and scans all parts:
// '-- MODE --' → extracted mode, single-char ':' '/' '?' → COMMAND, else NORMAL.
// State indicators like 'recording @a' are kept as message parts.
// TODO: It would be much simpler if vscode-neovim had an option to not strip empty
// statusline parts - maybe make a PR?
function parseStatus(text) {
  if (text === '') return ['NORMAL'];

  // '-- MODE --text' → '-- MODE --|text'
  text = text.replace(MODE_DELIMITER_REGEX, ' --|');
  const parts = text.split('|');

  let mode = 'NORMAL';
  const messageParts = [];

  for (const part of parts) {
    if (part.startsWith('-- ') && part.endsWith(' --')) {
      mode = part.slice(3, -3);
    } else if (COMMAND_CHARS.includes(part)) {
      mode = 'COMMAND';
      messageParts.push(part);
    } else {
      messageParts.push(part);
    }
  }

  return [mode, ...messageParts];
}

function reformatStatusBar() {
  const nvimStatus = document.getElementById('asvetliakov.vscode-neovim.vscode-neovim-status');

  if (!nvimStatus) return;

  const label = nvimStatus.querySelector('.statusbar-item-label');

  if (!label) return;

  const [mode, ...messageParts] = parseStatus(label.textContent);

  const modeKey = mode.toLowerCase().replaceAll(' ', '-');
  document.body.setAttribute('data-nvim-mode', modeKey);

  label.textContent = '';
  label.style.removeProperty('display');

  const modeSpan = document.createElement('span');
  modeSpan.id = 'nvim-mode-badge';
  modeSpan.textContent = mode;
  label.appendChild(modeSpan);

  if (messageParts.length > 0) {
    const msgSpan = document.createElement('span');
    msgSpan.id = 'nvim-msg-text';
    for (const part of messageParts) {
      const partSpan = document.createElement('span');
      partSpan.className = 'nvim-msg-part';
      partSpan.setAttribute('data-text', part);
      partSpan.textContent = part;
      msgSpan.appendChild(partSpan);
    }
    label.appendChild(msgSpan);
  }
}

// Start observing changes to the Neovim status item
function startObserving() {
  const nvimStatus = document.getElementById('asvetliakov.vscode-neovim.vscode-neovim-status');

  if (nvimStatus) {
    // Initial formatting
    reformatStatusBar();

    // Observe only aria-label changes. It has exactly the same value as text content,
    // and we easily avoid reentrant loops provided that we don't touch aria-label
    const observer = new MutationObserver(reformatStatusBar);
    observer.observe(nvimStatus, {
      attributes: true,
      attributeFilter: ['aria-label']
    });
  } else {
    // If element doesn't exist yet, try again shortly
    setTimeout(startObserving, 200);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}
