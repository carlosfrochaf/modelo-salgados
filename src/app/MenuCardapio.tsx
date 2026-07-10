'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  CheckCircle2, 
  Utensils,
  MessageCircle
} from 'lucide-react';
import { Category, Product } from '@prisma/client';
import styles from './MenuCardapio.module.css';
import { 
  DELIVERY_TIERS, 
  MAX_DELIVERY_DISTANCE_KM, 
  DEFAULT_FALLBACK_FEE, 
  STORE_WHATSAPP_NUMBER 
} from '@/config/deliveryConfig';

interface MenuCardapioProps {
  initialCategories: Category[];
  initialProducts: Product[];
  storeLatitude?: number;
  storeLongitude?: number;
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedFlavors: string[];
}

const TRADITIONAL_FLAVORS = [
  'Coxinha de Frango',
  'Risole de Milho com Catupiry',
  'Risole de Carne',
  'Bolinha de Mussarela',
  'Bolinha Napolitana',
  'Kibe',
  'Enrolado de Salsicha',
  'Empadinha de Frango'
];

function getMaxFlavorsForProduct(name: string): number {
  const lowercaseName = name.toLowerCase();
  
  if (lowercaseName.includes('cento')) return 4;
  if (lowercaseName.includes('25 salgados')) return 1;
  if (lowercaseName.includes('50 salgados')) return 2;
  if (lowercaseName.includes('75 salgados')) return 3;
  if (lowercaseName.includes('congelados')) return 1;
  
  if (lowercaseName.includes('kit casal')) return 2;
  if (lowercaseName.includes('kit família') || lowercaseName.includes('kit familia')) return 4;
  if (lowercaseName.includes('kit super família') || lowercaseName.includes('kit super familia')) return 8;
  
  if (lowercaseName.includes('mini')) return 2;
  if (lowercaseName.includes('médio') || lowercaseName.includes('medio')) return 5;
  if (lowercaseName.includes('grande')) return 10;
  
  return 0; // Not a flavor product
}

function isFlavorProduct(name: string): boolean {
  return getMaxFlavorsForProduct(name) > 0;
}

