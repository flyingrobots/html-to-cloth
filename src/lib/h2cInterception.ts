// html2canvas iframe/document.write interception utilities
// Safely replaces Document.write/writeln for the clone iframe used by html2canvas
// and patches HTMLIFrameElement.contentWindow to pre‑patch the iframe's document.

const HTML2CANVAS_IFRAME_CLASS = 'html2canvas-container'

type PatchedRecord = {
  loadDispatched: boolean
  originalWrite?: (this: Document, ...args: string[]) => void
  originalWriteln?: (this: Document, ...args: string[]) => void
}
const patchedDocuments = new WeakMap<Document, PatchedRecord>()

let documentWritePatched = false
let originalDocumentWrite: typeof Document.prototype.write | null = null
let originalDocumentWriteln: typeof Document.prototype.writeln | null = null

let iframeContentWindowPatched = false
let originalIframeContentWindowDescriptor: PropertyDescriptor | null = null

declare global {
  interface Document { __html2canvasPatched?: boolean }
}

const scheduleMicrotask = (fn: () => void) => {
  if (typeof queueMicrotask === 'function') return queueMicrotask(fn)
  Promise.resolve().then(fn).catch(() => { void 0 })
}

const shouldInterceptDocumentWrite = (target: unknown): target is Document => {
  if (!target || typeof target !== 'object') return false
  const defaultView: Window | null | undefined = (target as Document).defaultView
  if (!defaultView) return false
  const frameElement: Element | null | undefined = (defaultView as Window).frameElement
  if (!frameElement || frameElement.tagName !== 'IFRAME') return false
  return (frameElement as Element).classList?.contains(HTML2CANVAS_IFRAME_CLASS) ?? false
}

const replaceDocumentContents = (targetDocument: Document, htmlText: string, record: PatchedRecord) => {
  if (typeof DOMParser === 'undefined') return false
  try {
    const markup = htmlText && htmlText.length > 0 ? htmlText : '<html></html>'
    const parser = new DOMParser()
    const parsed = parser.parseFromString(markup, 'text/html')
    // Clear
    while (targetDocument.firstChild) targetDocument.removeChild(targetDocument.firstChild)
    // Doctype
    if (parsed.doctype && targetDocument.implementation?.createDocumentType) {
      const dt = targetDocument.implementation.createDocumentType(
        parsed.doctype.name,
        parsed.doctype.publicId,
        parsed.doctype.systemId,
      )
      targetDocument.appendChild(dt)
    }
    const imported = targetDocument.importNode
      ? targetDocument.importNode(parsed.documentElement, true)
      : parsed.documentElement.cloneNode(true)
    targetDocument.appendChild(imported)
    if (!record.loadDispatched) {
      record.loadDispatched = true
      scheduleMicrotask(() => {
        const view = targetDocument.defaultView
        try { view?.dispatchEvent(new Event('load')) } catch { /* no-op */ }
        const frame = view?.frameElement ?? null
        try { frame?.dispatchEvent(new Event('load')) } catch { /* no-op */ }
      })
    }
    return true
  } catch {
    return false
  }
}

const getRecord = (doc: Document) => {
  let rec = patchedDocuments.get(doc)
  if (!rec) {
    rec = { loadDispatched: false }
    patchedDocuments.set(doc, rec)
  }
  return rec
}

const handleDocumentWrite = (
  targetDocument: Document,
  originalFn: ((this: Document, ...args: string[]) => void) | null,
  args: string[],
  appendNewline: boolean,
) => {
  if (!shouldInterceptDocumentWrite(targetDocument)) {
    return originalFn?.apply(targetDocument, args)
  }
  const htmlText = args.map((v) => (v == null ? '' : String(v))).join('') + (appendNewline ? '\n' : '')
  const record = getRecord(targetDocument)
  if (!replaceDocumentContents(targetDocument, htmlText, record)) {
    return originalFn?.apply(targetDocument, args)
  }
  return undefined
}

const patchDocumentInstance = (doc: Document & { __html2canvasPatched?: boolean }) => {
  if (!doc || doc.__html2canvasPatched) return
  const record = getRecord(doc)
  const originalWrite = typeof doc.write === 'function' ? doc.write.bind(doc) : null
  const originalWriteln = typeof doc.writeln === 'function' ? doc.writeln.bind(doc) : null
  ;(doc as unknown as { write: (...args: string[]) => void }).write = (...args: string[]) => handleDocumentWrite(doc, originalWrite, args, false)
  ;(doc as unknown as { writeln: (...args: string[]) => void }).writeln = (...args: string[]) => handleDocumentWrite(doc, originalWriteln, args, true)
  doc.__html2canvasPatched = true
  record.originalWrite = originalWrite ?? undefined
  record.originalWriteln = originalWriteln ?? undefined
}

export const ensureHtml2CanvasInterception = () => {
  // Patch global Document prototype once
  if (!documentWritePatched && typeof Document !== 'undefined') {
    originalDocumentWrite = Document.prototype.write
    originalDocumentWriteln = Document.prototype.writeln
    Document.prototype.write = function (...args: string[]) {
      return handleDocumentWrite(this, originalDocumentWrite, args, false)
    }
    Document.prototype.writeln = function (...args: string[]) {
      return handleDocumentWrite(this, originalDocumentWriteln, args, true)
    }
    documentWritePatched = true
  }
  // Patch the current document instance so writes here are also safe
  try { patchDocumentInstance(document) } catch { /* no-op */ }
  // Patch iframe contentWindow getter so html2canvas clone documents are pre‑patched
  if (!iframeContentWindowPatched && typeof HTMLIFrameElement !== 'undefined') {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
    if (descriptor?.get) {
      originalIframeContentWindowDescriptor = descriptor
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: function () {
          const win = descriptor.get!.call(this as unknown as HTMLIFrameElement) as Window | null
          try { if (win?.document) patchDocumentInstance(win.document as Document & { __html2canvasPatched?: boolean }) } catch { /* no-op */ }
          return win
        },
      })
      iframeContentWindowPatched = true
    }
  }
}

export const restoreHtml2CanvasInterception = () => {
  if (documentWritePatched && originalDocumentWrite && originalDocumentWriteln) {
    try {
      Document.prototype.write = originalDocumentWrite
      Document.prototype.writeln = originalDocumentWriteln
    } catch { /* no-op */ }
    documentWritePatched = false
  }
  if (iframeContentWindowPatched && originalIframeContentWindowDescriptor) {
    try {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', originalIframeContentWindowDescriptor)
    } catch { /* no-op */ }
    iframeContentWindowPatched = false
    originalIframeContentWindowDescriptor = null
  }
}
