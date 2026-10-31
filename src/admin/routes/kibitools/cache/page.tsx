"use client"

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, CheckCircle, ExclamationCircle, Sparkles } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"
import { Link } from "react-router-dom"

export const config = defineRouteConfig({
  label: "API Önbellek Temizle",
  icon: ArrowPath,
})

type ClearResult = {
  backend_cache: boolean
  storefront_cache: boolean
  storefront_message: string
  cleared_at: string
}

export default function CacheScreen() {
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<ClearResult | null>(null)

  const handleClearCache = async () => {
    setLoading(true)
    try {
      const res = await fetch("/admin/kibitools/cache", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setLastResult(data.results)
      toast.success("Önbellek Temizlendi", {
        description: "Backend ve Storefront API önbellekleri başarıyla sıfırlandı.",
      })
    } catch (err: any) {
      toast.error("İşlem Başarısız", {
        description: `Önbellek temizlenirken hata oluştu: ${err.message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="p-0 divide-y">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <div className="flex items-center gap-x-2">
            <Link to="/kibitools" className="text-ui-fg-muted hover:text-ui-fg-base text-small-regular">
              Kibitools
            </Link>
            <span className="text-ui-fg-muted">/</span>
            <Heading level="h1">API Önbellek Yönetimi</Heading>
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Backend API, Redis ve Next.js Storefront ISR önbelleklerini tek tıklamayla temizleyin.
          </Text>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-ui-border-base p-4 bg-ui-bg-subtle">
            <div className="flex items-center justify-between">
              <Text weight="plus">Medusa Backend Önbelleği</Text>
              <Badge color="green">Aktif</Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle mt-2">
              In-Memory ve Redis üzerinde saklanan sorgu yanıtları, fiyat ve hesaplama önbellekleri.
            </Text>
          </div>

          <div className="rounded-lg border border-ui-border-base p-4 bg-ui-bg-subtle">
            <div className="flex items-center justify-between">
              <Text weight="plus">Next.js Storefront Önbelleği</Text>
              <Badge color="blue">ISR Tags</Badge>
            </div>
            <Text size="small" className="text-ui-fg-subtle mt-2">
              Katalog, ürün detayları, kategori ve koleksiyon sayfalarının statik revalidation önbellekleri.
            </Text>
          </div>
        </div>

        <div className="rounded-lg border border-ui-border-base p-6 bg-ui-bg-base space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Heading level="h2" className="text-base font-semibold">
                Tüm API Önbelleklerini Sıfırla
              </Heading>
              <Text size="small" className="text-ui-fg-subtle mt-1">
                Bu işlem veritabanı verilerini silmez; yalnızca geçici bellek kopyalarını temizler ve güncel verilerin anında vitrinde görünmesini sağlar.
              </Text>
            </div>
            <Button
              variant="primary"
              size="base"
              onClick={handleClearCache}
              isLoading={loading}
              className="gap-x-2"
            >
              <ArrowPath className={loading ? "animate-spin" : ""} />
              Önbelleği Temizle
            </Button>
          </div>

          {lastResult && (
            <div className="mt-4 pt-4 border-t border-ui-border-base space-y-2">
              <Text weight="plus" size="small" className="text-ui-fg-base flex items-center gap-x-1.5">
                <Sparkles className="text-ui-fg-interactive" />
                Son İşlem Raporu:
              </Text>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-x-2 p-2 rounded bg-ui-bg-subtle border border-ui-border-base">
                  {lastResult.backend_cache ? (
                    <CheckCircle className="text-ui-fg-interactive" />
                  ) : (
                    <ExclamationCircle className="text-ui-fg-error" />
                  )}
                  <span>Backend Önbelleği: {lastResult.backend_cache ? "Temizlendi" : "Atlandı"}</span>
                </div>
                <div className="flex items-center gap-x-2 p-2 rounded bg-ui-bg-subtle border border-ui-border-base">
                  {lastResult.storefront_cache ? (
                    <CheckCircle className="text-ui-fg-interactive" />
                  ) : (
                    <ExclamationCircle className="text-ui-fg-warning" />
                  )}
                  <span>Storefront Önbelleği: {lastResult.storefront_cache ? "Temizlendi" : lastResult.storefront_message}</span>
                </div>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                Temizleme zamanı: {new Date(lastResult.cleared_at).toLocaleString("tr-TR")}
              </Text>
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}

