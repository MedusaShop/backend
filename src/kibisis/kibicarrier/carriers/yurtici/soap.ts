export type XmlValue = string | XmlObject | XmlValue[]
export type XmlObject = { [key: string]: XmlValue }

const ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }

    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

function serialize(name: string, value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(name, item)).join("")
  }

  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => serialize(key, child))
      .join("")
    return `<${name}>${inner}</${name}>`
  }

  return `<${name}>${escapeXml(String(value))}</${name}>`
}

/** Builds a document/literal SOAP 1.1 request with unqualified children. */
export function envelope(namespace: string, operation: string, params: Record<string, unknown>): string {
  const body = Object.entries(params)
    .map(([key, value]) => serialize(key, value))
    .join("")

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="${escapeXml(namespace)}">` +
    `<soapenv:Header/><soapenv:Body><ns:${operation}>${body}</ns:${operation}></soapenv:Body>` +
    "</soapenv:Envelope>"
  )
}

type Frame = { name: string; children: XmlObject; text: string; nested: boolean }

const TOKEN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)(?:\s+[^>]*?)?(\/?)>|([^<]+)/gi

function localName(name: string): string {
  const index = name.indexOf(":")
  return index === -1 ? name : name.slice(index + 1)
}

function append(target: XmlObject, name: string, value: XmlValue): void {
  if (!(name in target)) {
    target[name] = value
    return
  }

  const current = target[name]
  target[name] = Array.isArray(current) ? [...current, value] : [current, value]
}

/**
 * Parses XML into plain objects keyed by local tag name. Attributes are
 * dropped, leaf elements become strings and repeated tags become arrays.
 */
export function parseXml(xml: string): XmlObject {
  const root: Frame = { name: "", children: {}, text: "", nested: true }
  const stack: Frame[] = [root]

  for (const match of xml.matchAll(TOKEN)) {
    const [, cdata, closing, opening, selfClosing, text] = match
    const frame = stack[stack.length - 1]

    if (cdata !== undefined) {
      frame.text += cdata
    } else if (opening) {
      const name = localName(opening)

      if (selfClosing) {
        frame.nested = true
        append(frame.children, name, "")
      } else {
        stack.push({ name, children: {}, text: "", nested: false })
      }
    } else if (closing) {
      if (stack.length < 2 || frame.name !== localName(closing)) {
        throw new Error(`XML kapanış etiketi beklenmiyor: ${closing}`)
      }

      stack.pop()
      const parent = stack[stack.length - 1]
      parent.nested = true
      append(parent.children, frame.name, frame.nested ? frame.children : decodeXml(frame.text).trim())
    } else if (text !== undefined) {
      frame.text += text
    }
  }

  if (stack.length !== 1) {
    throw new Error("XML belgesi tamamlanmamış.")
  }

  return root.children
}

export function asObject(value: unknown): XmlObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as XmlObject) : null
}

export function asList(value: unknown): XmlValue[] {
  if (value === undefined || value === null || value === "") {
    return []
  }

  return Array.isArray(value) ? value : [value as XmlValue]
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
