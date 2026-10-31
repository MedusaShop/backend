import {
  CarrierAdapter,
  CarrierDocument,
  CarrierError,
  ShipmentRequest,
  ShipmentResult,
  TrackingEvent,
  TrackingResult,
  TrackingStatus,
} from "./contract"
import { asList, asObject, asText, XmlObject } from "./soap"

const REFERENCE_PATTERN = /^[A-Za-z0-9-]{1,20}$/

const STATUS: Record<string, TrackingStatus> = {
  NOP: "created",
  ISR: "in_transit",
  IND: "in_transit",
  DLV: "delivered",
  CNL: "cancelled",
  ISC: "cancelled",
  BI: "cancelled",
}

/**
 * YurticiAdapter maps shop-neutral shipments to KOPS documents. The cargo key
 * is the shop's own reference; Yurtiçi assigns the tracking number (docId)
 * once the parcel is accepted at a branch.
 */
export class YurticiAdapter implements CarrierAdapter {
  toShipment(request: ShipmentRequest): CarrierDocument {
    const reference = assertReference(request.reference)
    const receiver = request.receiver
    const phone = digits(receiver.phone)

    if (receiver.name.trim().length < 4) {
      throw new CarrierError("Alıcı adı en az 4 karakter olmalı.", "invalid_request")
    }

    if (receiver.address.trim().length < 10) {
      throw new CarrierError("Alıcı adresi en az 10 karakter olmalı.", "invalid_request")
    }

    if (phone.length < 10) {
      throw new CarrierError("Alıcı telefonu en az 10 haneli olmalı.", "invalid_request")
    }

    const order: Record<string, unknown> = {
      cargoKey: reference,
      invoiceKey: request.invoiceNumber?.trim() || reference,
      receiverCustName: receiver.name.trim(),
      receiverAddress: receiver.address.trim(),
      cityName: receiver.city.trim(),
      townName: receiver.district.trim(),
      receiverPhone1: phone,
      emailAddress: receiver.email?.trim() || undefined,
      cargoCount: Math.max(1, Math.trunc(request.parcels || 1)),
      kg: request.weightKg && request.weightKg > 0 ? request.weightKg.toFixed(2) : undefined,
      description: request.description?.trim() || undefined,
    }

    if (request.cashOnDelivery) {
      order.ttInvoiceAmount = request.cashOnDelivery.amount
      order.ttDocumentId = request.invoiceNumber?.trim() || reference
      order.ttCollectionType = "0"
      order.ttDocumentSaveType = "0"
    }

    return { ShippingOrderVO: order }
  }

  fromShipment(request: ShipmentRequest, response: CarrierDocument): ShipmentResult {
    assertSucceeded(response, "Gönderi oluşturulamadı")

    return { reference: request.reference, trackingNumber: null, trackingUrl: null }
  }

  toCancel(reference: string): CarrierDocument {
    return { cargoKeys: assertReference(reference) }
  }

  fromCancel(_reference: string, response: CarrierDocument): void {
    assertSucceeded(response, "Gönderi iptal edilemedi")
  }

  toQuery(reference: string): CarrierDocument {
    return {
      keys: assertReference(reference),
      keyType: 0,
      addHistoricalData: true,
      onlyTracking: false,
    }
  }

  fromQuery(reference: string, response: CarrierDocument): TrackingResult {
    const detail = assertSucceeded(response, "Gönderi sorgulanamadı")
    const item = asObject(detail?.shippingDeliveryItemDetailVO)
    const code = asText(detail?.operationStatus).toUpperCase()

    return {
      reference,
      status: STATUS[code] ?? "unknown",
      trackingNumber: asText(item?.docId) || null,
      trackingUrl: asText(item?.trackingUrl) || null,
      events: eventsOf(item),
    }
  }
}

function assertReference(reference: string): string {
  const value = reference.trim()

  if (!REFERENCE_PATTERN.test(value)) {
    throw new CarrierError(
      "Yurtiçi kargo anahtarı en fazla 20 karakter olmalı; harf, rakam ve tire içerebilir.",
      "invalid_reference"
    )
  }

  return value
}

/** Checks the result's outFlag and the first *DetailVO row, returning that row. */
function assertSucceeded(response: CarrierDocument, action: string): XmlObject | null {
  const outFlag = asText(response.outFlag)
  const detailKey = Object.keys(response).find((key) => key.endsWith("DetailVO"))
  const [detail] = detailKey ? asList(response[detailKey]) : []
  const row = asObject(detail)
  const errCode = asText(row?.errCode)

  if (outFlag && outFlag !== "0") {
    throw new CarrierError(
      `${action}: ${asText(row?.errMessage) || asText(response.outResult) || `hata kodu ${outFlag}`}`,
      "carrier_rejected"
    )
  }

  if (errCode && errCode !== "0") {
    throw new CarrierError(`${action}: ${asText(row?.errMessage) || `hata kodu ${errCode}`}`, "carrier_rejected")
  }

  return row
}

function eventsOf(item: XmlObject | null): TrackingEvent[] {
  const events: TrackingEvent[] = []

  for (const entry of asList(item?.invDocCargoVOArray)) {
    const row = asObject(entry)
    const description = asText(row?.eventName) || asText(row?.reasonName)

    if (!row || !description) {
      continue
    }

    const location = [asText(row.unitName), asText(row.townName), asText(row.cityName)]
      .filter(Boolean)
      .join(", ")

    events.push({ at: timestamp(asText(row.eventDate), asText(row.eventTime)), description, location: location || null })
  }

  return events
}

function timestamp(date: string, time: string): string | null {
  if (!/^\d{8}$/.test(date)) {
    return null
  }

  const clock = /^\d{6}$/.test(time) ? `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}` : "00:00:00"

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${clock}+03:00`
}

function digits(value: string): string {
  const only = value.replace(/\D/g, "")
  return only.startsWith("90") && only.length === 12 ? only.slice(2) : only.replace(/^0/, "")
}
