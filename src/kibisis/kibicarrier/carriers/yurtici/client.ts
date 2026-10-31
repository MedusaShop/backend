import { CarrierClient, CarrierConfig, CarrierDocument, CarrierError } from "./contract"
import { asObject, asText, envelope, parseXml, XmlObject } from "./soap"

export const YURTICI_NAMESPACE = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices"

export const YURTICI_ENDPOINTS = {
  test: "https://testws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices",
  live: "https://ws.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices",
}

/** Public KOPS test account published in Yurtiçi's integration guide. */
export const YURTICI_TEST_ACCOUNT = { username: "YKTEST", password: "YK" }

const TIMEOUT_MS = 20_000

type Fetch = typeof fetch

/**
 * YurticiClient talks to the KOPS ShippingOrderDispatcherServices SOAP API.
 * It adds the web service account and returns the operation's result element.
 */
export class YurticiClient implements CarrierClient {
  private readonly endpoint: string
  private readonly username: string
  private readonly password: string

  constructor(
    config: CarrierConfig,
    private readonly fetchImpl: Fetch = fetch
  ) {
    const username = config.credentials.username?.trim() ?? ""
    const password = config.credentials.password ?? ""

    this.endpoint = config.testMode ? YURTICI_ENDPOINTS.test : YURTICI_ENDPOINTS.live

    if (config.testMode && !username) {
      this.username = YURTICI_TEST_ACCOUNT.username
      this.password = YURTICI_TEST_ACCOUNT.password
    } else if (!username || !password) {
      throw new CarrierError("Yurtiçi Kargo web servis kullanıcı adı ve şifresi gerekli.", "credentials_missing")
    } else {
      this.username = username
      this.password = password
    }
  }

  createShipment(payload: CarrierDocument): Promise<CarrierDocument> {
    return this.call("createShipment", { userLanguage: "TR" }, payload)
  }

  cancelShipment(payload: CarrierDocument): Promise<CarrierDocument> {
    return this.call("cancelShipment", { userLanguage: "TR" }, payload)
  }

  queryShipment(payload: CarrierDocument): Promise<CarrierDocument> {
    return this.call("queryShipment", { wsLanguage: "TR" }, payload)
  }

  private async call(
    operation: string,
    language: Record<string, string>,
    payload: CarrierDocument
  ): Promise<CarrierDocument> {
    const body = envelope(YURTICI_NAMESPACE, operation, {
      wsUserName: this.username,
      wsPassword: this.password,
      ...language,
      ...payload,
    })

    let response: Response
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "text/xml; charset=utf-8",
          soapaction: '""',
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CarrierError(`Yurtiçi Kargo servisine ulaşılamadı: ${reason}`, "network_error")
    }

    const text = await response.text()
    let document: XmlObject
    try {
      document = parseXml(text)
    } catch {
      throw new CarrierError(`Yurtiçi Kargo yanıtı okunamadı (HTTP ${response.status}).`, "invalid_response")
    }

    const soapBody = asObject(asObject(document.Envelope)?.Body)
    const fault = asObject(soapBody?.Fault)

    if (fault) {
      throw new CarrierError(
        `Yurtiçi Kargo hatası: ${asText(fault.faultstring) || "bilinmeyen SOAP hatası"}`,
        "soap_fault"
      )
    }

    const result = asObject(soapBody?.[`${operation}Response`])
    const [first] = Object.values(result ?? {})
    const inner = asObject(first)

    if (!response.ok || !inner) {
      throw new CarrierError(`Yurtiçi Kargo beklenmeyen yanıt döndü (HTTP ${response.status}).`, "invalid_response")
    }

    return inner
  }
}
