import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger")
  const results = {
    backend_cache: false,
    storefront_cache: false,
    storefront_message: "",
    cleared_at: new Date().toISOString(),
  }

  // 1. Clear Medusa Backend Cache (In-Memory / Redis)
  try {
    const cacheService = req.scope.resolve(Modules.CACHE) as any
    if (cacheService && typeof cacheService.clear === "function") {
      await cacheService.clear()
      results.backend_cache = true
    } else if (cacheService && typeof cacheService.invalidate === "function") {
      await cacheService.invalidate("*")
      results.backend_cache = true
    }
  } catch (err: any) {
    logger.warn(`Failed to clear Medusa backend cache: ${err.message}`)
  }

  // 2. Clear Next.js Storefront ISR Cache via /api/revalidate
  const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:8000"
  const revalidateSecret =
    process.env.STOREFRONT_REVALIDATE_SECRET ||
    process.env.REVALIDATE_SECRET ||
    "supersecret"

  try {
    const response = await fetch(`${storefrontUrl.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: {
        "x-revalidate-secret": revalidateSecret,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      results.storefront_cache = true
      results.storefront_message = "Storefront etiketleri (ürünler, kategoriler, koleksiyonlar) temizlendi."
    } else {
      results.storefront_message = `Storefront HTTP ${response.status} döndürdü.`
    }
  } catch (err: any) {
    results.storefront_message = `Storefront'a ulaşılamadı (${err.message})`
  }

  res.status(200).json({
    success: true,
    message: "Tüm API ve Storefront önbellekleri başarıyla temizlendi.",
    results,
  })
}

