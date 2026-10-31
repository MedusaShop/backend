import { YurticiAdapter } from "./adapter"
import { YurticiClient } from "./client"
import { CARRIER_API_VERSION, CarrierDefinition } from "./contract"

export const PRODUCT = "kibisis-yurtici"

const yurtici: CarrierDefinition = {
  apiVersion: CARRIER_API_VERSION,
  id: "yurtici",
  product: PRODUCT,
  label: "Yurtiçi Kargo",
  description: "Yurtiçi Kargo KOPS web servisi ile gönderi oluşturma, iptal ve takip.",
  credentials: [
    {
      key: "username",
      label: "Web servis kullanıcı adı",
      required: true,
      hint: "Test ortamında boş bırakılırsa Yurtiçi'nin YKTEST hesabı kullanılır.",
    },
    { key: "password", label: "Web servis şifresi", secret: true, required: true },
    { key: "customer_code", label: "Müşteri kodu" },
  ],
  trackingUrl: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={code}",
  createClient(config) {
    return new YurticiClient(config)
  },
  adapter: new YurticiAdapter(),
}

export default yurtici
