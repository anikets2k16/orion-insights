# Investigation: Client-side PDF Download Failures in Sandboxed Iframes

## 1. Diagnosis of Silent Failures

Client-side PDF generation (e.g., via **jsPDF**) and subsequent download triggers often fail silently in sandboxed environments (like embedded previews, IDE iframes, or CMS plugins) due to specific browser security restrictions.

### Root Causes
1.  **Missing `allow-downloads` attribute**: By default, the HTML5 `sandbox` attribute blocks all downloads. If the iframe is defined as `<iframe sandbox="allow-scripts ...">`, any attempt to trigger a download (via `a.click()`, `window.open()`, or `location.href`) will be blocked by the browser without necessarily throwing a JavaScript error.
2.  **Navigation to Data URLs**: Browsers (especially Chrome) block top-level navigation to `data:application/pdf;base64,...`. Older jsPDF methods like `output('dataurlnewwindow')` rely on this and will fail.
3.  **Blob URL Security**: While Blob URLs (`blob:https://...`) are generally safer than Data URLs, they are still subject to the iframe's sandbox restrictions. If `allow-downloads` is absent, the browser ignores the `download` attribute on anchor tags.
4.  **User Gesture Requirement**: Some browsers require a direct user gesture (click) to trigger a download. Synthetic clicks (e.g., `element.click()` called inside an async promise) can sometimes be flagged as "not user-initiated" in highly restricted contexts.

---

## 2. Most Reliable Workaround Patterns

### Pattern A: The "PostMessage" Bridge (Recommended for Embedded Previews)
If you cannot modify the `sandbox` attribute of the iframe directly, send the PDF data to the parent window and let the parent handle the download.

**Inside the Iframe:**
```javascript
const doc = new jsPDF();
doc.text("Hello World", 10, 10);
const blob = doc.output('blob');

// Convert blob to Base64 or ArrayBuffer to send via postMessage
const reader = new FileReader();
reader.onload = () => {
  window.parent.postMessage({
    type: 'DOWNLOAD_PDF',
    payload: reader.result,
    filename: 'report.pdf'
  }, '*');
};
reader.readAsDataURL(blob);
```

**In the Parent Window:**
```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'DOWNLOAD_PDF') {
    const link = document.createElement('a');
    link.href = event.data.payload;
    link.download = event.data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
});
```

---

### Pattern B: Server-Side Proxy with `Content-Disposition`
This is the "gold standard" for reliability. Instead of downloading locally, the client "uploads" the PDF (or its state) to a server route, which then streams it back with headers that force a download.

**Implementation:**
1.  POST the PDF data/JSON to `/api/download-pdf`.
2.  Server responds with:
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename="report.pdf"`
3.  The iframe can then use a standard form submission or `window.location.href = '/api/download-pdf?id=...'`.

---

### Pattern C: Opening in a New Tab (Requires `allow-popups`)
If the sandbox allows popups (`allow-popups allow-popups-to-escape-sandbox`), opening the Blob URL in a new tab can bypass some download restrictions.

```javascript
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
const newWindow = window.open(url, '_blank');
if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    // Popup was blocked
}
```

---

## 3. Summary of Sandbox Attributes
To allow downloads directly within an iframe, ensure the following attributes are present:
- `allow-downloads`: Explicitly allows downloading files.
- `allow-scripts`: Required for jsPDF to run.
- `allow-same-origin`: Often required for Blob URL creation and access.
- `allow-popups-to-escape-sandbox`: Helps if you need to open the PDF in a new tab to trigger the download.

## Conclusion
For maximum reliability in restricted "preview" environments, **avoid purely client-side `a.download` triggers**. Use a **postMessage bridge** to the parent or a **server-side download route** with the `Content-Disposition: attachment` header.

## 4. Special Case: Same-Origin Server Routes
When using a same-origin server route, the browser treats the download as a standard navigation/resource fetch rather than a scripted action. 

1. **Direct Link**: A simple `<a href="/api/generate-pdf" target="_blank">Download</a>` is the most resilient method because it delegates the entire process to the browser's native networking stack, which is less restricted by the iframe's script sandbox.
2. **Content-Disposition**: Ensure the server sends `Content-Disposition: attachment; filename="file.pdf"`. Without this, the browser might try to render the PDF inside the restricted iframe (which may also be blocked or provide a poor UX).
3. **Escaping the Iframe**: Using `target="_top"` or `target="_blank"` on these links helps "escape" the iframe context, ensuring the download UI (the browser's "save as" dialog or download bar) is triggered in the main browser window.
