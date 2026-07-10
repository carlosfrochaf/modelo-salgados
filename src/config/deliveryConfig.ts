export interface DeliveryTier {
  maxDistanceKm: number;
  fee: number;
}

// Tabela comercial de frete por faixas de distância
export const DELIVERY_TIERS: DeliveryTier[] = [
  { maxDistanceKm: 4.0, fee: 10.00 },
  { maxDistanceKm: 5.0, fee: 15.00 },
  { maxDistanceKm: 8.0, fee: 20.00 },
  { maxDistanceKm: 10.0, fee: 25.00 },
  { maxDistanceKm: 15.0, fee: 30.00 },
  { maxDistanceKm: 18.0, fee: 35.00 },
];

// Limite de distância para entrega direta pelo site (km)
export const MAX_DELIVERY_DISTANCE_KM = 18.0;

// Taxa padrão cobrada em caso de falha da API ou digitação 100% manual sem sugestão
export const DEFAULT_FALLBACK_FEE = 10.00;

// Número de WhatsApp da lanchonete para finalização de pedidos distantes (>18km)
// Deve conter o DDI (55 para Brasil), DDD e o número completo sem traços ou parênteses
export const STORE_WHATSAPP_NUMBER = "553136438173";