export default function MenuCardapio({ 
  initialCategories, 
  initialProducts,
  storeLatitude = -19.9320,
  storeLongitude = -44.0530
}: MenuCardapioProps) {
  // Client-side state
  const [categories] = useState<Category[]>(initialCategories);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  
  // Checkout Form State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  
  // Mapbox & Taxa de Entrega States
  const [deliveryFee, setDeliveryFee] = useState<number>(DEFAULT_FALLBACK_FEE);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [needsWhatsAppCheckout, setNeedsWhatsAppCheckout] = useState<boolean>(false);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState<boolean>(false);
  const [isAddressValidated, setIsAddressValidated] = useState<boolean>(false);

  // Structured Address States
  const [addressStreet, setAddressStreet] = useState<string>('');
  const [addressNumber, setAddressNumber] = useState<string>('');
  const [addressComplement, setAddressComplement] = useState<string>('');
  const [addressNeighborhood, setAddressNeighborhood] = useState<string>('');
  const [addressCity, setAddressCity] = useState<string>('');
  const [addressState, setAddressState] = useState<string>('MG');
  const [addressCep, setAddressCep] = useState<string>('');
  
  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [successWhatsAppUrl, setSuccessWhatsAppUrl] = useState<string>('');
  const [observations, setObservations] = useState<string>('');

  // Flavor Selection Modal State
  const [isFlavorModalOpen, setIsFlavorModalOpen] = useState<boolean>(false);
  const [flavorProduct, setFlavorProduct] = useState<Product | null>(null);
  const [checkedFlavors, setCheckedFlavors] = useState<string[]>([]);
  const [flavorLimit, setFlavorLimit] = useState<number>(0);

  // My Orders Modal State
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState<boolean>(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState<boolean>(false);

  const openMyOrdersModal = async () => {
    setIsMyOrdersOpen(true);
    const savedOrders = localStorage.getItem('lanchonete_orders');
    if (!savedOrders) {
      setMyOrders([]);
      return;
    }
    
    try {
      const ids = JSON.parse(savedOrders);
      if (ids.length === 0) {
        setMyOrders([]);
        return;
      }
      
      setIsLoadingMyOrders(true);
      const response = await fetch('/api/orders/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json();
      if (response.ok) {
        setMyOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Erro ao buscar pedidos do cliente:', err);
    } finally {
      setIsLoadingMyOrders(false);
    }
  };

  // Handle Hydration Mismatch by ensuring client-only code runs after mount
  useEffect(() => {
    setMounted(true);
    const savedCart = localStorage.getItem('lanchonete_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        const migrated = parsed.map((item: any) => {
          if (!item.id) {
            const flavors = item.selectedFlavors || [];
            return {
              id: `${item.product.id}-${[...flavors].sort().join(',')}`,
              product: item.product,
              quantity: item.quantity,
              selectedFlavors: flavors
            };
          }
          return item;
        });
        setCart(migrated);
      } catch (e) {
        console.error('Erro ao ler carrinho do localStorage', e);
      }
    }

    // Load customer data for hybrid route auto-fill
    const savedName = localStorage.getItem('lanchonete_customer_name');
    if (savedName) setCustomerName(savedName);

    const savedPhone = localStorage.getItem('lanchonete_customer_phone');
    if (savedPhone) setCustomerPhone(savedPhone);

    const savedType = localStorage.getItem('lanchonete_delivery_type');
    if (savedType === 'delivery' || savedType === 'pickup') {
      setDeliveryType(savedType as any);
    }

    const savedStreet = localStorage.getItem('lanchonete_address_street');
    const savedNumber = localStorage.getItem('lanchonete_address_number');
    const savedComplement = localStorage.getItem('lanchonete_address_complement');
    const savedNeighborhood = localStorage.getItem('lanchonete_address_neighborhood');
    const savedCity = localStorage.getItem('lanchonete_address_city');
    const savedState = localStorage.getItem('lanchonete_address_state');
    const savedCep = localStorage.getItem('lanchonete_address_cep');
    const savedFee = localStorage.getItem('lanchonete_delivery_fee');
    const savedDistance = localStorage.getItem('lanchonete_calculated_distance');
    const savedValidated = localStorage.getItem('lanchonete_is_address_validated');
    const savedAddress = localStorage.getItem('lanchonete_delivery_address');

    if (savedStreet) setAddressStreet(savedStreet);
    if (savedNumber) setAddressNumber(savedNumber);
    if (savedComplement) setAddressComplement(savedComplement);
    if (savedNeighborhood) setAddressNeighborhood(savedNeighborhood);
    if (savedCity) setAddressCity(savedCity);
    if (savedState) setAddressState(savedState || 'MG');
    if (savedCep) setAddressCep(savedCep);
    if (savedAddress) setDeliveryAddress(savedAddress);
    
    if (savedFee) setDeliveryFee(parseFloat(savedFee));
    if (savedDistance) setCalculatedDistance(parseFloat(savedDistance));
    if (savedValidated === 'true') setIsAddressValidated(true);
  }, []);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  const hasValidToken = !!(mapboxToken && !mapboxToken.includes('placeholder'));

  // Calcula a taxa baseando-se nas faixas de frete
  const calculateFeeFromDistance = (distanceKm: number): { fee: number; needsWhatsApp: boolean } => {
    for (const tier of DELIVERY_TIERS) {
      if (distanceKm <= tier.maxDistanceKm) {
        return { fee: tier.fee, needsWhatsApp: false };
      }
    }
    return { fee: 0, needsWhatsApp: true };
  };

  // Trata a alteração de deliveryType garantindo reset correto de estados
  const handleDeliveryTypeChange = (type: 'delivery' | 'pickup') => {
    setDeliveryType(type);
    if (type === 'pickup') {
      setNeedsWhatsAppCheckout(false);
    } else {
      if (calculatedDistance !== null) {
        const result = calculateFeeFromDistance(calculatedDistance);
        setDeliveryFee(result.fee);
        setNeedsWhatsAppCheckout(result.needsWhatsApp);
      } else {
        setDeliveryFee(DEFAULT_FALLBACK_FEE);
        setNeedsWhatsAppCheckout(false);
      }
    }
  };

  // Debounce para busca de endereços no Mapbox Geocoding
  useEffect(() => {
    if (!deliveryAddress.trim() || deliveryType !== 'delivery' || !hasValidToken) {
      setAddressSuggestions([]);
      return;
    }

    if (isSelectingSuggestion) {
      setIsSelectingSuggestion(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const query = encodeURIComponent(deliveryAddress);
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&proximity=${storeLongitude},${storeLatitude}&country=br&autocomplete=true&types=address,poi,neighborhood,postcode&language=pt`;
        const res = await fetch(endpoint);
        const data = await res.json();
        
        if (data.features) {
          setAddressSuggestions(data.features);
          setShowSuggestions(true);
        } else {
          setAddressSuggestions([]);
        }
      } catch (err) {
        console.warn('Erro ao buscar sugestões no Mapbox Geocoding:', err);
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [deliveryAddress, deliveryType, storeLatitude, storeLongitude, hasValidToken]);

  // Handler para quando seleciona uma sugestão
  const handleSelectSuggestion = async (suggestion: any) => {
    setIsSelectingSuggestion(true);
    setShowSuggestions(false);
    setAddressSuggestions([]);

    const context = suggestion.context || [];
    const street = suggestion.text || '';
    const postcodeFeature = context.find((c: any) => c.id.startsWith('postcode'));
    const neighborhoodFeature = context.find((c: any) => c.id.startsWith('neighborhood') || c.id.startsWith('locality'));
    const placeFeature = context.find((c: any) => c.id.startsWith('place'));
    const regionFeature = context.find((c: any) => c.id.startsWith('region'));

    const cep = postcodeFeature ? postcodeFeature.text : '';
    const bairro = neighborhoodFeature ? neighborhoodFeature.text : '';
    const cidade = placeFeature ? placeFeature.text : '';
    const estado = regionFeature ? regionFeature.short_code?.replace('BR-', '') || regionFeature.text : 'MG';

    setAddressStreet(street);
    setAddressNeighborhood(bairro);
    setAddressCity(cidade);
    setAddressState(estado);
    setAddressCep(cep);
    setAddressNumber(''); // Reinicia para o usuário preencher
    setAddressComplement('');

    const formattedAddress = `${street}, ${bairro}, ${cidade} - ${estado}, ${cep}`;
    setDeliveryAddress(formattedAddress);

    const [destLng, destLat] = suggestion.center;

    try {
      const routeEndpoint = `https://api.mapbox.com/directions/v5/mapbox/driving/${storeLongitude},${storeLatitude};${destLng},${destLat}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
      const res = await fetch(routeEndpoint);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const distanceKm = data.routes[0].distance / 1000;
        setCalculatedDistance(distanceKm);

        const result = calculateFeeFromDistance(distanceKm);
        setDeliveryFee(result.fee);
        setNeedsWhatsAppCheckout(result.needsWhatsApp);
        setIsAddressValidated(true); // Endereço devidamente validado pela rota Mapbox
      } else {
        setDeliveryFee(DEFAULT_FALLBACK_FEE);
        setCalculatedDistance(null);
        setNeedsWhatsAppCheckout(false);
        setIsAddressValidated(false);
      }
    } catch (err) {
      console.warn('Erro ao calcular rota no Mapbox Directions:', err);
      setDeliveryFee(DEFAULT_FALLBACK_FEE);
      setCalculatedDistance(null);
      setNeedsWhatsAppCheckout(false);
      setIsAddressValidated(false);
    }
  };

  // Save cart to localstorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('lanchonete_cart', JSON.stringify(cart));
    }
  }, [cart, mounted]);

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Intercept add button for flavor products
  const handleAddButtonClick = (product: Product) => {
    const maxFlavors = getMaxFlavorsForProduct(product.name);
    if (maxFlavors > 0) {
      setFlavorProduct(product);
      setFlavorLimit(maxFlavors);
      setCheckedFlavors([]);
      setIsFlavorModalOpen(true);
    } else {
      addToCart(product, []);
    }
  };

  // Cart operations
  const addToCart = (product: Product, flavors: string[]) => {
    const cartItemId = `${product.id}-${[...flavors].sort().join(',')}`;

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === cartItemId);
      
      const totalQtyOfProduct = prevCart
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (totalQtyOfProduct >= product.stockQuantity) {
        alert(`Desculpe, temos apenas ${product.stockQuantity} unidades deste produto em estoque.`);
        return prevCart;
      }

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...prevCart, { id: cartItemId, product, quantity: 1, selectedFlavors: flavors }];
    });
  };

  const updateQuantity = (cartItemId: string, amount: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === cartItemId) {
          const newQty = item.quantity + amount;
          if (newQty <= 0) return null;
          
          // Check stock limit
          const product = item.product;
          const totalQtyOfProduct = prevCart
            .filter((i) => i.product.id === product.id)
            .reduce((sum, i) => sum + i.quantity, 0);

          if (amount > 0 && totalQtyOfProduct >= product.stockQuantity) {
            alert(`Desculpe, temos apenas ${product.stockQuantity} unidades deste produto em estoque.`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  };

  const totalItems = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  // Get total quantity of a product in the cart (aggregated)
  const getProductQuantityInCart = (productId: string) => {
    return cart
      .filter((i) => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Submit Order
  // Submit Order
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName.trim()) {
      setErrorMessage('Por favor, informe seu nome.');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Por favor, informe seu telefone de contato.');
      return;
    }

    const finalAddress = deliveryType === 'delivery'
      ? `${addressStreet}, ${addressNumber}${addressComplement ? ' - ' + addressComplement : ''}, ${addressNeighborhood}, ${addressCity} - ${addressState}, CEP: ${addressCep}`
      : '';

    if (deliveryType === 'delivery') {
      if (!addressStreet.trim() || !addressNumber.trim() || !addressNeighborhood.trim() || !addressCity.trim() || !addressCep.trim()) {
        setErrorMessage('Por favor, preencha todos os campos obrigatórios do endereço (Rua, Número, Bairro, Cidade e CEP).');
        return;
      }
      if (hasValidToken && !isAddressValidated) {
        setErrorMessage('Por favor, digite seu endereço no campo de busca e selecione uma das opções sugeridas para que possamos calcular o frete correto.');
        return;
      }
      if (!hasValidToken && finalAddress.length < 15) {
        setErrorMessage('Por favor, insira um endereço completo com rua, número e bairro (mínimo de 15 caracteres).');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    // Apenas observações diretas do cliente, sem embutir os sabores
    const finalObservations = observations.trim() ? observations : '';

    // Se a entrega ultrapassar o raio máximo (18km), finaliza por WhatsApp
    if (deliveryType === 'delivery' && needsWhatsAppCheckout) {
      try {
        const itemsListText = cart.map(item => {
          const flavorsText = item.selectedFlavors.length > 0 ? `\n  *Sabores:* ${item.selectedFlavors.join(', ')}` : '';
          return `- ${item.quantity}x ${item.product.name}${flavorsText}\n  Preço: ${formatCurrency(item.product.price * item.quantity)}`;
        }).join('\n');

        const message = `Olá! Gostaria de finalizar meu pedido pelo WhatsApp (Endereço fora do raio de entrega de 18km).

👤 *Cliente:* ${customerName}
📞 *Contato:* ${customerPhone}
🏍️ *Entrega em:* ${finalAddress}
📍 *Distância:* ${calculatedDistance?.toFixed(1)} km

🛒 *Itens do Pedido:*
${itemsListText}

💰 *Subtotal:* ${formatCurrency(cartSubtotal)}
${finalObservations ? `\n📝 *Observações:* ${finalObservations}\n` : ''}
_Aguardando retorno para confirmar a taxa de frete especial e o total._`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${STORE_WHATSAPP_NUMBER}&text=${encodedMessage}`;

        // Abre em nova aba
        window.open(whatsappUrl, '_blank');

        // Salva informações do cliente no localStorage
        localStorage.setItem('lanchonete_customer_name', customerName);
        localStorage.setItem('lanchonete_customer_phone', customerPhone);
        localStorage.setItem('lanchonete_delivery_type', deliveryType);
        localStorage.setItem('lanchonete_delivery_address', finalAddress);
        localStorage.setItem('lanchonete_address_street', addressStreet);
        localStorage.setItem('lanchonete_address_number', addressNumber);
        localStorage.setItem('lanchonete_address_complement', addressComplement);
        localStorage.setItem('lanchonete_address_neighborhood', addressNeighborhood);
        localStorage.setItem('lanchonete_address_city', addressCity);
        localStorage.setItem('lanchonete_address_state', addressState);
        localStorage.setItem('lanchonete_address_cep', addressCep);
        localStorage.setItem('lanchonete_delivery_fee', deliveryFee.toString());
        if (calculatedDistance !== null) {
          localStorage.setItem('lanchonete_calculated_distance', calculatedDistance.toString());
        }
        localStorage.setItem('lanchonete_is_address_validated', isAddressValidated.toString());

        // Limpa estados e exibe tela de sucesso para WhatsApp
        setCart([]);
        setObservations('');
        setOrderSuccess(true);
      } catch (err: any) {
        setErrorMessage('Ocorreu um erro ao gerar a mensagem do WhatsApp.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryType: deliveryType === 'delivery' ? 'ENTREGA' : 'RETIRADA',
          deliveryAddress: deliveryType === 'delivery' ? finalAddress : undefined,
          deliveryFee: deliveryType === 'delivery' ? deliveryFee : 0,
          observations: finalObservations || undefined,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            selectedFlavors: item.selectedFlavors.length > 0 ? item.selectedFlavors.join(', ') : undefined,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao enviar o pedido.');
      }

      // Success
      setCreatedOrderId(data.order.id);

      // Build WhatsApp message for standard order confirmation
      try {
        const itemsListText = cart.map(item => {
          const flavorsText = item.selectedFlavors.length > 0 ? `\n  *Sabores:* ${item.selectedFlavors.join(', ')}` : '';
          return `- ${item.quantity}x ${item.product.name}${flavorsText}\n  Preço: ${formatCurrency(item.product.price * item.quantity)}`;
        }).join('\n');

        const message = `Olá! Acabei de enviar um pedido pelo site. Segue o comprovante:

📌 *Código do Pedido:* #${data.order.id.slice(0, 8)}
👤 *Cliente:* ${customerName}
📞 *Contato:* ${customerPhone}
🏍️ *Serviço:* ${deliveryType === 'delivery' ? 'Entrega em Casa' : 'Retirada na Loja'}
${deliveryType === 'delivery' ? `📍 *Endereço:* ${finalAddress}\n💵 *Taxa de Entrega:* ${formatCurrency(deliveryFee)}\n📍 *Distância:* ${calculatedDistance?.toFixed(1)} km` : ''}

🛒 *Itens do Pedido:*
${itemsListText}

💰 *Total do Pedido:* ${formatCurrency(cartSubtotal + (deliveryType === 'delivery' ? deliveryFee : 0))}
${finalObservations ? `\n📝 *Observações:* ${finalObservations}\n` : ''}
🔗 *Acompanhar status:* ${window.location.origin}/pedido/${data.order.id}`;

        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.whatsapp.com/send?phone=${STORE_WHATSAPP_NUMBER}&text=${encodedMessage}`;
        setSuccessWhatsAppUrl(url);
      } catch (err) {
        console.warn('Erro ao gerar URL do WhatsApp de sucesso:', err);
      }

      setOrderSuccess(true);
      
      // Update local products stock
      setProducts((prevProducts) => {
        return prevProducts.map((p) => {
          const totalQtyInCart = cart
            .filter((item) => item.product.id === p.id)
            .reduce((sum, item) => sum + item.quantity, 0);

          if (totalQtyInCart > 0) {
            return {
              ...p,
              stockQuantity: Math.max(0, p.stockQuantity - totalQtyInCart),
            };
          }
          return p;
        });
      });

      // Save customer info to localstorage
      localStorage.setItem('lanchonete_customer_name', customerName);
      localStorage.setItem('lanchonete_customer_phone', customerPhone);
      localStorage.setItem('lanchonete_delivery_type', deliveryType);
      if (deliveryType === 'delivery') {
        localStorage.setItem('lanchonete_delivery_address', finalAddress);
        localStorage.setItem('lanchonete_address_street', addressStreet);
        localStorage.setItem('lanchonete_address_number', addressNumber);
        localStorage.setItem('lanchonete_address_complement', addressComplement);
        localStorage.setItem('lanchonete_address_neighborhood', addressNeighborhood);
        localStorage.setItem('lanchonete_address_city', addressCity);
        localStorage.setItem('lanchonete_address_state', addressState);
        localStorage.setItem('lanchonete_address_cep', addressCep);
        localStorage.setItem('lanchonete_delivery_fee', deliveryFee.toString());
        if (calculatedDistance !== null) {
          localStorage.setItem('lanchonete_calculated_distance', calculatedDistance.toString());
        }
        localStorage.setItem('lanchonete_is_address_validated', isAddressValidated.toString());
      } else {
        localStorage.removeItem('lanchonete_delivery_address');
        localStorage.removeItem('lanchonete_address_street');
        localStorage.removeItem('lanchonete_address_number');
        localStorage.removeItem('lanchonete_address_complement');
        localStorage.removeItem('lanchonete_address_neighborhood');
        localStorage.removeItem('lanchonete_address_city');
        localStorage.removeItem('lanchonete_address_state');
        localStorage.removeItem('lanchonete_address_cep');
        localStorage.removeItem('lanchonete_delivery_fee');
        localStorage.removeItem('lanchonete_calculated_distance');
        localStorage.removeItem('lanchonete_is_address_validated');
      }

      // Save order ID to localstorage history list
      const savedOrders = localStorage.getItem('lanchonete_orders');
      let orderIds = [];
      if (savedOrders) {
        try {
          orderIds = JSON.parse(savedOrders);
        } catch {}
      }
      orderIds.push(data.order.id);
      localStorage.setItem('lanchonete_orders', JSON.stringify(orderIds));

      // Clear states (keeping name and address for auto-fill in future orders)
      setCart([]);
      setObservations('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render placeholders if not mounted to avoid hydration errors
  if (!mounted) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.logo}><Utensils /> Modelo Super Salgados</h1>
          <p className={styles.subtitle}>Carregando cardápio digital...</p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header} style={{ width: '100%' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <h1 className={styles.logo} style={{ margin: 0 }}>
            <Utensils style={{ color: 'var(--primary)' }} />
            Modelo Super Salgados
          </h1>
          <button 
            onClick={openMyOrdersModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--foreground)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'var(--transition-normal)'
            }}
          >
            📋 Meus Pedidos
          </button>
        </div>
        <p className={styles.subtitle} style={{ width: '100%', textAlign: 'left', margin: 0 }}>
          Sabores irresistíveis entregues direto na sua casa ou prontos para retirada!
        </p>
      </header>

      {/* Search Input */}
      <div className={styles.searchContainer}>
        <Search className={styles.searchIcon} size={20} />
        <input
          type="text"
          placeholder="Buscar no cardápio... (ex: Hamburguer)"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Categories Horizontal Scroll */}
      <div className={`${styles.categoryScroll} hide-scrollbar`}>
        <button
          className={`${styles.categoryButton} ${selectedCategoryId === 'all' ? styles.activeCategory : ''}`}
          onClick={() => setSelectedCategoryId('all')}
        >
          🍽️ Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.categoryButton} ${selectedCategoryId === cat.id ? styles.activeCategory : ''}`}
            onClick={() => setSelectedCategoryId(cat.id)}
          >
            {cat.icon || '📌'} {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className={styles.emptyCart} style={{ height: '300px' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Nenhum produto encontrado</p>
          <p style={{ color: 'var(--secondary)' }}>Tente mudar sua busca ou categoria.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredProducts.map((product) => {
            const qtyInCart = getProductQuantityInCart(product.id);
            const isOutOfStock = product.stockQuantity <= 0;
            const isLowStock = product.stockQuantity <= 5 && product.stockQuantity > 0;

            return (
              <div key={product.id} className={styles.card}>
                <div className={styles.cardImageContainer}>
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className={styles.cardImage}
                      onError={(e) => {
                        // fallback image in case unsplash fails
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                  ) : (
                    <div style={{ height: '100%', background: '#1f1f23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      🍔
                    </div>
                  )}

                  {isOutOfStock && (
                    <div className={styles.outOfStockBadge}>ESGOTADO</div>
                  )}
                  
                  {!isOutOfStock && isLowStock && (
                    <div className={styles.stockBadge}>
                      Apenas {product.stockQuantity} restam!
                    </div>
                  )}
                </div>

                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{product.name}</h3>
                  <p className={styles.cardDescription}>{product.description}</p>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.price}>{formatCurrency(product.price)}</span>
                  
                  {isOutOfStock ? (
                    <button className={styles.addButton} disabled>
                      Indisponível
                    </button>
                  ) : isFlavorProduct(product.name) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {qtyInCart > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700, background: 'rgba(249, 115, 22, 0.15)', padding: '4px 8px', borderRadius: '4px' }}>
                          {qtyInCart} no carrinho
                        </span>
                      )}
                      <button 
                        className={styles.addButton}
                        onClick={() => handleAddButtonClick(product)}
                      >
                        <Plus size={16} /> {qtyInCart > 0 ? 'Adicionar mais' : 'Adicionar'}
                      </button>
                    </div>
                  ) : qtyInCart > 0 ? (
                    <div className={styles.cardQtyControl}>
                      <button 
                        className={styles.cardQtyBtn}
                        onClick={() => {
                          const item = cart.find((i) => i.product.id === product.id);
                          if (item) updateQuantity(item.id, -1);
                        }}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus size={16} />
                      </button>
                      <span className={styles.cardQtyValue}>{qtyInCart}</span>
                      <button 
                        className={styles.cardQtyBtn}
                        onClick={() => {
                          const item = cart.find((i) => i.product.id === product.id);
                          if (item) updateQuantity(item.id, 1);
                        }}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      className={styles.addButton}
                      onClick={() => addToCart(product, [])}
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating WhatsApp Button */}
      <a 
        href={`https://api.whatsapp.com/send?phone=${STORE_WHATSAPP_NUMBER}&text=${encodeURIComponent('Olá! Gostaria de tirar uma dúvida sobre o cardápio da salgaderia.')}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.whatsappFloatingBtn}
        aria-label="Fale conosco no WhatsApp"
      >
        <svg viewBox="0 0 24 24" className={styles.whatsappIcon} fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.388 2.036 13.91 1.012 11.282 1.01 5.842 1.01 1.417 5.38 1.413 10.81c-.001 1.693.447 3.344 1.3 4.794l-.995 3.633 3.722-.976zm11.367-5.649c-.292-.146-1.729-.854-1.997-.951-.269-.098-.463-.146-.657.146-.194.293-.75.951-.918 1.146-.168.194-.337.22-.63.073-.292-.146-1.237-.456-2.355-1.453-.87-.775-1.457-1.731-1.628-2.024-.171-.292-.018-.45.129-.595.132-.131.292-.341.439-.512.146-.17.195-.292.292-.487.098-.195.049-.366-.025-.512-.073-.146-.657-1.585-.9-2.17-.236-.57-.496-.49-.657-.498-.17-.008-.364-.01-.56-.01-.194 0-.511.073-.779.366-.269.292-1.023 1.001-1.023 2.44 0 1.438 1.047 2.83 1.193 3.025.146.195 2.062 3.149 4.996 4.413.697.301 1.242.482 1.668.618.701.223 1.34.191 1.845.116.563-.083 1.729-.707 1.973-1.39.244-.683.244-1.268.17-1.39-.074-.121-.268-.194-.56-.34z" />
        </svg>
      </a>

      {/* Floating Cart Button (Mobile) */}
      {totalItems > 0 && (
        <button 
          className={styles.cartBtnFloating}
          onClick={() => setIsCartOpen(true)}
          aria-label="Abrir carrinho"
        >
          <ShoppingCart size={26} />
          <span className={styles.cartBadge}>{totalItems}</span>
        </button>
      )}

      {/* Cart Sidebar Modal Drawer */}
      {isCartOpen && (
        <>
          <div className={styles.sidebarOverlay} onClick={() => setIsCartOpen(false)} />
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>
                <ShoppingCart style={{ color: 'var(--primary)' }} /> Seu Pedido
              </h2>
              <button className={styles.closeBtn} onClick={() => setIsCartOpen(false)} aria-label="Fechar carrinho">
                <X size={20} />
              </button>
            </div>

            <div className={styles.sidebarBody}>
              {orderSuccess ? (
                <div className={styles.successScreen}>
                  <div className={styles.successIconContainer}>
                    <CheckCircle2 size={48} />
                  </div>
                  <h3 className={styles.successTitle}>
                    {createdOrderId ? 'Pedido Enviado!' : 'Conclua no WhatsApp'}
                  </h3>
                  <p className={styles.successText}>
                    {createdOrderId 
                      ? 'Obrigado! Seu pedido já foi enviado para a cozinha. Você pode acompanhar o status da preparação e entrega em tempo real abaixo.'
                      : 'Obrigado! Uma aba do WhatsApp foi aberta para você enviar os detalhes do seu pedido e combinar a taxa de entrega especial direto com o nosso atendente.'
                    }
                  </p>
                  {createdOrderId && (
                    <Link 
                      href={`/pedido/${createdOrderId}`}
                      className={styles.trackBtn}
                    >
                      Acompanhar Status do Pedido
                    </Link>
                  )}
                  {successWhatsAppUrl && (
                    <a 
                      href={successWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.whatsappSuccessBtn}
                    >
                      <MessageCircle size={20} /> Enviar comprovante no WhatsApp
                    </a>
                  )}
                  <button 
                    className={styles.continueBtn}
                    onClick={() => {
                      setOrderSuccess(false);
                      setCreatedOrderId(null);
                      setSuccessWhatsAppUrl('');
                      setIsCartOpen(false);
                    }}
                  >
                    Fazer outro pedido
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <div className={styles.emptyCart}>
                  <ShoppingCart size={48} style={{ color: 'var(--muted)' }} />
                  <p style={{ fontWeight: 600 }}>Seu carrinho está vazio</p>
                  <p style={{ fontSize: '0.88rem' }}>Adicione itens do cardápio para começar.</p>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className={styles.cartList}>
                    {cart.map((item) => (
                      <div key={item.id} className={styles.cartItem}>
                        {item.product.imageUrl && (
                          <img 
                            src={item.product.imageUrl} 
                            alt={item.product.name} 
                            className={styles.cartItemImage} 
                          />
                        )}
                        <div className={styles.cartItemInfo}>
                          <span className={styles.cartItemName}>{item.product.name}</span>
                          {item.selectedFlavors.length > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '2px', display: 'block', lineHeight: 1.3 }}>
                              Sabores: {item.selectedFlavors.join(', ')}
                            </span>
                          )}
                          <span className={styles.cartItemPrice}>
                            {formatCurrency(item.product.price * item.quantity)}
                          </span>
                        </div>
                        
                        <div className={styles.cartItemQty}>
                          <button 
                            className={styles.cartItemQtyBtn}
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span className={item.quantity > 9 ? '' : styles.cartItemQtyVal}>{item.quantity}</span>
                          <button 
                            className={styles.cartItemQtyBtn}
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <button 
                          className={styles.deleteItemBtn}
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remover item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Order Summary */}
                  <div className={styles.summarySection}>
                    <div className={styles.summaryRow}>
                      <span>Itens ({totalItems})</span>
                      <span>{formatCurrency(cartSubtotal)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span>Taxa de Entrega</span>
                      <span>{deliveryType === 'delivery' ? (needsWhatsAppCheckout ? 'A combinar' : formatCurrency(deliveryFee)) : 'Grátis'}</span>
                    </div>
                    {deliveryType === 'delivery' && calculatedDistance !== null && (
                      <div className={styles.distanceInfo}>
                        📍 Distância: {calculatedDistance.toFixed(1)} km
                      </div>
                    )}
                    <div className={styles.totalRow}>
                      <span>Total</span>
                      <span>{deliveryType === 'delivery' && needsWhatsAppCheckout ? 'A combinar' : formatCurrency(cartSubtotal + (deliveryType === 'delivery' ? deliveryFee : 0))}</span>
                    </div>
                  </div>

                  {/* Checkout Form */}
                  <form onSubmit={handleCheckout} className={styles.checkoutForm}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Seu Nome</label>
                      <input
                        type="text"
                        placeholder="Ex: Carlos Silva"
                        className={styles.formInput}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Seu Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        placeholder="Ex: (31) 98765-4321"
                        className={styles.formInput}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Como prefere receber?</label>
                      <div className={styles.radioGroup}>
                        <button
                          type="button"
                          className={`${styles.radioButton} ${deliveryType === 'delivery' ? styles.radioButtonActive : ''}`}
                          onClick={() => handleDeliveryTypeChange('delivery')}
                        >
                          🏍️ Entrega em Casa
                        </button>
                        <button
                          type="button"
                          className={`${styles.radioButton} ${deliveryType === 'pickup' ? styles.radioButtonActive : ''}`}
                          onClick={() => handleDeliveryTypeChange('pickup')}
                        >
                          🛍️ Retirada na Loja
                        </button>
                      </div>
                    </div>

                    {deliveryType === 'delivery' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeIn 0.2s ease' }}>
                        {/* Campo de Busca do Mapbox (só exibe se tiver token válido) */}
                        {hasValidToken && (
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Buscar Endereço (Rua e Bairro)</label>
                            <div className={styles.relativeContainer}>
                              <input
                                type="text"
                                placeholder="Digite sua rua ou avenida..."
                                className={styles.formInput}
                                value={deliveryAddress}
                                onChange={(e) => {
                                  setDeliveryAddress(e.target.value);
                                  setCalculatedDistance(null);
                                  setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                  setNeedsWhatsAppCheckout(false);
                                  setIsAddressValidated(false);
                                  setShowSuggestions(true);
                                  
                                  // Limpa os campos estruturados ao digitar uma nova busca
                                  setAddressStreet('');
                                  setAddressNumber('');
                                  setAddressComplement('');
                                  setAddressNeighborhood('');
                                  setAddressCity('');
                                  setAddressCep('');
                                }}
                                onBlur={() => {
                                  setTimeout(() => setShowSuggestions(false), 250);
                                }}
                                onFocus={() => {
                                  if (addressSuggestions.length > 0) {
                                    setShowSuggestions(true);
                                  }
                                }}
                              />
                              
                              {isSearchingAddress && (
                                <div className={styles.addressLoader}>Buscando...</div>
                              )}

                              {showSuggestions && addressSuggestions.length > 0 && (
                                <ul className={styles.suggestionsList}>
                                  {addressSuggestions.map((suggestion) => (
                                    <li
                                      key={suggestion.id}
                                      className={styles.suggestionItem}
                                      onClick={() => handleSelectSuggestion(suggestion)}
                                    >
                                      {suggestion.place_name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Campos Estruturados (exibidos após validar, ou sempre se for fallback) */}
                        {(!hasValidToken || isAddressValidated || addressStreet) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s ease' }}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Rua / Logradouro</label>
                              <input
                                type="text"
                                className={styles.formInput}
                                value={addressStreet}
                                onChange={(e) => {
                                  setAddressStreet(e.target.value);
                                  // Se editar manualmente a rua, perde a validação Mapbox
                                  if (hasValidToken) {
                                    setIsAddressValidated(false);
                                    setCalculatedDistance(null);
                                    setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                  }
                                }}
                                required
                                placeholder="Rua, Avenida, Praça..."
                              />
                            </div>

                            <div className={styles.addressGrid}>
                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Número</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressNumber}
                                  onChange={(e) => setAddressNumber(e.target.value)}
                                  required
                                  placeholder="Ex: 535"
                                />
                              </div>

                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Complemento</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressComplement}
                                  onChange={(e) => setAddressComplement(e.target.value)}
                                  placeholder="Apto, Bloco, Casa..."
                                />
                              </div>
                            </div>

                            <div className={styles.addressGrid}>
                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Bairro</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressNeighborhood}
                                  onChange={(e) => {
                                    setAddressNeighborhood(e.target.value);
                                    if (hasValidToken) {
                                      setIsAddressValidated(false);
                                      setCalculatedDistance(null);
                                      setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                    }
                                  }}
                                  required
                                  placeholder="Bairro"
                                />
                              </div>

                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>CEP</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressCep}
                                  onChange={(e) => {
                                    setAddressCep(e.target.value);
                                    if (hasValidToken) {
                                      setIsAddressValidated(false);
                                      setCalculatedDistance(null);
                                      setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                    }
                                  }}
                                  required
                                  placeholder="31840-050"
                                />
                              </div>
                            </div>

                            <div className={styles.addressGrid}>
                              <div className={styles.formGroup} style={{ flex: 2 }}>
                                <label className={styles.formLabel}>Cidade</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressCity}
                                  onChange={(e) => {
                                    setAddressCity(e.target.value);
                                    if (hasValidToken) {
                                      setIsAddressValidated(false);
                                      setCalculatedDistance(null);
                                      setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                    }
                                  }}
                                  required
                                  placeholder="Belo Horizonte"
                                />
                              </div>

                              <div className={styles.formGroup} style={{ flex: 1 }}>
                                <label className={styles.formLabel}>Estado</label>
                                <input
                                  type="text"
                                  className={styles.formInput}
                                  value={addressState}
                                  onChange={(e) => {
                                    setAddressState(e.target.value);
                                    if (hasValidToken) {
                                      setIsAddressValidated(false);
                                      setCalculatedDistance(null);
                                      setDeliveryFee(DEFAULT_FALLBACK_FEE);
                                    }
                                  }}
                                  required
                                  placeholder="MG"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.formGroup} style={{ marginTop: '8px' }}>
                      <label className={styles.formLabel}>Observações Gerais (Opcional)</label>
                      <textarea
                        placeholder="Ex: Ponto de referência, observações para a entrega..."
                        className={styles.formInput}
                        rows={2}
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>

                    {deliveryType === 'delivery' && needsWhatsAppCheckout && (
                      <div className={styles.whatsappWarningBanner}>
                        <p className={styles.whatsappWarningTitle}>⚠️ Entrega Fora do Raio Padrão</p>
                        <p className={styles.whatsappWarningText}>
                          A distância calculada para o seu endereço é de <strong>{calculatedDistance?.toFixed(1)} km</strong>, que excede nosso limite padrão de {MAX_DELIVERY_DISTANCE_KM} km. 
                          Para prosseguir, finalize seu pedido diretamente com nossa equipe no WhatsApp para combinarmos o frete.
                        </p>
                      </div>
                    )}

                    {errorMessage && (
                      <div className={styles.errorMsg}>
                        ⚠️ {errorMessage}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className={needsWhatsAppCheckout ? styles.whatsappCheckoutBtn : styles.checkoutBtn}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Enviando...' : (needsWhatsAppCheckout ? '📱 Finalizar Pedido pelo WhatsApp' : 'Confirmar e Enviar Pedido')}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Flavor Selection Modal */}
      {isFlavorModalOpen && flavorProduct && (
        <>
          <div className={styles.modalOverlay} onClick={() => setIsFlavorModalOpen(false)} />
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Escolha os Sabores</h3>
              <button 
                className={styles.closeBtn} 
                onClick={() => setIsFlavorModalOpen(false)}
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.95rem', color: 'var(--secondary)', marginBottom: '8px' }}>
                Item selecionado: <strong>{flavorProduct.name}</strong>.
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--accent)', marginBottom: '16px', fontWeight: 600 }}>
                Escolha até {flavorLimit} sabor{flavorLimit > 1 ? 'es' : ''} (serão divididos igualmente):
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {TRADITIONAL_FLAVORS.map((flavor) => {
                  const isChecked = checkedFlavors.includes(flavor);
                  const isDisabled = !isChecked && checkedFlavors.length >= flavorLimit;
                  
                  return (
                    <label 
                      key={flavor} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: isChecked ? 'rgba(249, 115, 22, 0.08)' : 'var(--secondary-bg)',
                        border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--card-border)'}`,
                        borderRadius: '8px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'all 0.2s',
                        fontWeight: isChecked ? 600 : 'normal'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (checkedFlavors.length < flavorLimit) {
                              setCheckedFlavors([...checkedFlavors, flavor]);
                            }
                          } else {
                            setCheckedFlavors(checkedFlavors.filter((f) => f !== flavor));
                          }
                        }}
                        style={{
                          accentColor: 'var(--primary)',
                          width: '18px',
                          height: '18px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer'
                        }}
                      />
                      <span>{flavor}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className={styles.modalFooter} style={{ padding: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '12px' }}>
              <button 
                className={styles.continueBtn}
                style={{ flex: 1, margin: 0, padding: '12px' }}
                onClick={() => setIsFlavorModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.checkoutBtn}
                style={{ flex: 2, margin: 0, padding: '12px' }}
                disabled={checkedFlavors.length === 0}
                onClick={() => {
                  addToCart(flavorProduct, checkedFlavors);
                  setIsFlavorModalOpen(false);
                }}
              >
                Confirmar ({checkedFlavors.length}/{flavorLimit})
              </button>
            </div>
          </div>
        </>
      )}

      {/* My Orders Modal Drawer */}
      {isMyOrdersOpen && (
        <>
          <div className={styles.modalOverlay} onClick={() => setIsMyOrdersOpen(false)} />
          <div className={styles.modal} style={{ maxWidth: '440px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>📋 Seus Pedidos Recentes</h3>
              <button 
                className={styles.closeBtn} 
                onClick={() => setIsMyOrdersOpen(false)}
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isLoadingMyOrders ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <p>Carregando pedidos...</p>
                </div>
              ) : myOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--secondary)' }}>
                  <p>Nenhum pedido encontrado neste dispositivo.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '6px' }}>Seus pedidos aparecerão aqui assim que finalizar uma compra.</p>
                </div>
              ) : (
                myOrders.map((order) => {
                  let statusLabel = '';
                  let statusStyle = {};
                  switch (order.status) {
                    case 'NOVO':
                      statusLabel = 'Recebido';
                      statusStyle = { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
                      break;
                    case 'PREPARO':
                      statusLabel = 'Na Cozinha';
                      statusStyle = { background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' };
                      break;
                    case 'PRONTO':
                      statusLabel = order.deliveryType === 'ENTREGA' ? 'Saiu p/ entrega' : 'Pronto p/ Retirada';
                      statusStyle = { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' };
                      break;
                    case 'ENTREGUE':
                      statusLabel = 'Entregue';
                      statusStyle = { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' };
                      break;
                    case 'CANCELADO':
                      statusLabel = 'Cancelado';
                      statusStyle = { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
                      break;
                  }
                  
                  return (
                    <div 
                      key={order.id} 
                      style={{
                        padding: '16px',
                        background: 'var(--secondary-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                          Código: {order.id.slice(0, 8)}...
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', ...statusStyle }}>
                          {statusLabel}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                          Total: {formatCurrency(order.total)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>
                          {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <Link 
                        href={`/pedido/${order.id}`}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                          backgroundColor: 'var(--primary)',
                          color: '#000000',
                          padding: '10px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          textDecoration: 'none',
                          fontSize: '0.88rem',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        Acompanhar Status
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
