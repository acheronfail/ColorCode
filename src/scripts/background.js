import ext from "./utils/ext";
import storage from "./utils/storage";

// Not CodeMirror, just enough to scan the modes.
import CodeMirror from '../codemirror-modes.js';

// Open/focus options page when icon is clicked.
ext.browserAction.onClicked.addListener(async function () {
  const url = ext.extension.getURL('options.html');
  ext.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0) {
      ext.tabs.update(tabs[0].id, { active: true });
      ext.windows.update(tabs[0].windowId, { focused: true })
    } else {
      ext.tabs.create({ url });
    }
  });
});

// Listen to all page loads and query their headers.
ext.webRequest.onCompleted.addListener(onCompleted, {
  urls: ['<all_urls>'],
  types: ['main_frame']
}, ['responseHeaders']);

// Run extension after the page has loaded.
async function onCompleted(details) {
  const modeInfo = sniffMode(details);
  if (!modeInfo) return;

  const mode = modeInfo.mode;
  const theme = await storage.get('theme');

  // CSS
  ext.tabs.insertCSS(details.tabId, { file: '/codemirror/lib/codemirror.css' });
  ext.tabs.insertCSS(details.tabId, { file: '/codemirror/addon/dialog/dialog.css' });
  if (theme != 'default') {
    ext.tabs.insertCSS(details.tabId, { file: `/codemirror/theme/${theme}.css` });
  }
  ext.tabs.insertCSS(details.tabId, { file: '/styles/injected.css' });

  // HACK: Until chrome + firefox read CSS URLs the same way, we just have to
  // manually add the font here.
  const fontFamily = await storage.get('fontFamily');
  ext.tabs.insertCSS(details.tabId, {
    code: `
      @font-face {
        font-family: ${fontFamily};
        font-style: normal;
        font-weight: normal;
        src: url('${ext.extension.getURL(`/fonts/${fontFamily}.ttf`)}');
      }`
  });

  // JS
  await ext.tabs.executeScript(details.tabId, { file: '/codemirror/lib/codemirror.js' });
  await ext.tabs.executeScript(details.tabId, { file: '/codemirror/addon/dialog/dialog.js' });
  await ext.tabs.executeScript(details.tabId, { file: '/codemirror/addon/search/searchcursor.js' });
  await ext.tabs.executeScript(details.tabId, { file: '/codemirror/addon/search/search.js' });
  if (mode == 'rust') {
    await ext.tabs.executeScript(details.tabId, { file: `/codemirror/addon/mode/simple.js` });
  } else if (mode != 'null') {
    await ext.tabs.executeScript(details.tabId, { file: `/codemirror/mode/${mode}/${mode}.js` });
  }

  // Instantiate CodeMirror inside the page with the content from the first <pre>.
  // TODO: is it always just in a pre tag?
  const code = `
    var pre = document.getElementsByTagName('pre')[0];
    pre.parentNode.removeChild(pre);

    var cm = new CodeMirror(document.body, {
      value: pre.textContent,
      lineNumbers: ${await storage.get('lineNumbers')},
      readOnly: ${await storage.get('readOnly')},
      theme: '${theme}',
      mode: '${mode}'
    });
    cm.getWrapperElement().style.fontSize = "${await storage.get('fontSize')}";
    cm.getWrapperElement().style.fontFamily = "${fontFamily}";
    cm.setSize('100%', '100%');
    cm.refresh();

    CodeMirror.commands.find = CodeMirror.commands.findPersistent;
    CodeMirror.commands.findNext = CodeMirror.commands.findPersistentNext;
    CodeMirror.commands.findPrevious = CodeMirror.commands.findPersistentPrevious;
  `;
  await ext.tabs.executeScript(details.tabId, { code });
}

// Helpers ---------------------------------------------------------------------

// Figure out what mode we should run from the headers.
function sniffMode(details) {
  let mode;

  // Check if there's an override first.
  const lang = getLangFromUrl(details.url);
  if (lang && (mode = CodeMirror.findModeByName(lang))) return mode;

  // Next we check the content type (ignoring standard browser types).
  const type = getContentTypeFromHeaders(details.responseHeaders);
  if (type && type.indexOf('plain') == -1) {
    if (isBrowserContent(type)) return null;
    if ((mode = CodeMirror.findModeByMIME(type))) return mode;
  }

  // Lastly we try to get it by the filename.
  const filename = getFilenameFromUrl(details.url);
  if (filename && (mode = CodeMirror.findModeByFileName(filename))) return mode;

  return null;
}

// Ignores standard browser content types.
function isBrowserContent(contentType) {
  const types = ['htm', 'html', 'xml', 'xhtml', 'shtml'];
  for (let i = 0, len = types.length; i < len; ++i) {
    if (contentType.indexOf(types[i]) > -1) return true;
  }
  return false;
}

function getHeaderByName(headers, name) {
  for (let i = 0, len = headers.length; i < len; ++i) {
    if (headers[i].name.toLowerCase() == name.toLowerCase()) {
      return headers[i].value;
    }
  }
  return null;
}

function getContentTypeFromHeaders(headers) {
  const contentType = getHeaderByName(headers, 'content-type');
  if (contentType) return contentType.split(';').shift();
  return null;
}

// Simply the last part of the URL's path.
function getFilenameFromUrl(url) {
  return url.split('/').pop().split('?').shift().toLowerCase();
}

// The user may append "#lang=(<LANGUAGE>)" in order force a certain language.
// Also support "#ft=(<LANGUAGE>)" since the Sight Chrome extension does as well:
// https://github.com/tsenart/sight/blob/9d8a47fa660e2a783e340f64d584f56d8bff08b9/js/background.js#L125
function getLangFromUrl(url) {
  const match = /#(?:lang|ft)=(\w+)/.exec(url);
  return match && match[1];
}

