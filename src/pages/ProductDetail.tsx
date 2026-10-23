import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin, Store, TrendingDown, CheckCircle2, Share2, Heart, ShieldAlert } from 'lucide-react';

const ROSARIO_LAT = -32.9468;
const ROSARIO_LNG = -60.6393;

function getDistanceInKm(lat1?: number, lon1?: number): number {
  if (!lat1 || !lon1) return 1.8;
  const R = 6371;
  const dLat = (ROSARIO_LAT - lat1) * (Math.PI / 180);
  const dLon = (ROSARIO_LNG - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(ROSARIO_LAT * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = Math.round(R * c * 10) / 10;
  return dist > 30 ? 2.5 : dist || 1.5;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductDetail() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);

        const { data, error: sbError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            brand,
            image_url,
            category_id,
            categories (
              id,
              name
            ),
            prices (
              id,
              price,
              original_price,
              stores (
                id,
                name,
                address,
                latitude,
                longitude
              )
            )
          `)
          .eq('id', id)
          .maybeSingle();

        if (sbError) {
          console.error('❌ Error de Supabase al cargar detalle:', sbError);
          setError('No se pudo encontrar el producto.');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('El producto ya no existe.');
          setLoading(false);
          return;
        }

        const rawPrices = Array.isArray(data.prices) ? data.prices : [];

        // Deduplicar lista de supermercados (una sola entrada por cadena)
        const uniqueStoresMap = new Map<string, any>();

        for (const p of rawPrices) {
          let storeData = p.stores || p.store;
          if (Array.isArray(storeData)) storeData = storeData[0];
          if (!storeData || !storeData.name) continue;

          const storeNameClean = String(storeData.name).trim();

          // Ignorar tiendas no activas de Rosario
          if (storeNameClean.toLowerCase().includes('disco')) continue;

          const distKm = getDistanceInKm(storeData.latitude, storeData.longitude);
          if (distKm > 30) continue;

          const priceVal = Number(p.price);
          if (isNaN(priceVal) || priceVal <= 0) continue;

          const origPrice = p.original_price ? Number(p.original_price) : priceVal;

          const priceItem = {
            id: p.id,
            price: priceVal,
            originalPrice: origPrice,
            storeName: storeNameClean,
            address: storeData.address || 'Rosario',
            distanceKm: distKm
          };

          if (!uniqueStoresMap.has(storeNameClean) || uniqueStoresMap.get(storeNameClean).price > priceVal) {
            uniqueStoresMap.set(storeNameClean, priceItem);
          }
        }

        const sortedPrices = Array.from(uniqueStoresMap.values()).sort((a, b) => a.price - b.price);

        setProduct({
          ...data,
          pricesList: sortedPrices,
          categoryName: data.categories?.name || 'Almacén'
        });

      } catch (err: any) {
        console.error('Error cargando detalle:', err);
        setError('Error al cargar la información del producto.');
      } finally {
        setLoading(false);
      }
    }

    fetchProductDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="space-y-4 text-center max-w-sm w-full">
          <div className="h-48 bg-muted/40 rounded-2xl animate-pulse w-full"></div>
          <div className="h-6 bg-muted/40 rounded animate-pulse w-3/4 mx-auto"></div>
          <div className="h-10 bg-muted/40 rounded-xl animate-pulse w-full"></div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="w-12 h-12 text-destructive mb-3" />
        <p className="font-semibold text-lg text-foreground mb-4">{error || 'Producto no encontrado'}</p>
        <Button onClick={() => navigate('/')} variant="default" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al inicio
        </Button>
      </div>
    );
  }

  const pricesList = product.pricesList || [];
  const bestPrice = pricesList[0] || { price: product.price || 0, storeName: 'Coto', distanceKm: 1.5 };
  const highestPrice = pricesList.length > 1 ? pricesList[pricesList.length - 1].price : bestPrice.price;
  const maxSavings = highestPrice > bestPrice.price ? highestPrice - bestPrice.price : 0;
  const maxSavingsPct = highestPrice > bestPrice.price ? Math.round((maxSavings / highestPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Header Superior */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-full w-8 h-8">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full w-8 h-8 text-rose-500">
              <Heart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card className="overflow-hidden border border-border/60 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-6">
            
            {/* Imagen Controlada (Sin ser invasiva) */}
            <div className="w-full h-56 bg-muted/20 rounded-2xl p-4 flex items-center justify-center relative border border-border/40 overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="max-h-48 w-auto object-contain mix-blend-multiply transition-transform hover:scale-105 duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Store className="w-16 h-16 text-muted-foreground/30" />
              )}

              {maxSavingsPct > 0 && (
                <Badge className="absolute top-3 right-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1 shadow-sm gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Ahorrá {maxSavingsPct}%
                </Badge>
              )}

              <Badge variant="outline" className="absolute top-3 left-3 bg-background/80 backdrop-blur-md text-xs">
                {product.categoryName}
              </Badge>
            </div>

            {/* Nombre y Marca */}
            <div className="space-y-1">
              {product.brand && (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  {product.brand}
                </span>
              )}
              <h1 className="text-xl font-bold text-foreground leading-snug">
                {product.name}
              </h1>
            </div>

            {/* Mejor Precio */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                  Mejor Precio en Rosario
                </span>
                <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                  ${bestPrice.price.toLocaleString('es-AR')}
                </span>
                {maxSavings > 0 && (
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 pt-1">
                    en <span className="font-bold">{bestPrice.storeName}</span> • Ahorrás ${maxSavings.toLocaleString('es-AR')} vs el más caro
                  </p>
                )}
              </div>

              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 text-sm">
                {bestPrice.storeName}
              </Badge>
            </div>

            {/* Comparativa por Cadena */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Comparar precios ({pricesList.length} supermercados)</span>
              </h3>

              <div className="space-y-2.5">
                {pricesList.map((item: any, idx: number) => {
                  const isBest = idx === 0;
                  const diff = item.price - bestPrice.price;

                  return (
                    <div
                      key={item.id || item.storeName}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                        isBest
                          ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm'
                          : 'border-border/60 bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-foreground">{item.storeName}</span>
                          {isBest && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 font-bold px-2 py-0">
                              <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Mejor opción
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>a {item.distanceKm} km en Rosario</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-black text-foreground block">
                          ${item.price.toLocaleString('es-AR')}
                        </span>
                        {diff > 0 ? (
                          <span className="text-xs font-semibold text-rose-500">
                            +${diff.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600">
                            Precio más bajo
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}