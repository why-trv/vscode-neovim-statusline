function parseStatus(originalText) {
  if (!originalText || !originalText.trim()) {
    return { mode: 'NORMAL', msg: '' };
  }
  if (originalText.startsWith(':')) {
    return { mode: 'COMMAND', msg: originalText.slice(1).trim() };
  }
  if (originalText.startsWith('-- ')) {
    const endMarker = ' --';
    const idx = originalText.indexOf(endMarker);
    if (idx !== -1) {
      const mode = originalText.slice(3, idx).trim();
      const afterMode = originalText.slice(idx + endMarker.length);
      const pipeIdx = afterMode.indexOf('|');
      const msg = (pipeIdx !== -1 ? afterMode.slice(pipeIdx + 1) : afterMode).trim();
      return { mode, msg };
    }
  }
  return { mode: 'NORMAL', msg: originalText };
}

function reformatStatusBar() {
  const nvimStatus = document.getElementById('asvetliakov.vscode-neovim.vscode-neovim-status');

  if (!nvimStatus) return;

  const label = nvimStatus.querySelector('.statusbar-item-label');

  if (!label) return;

  const { mode, msg } = parseStatus(label.textContent);
  const displayMsg = msg.replaceAll('|', '  ');

  nvimStatus.setAttribute('data-mode', mode.toLowerCase().replaceAll(' ', '-'));

  let modeSpan = label.querySelector('.nvim-mode');
  let msgSpan = label.querySelector('.nvim-msg');
  if (modeSpan && msgSpan
      && (modeSpan?.textContent ?? '') === mode
      && (msgSpan?.textContent ?? '') === displayMsg) return;

  label.textContent = '';
  // Remove 'display: none' from label's inline style
  label.style.removeProperty('display');

  if (!modeSpan) {
    modeSpan = document.createElement('span');
    modeSpan.className = 'nvim-mode';
    label.appendChild(modeSpan);
  }

  if (!msgSpan) {
    msgSpan = document.createElement('span');
    msgSpan.className = 'nvim-msg';
    label.appendChild(msgSpan);
  }

  modeSpan.textContent = mode;
  msgSpan.textContent = displayMsg;
}

// Start observing changes to the Neovim status item
function startObserving() {
  const nvimStatus = document.getElementById('asvetliakov.vscode-neovim.vscode-neovim-status');

  if (nvimStatus) {
    // Initial formatting
    reformatStatusBar();

    // Watch only for aria-label changes
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
