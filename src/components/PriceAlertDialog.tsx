import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { PERCENT_OPTIONS, alertThreshold, type AlertKind } from "@/lib/alerts";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  bestPrice: number;
  storeIds: string[];
}

// Elegir cómo avisar: a un precio, cuando baje un porcentaje o ante cualquier baja.
export default function PriceAlertDialog({ open, onOpenChange, productId, productName, bestPrice, storeIds }: Props) {
  const { getAlert, saveAlert, removeAlert, saving } = usePriceAlerts();
  const current = getAlert(productId);
  const [kind, setKind] = useState<AlertKind>("any");
  const [target, setTarget] = useState("");
  const [percent, setPercent] = useState(10);

  useEffect(() => {
    if (!open) return;
    setKind(current?.kind ?? "any");
    setTarget(current?.target_price ? String(Math.round(current.target_price)) : String(Math.round(bestPrice * 0.9)));
    setPercent(current?.percent ?? 10);
  }, [open, current, bestPrice]);

  const targetNum = Number(target.replace(/\D/g, ""));
  const targetError = kind === "target" && (!targetNum || targetNum >= bestPrice) ? `Tiene que ser menor a ${money(bestPrice)}` : "";

  const submit = async () => {
    if (targetError) return;
    try {
      await saveAlert({ productId, basePrice: bestPrice, kind, targetPrice: targetNum, percent, storeIds });
      onOpenChange(false);
    } catch {
      // el toast ya avisa
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" aria-hidden /> Alerta de precio
          </DialogTitle>
          <DialogDescription>
            {productName}. Hoy el mejor precio es {money(bestPrice)}. Revisamos todos los días los precios de todas las tiendas que ves acá y te
            avisamos en tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={kind} onValueChange={(v) => setKind(v as AlertKind)} className="gap-3">
          <Label htmlFor="ak-target" className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer has-[:checked]:border-primary">
            <RadioGroupItem value="target" id="ak-target" className="mt-0.5" />
            <span className="flex-1 space-y-2">
              <span className="block font-medium">Cuando llegue a un precio</span>
              {kind === "target" && (
                <span className="block">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      inputMode="numeric"
                      value={target}
                      onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
                      aria-label="Precio objetivo"
                      aria-invalid={!!targetError}
                      className="h-9"
                    />
                  </span>
                  {targetError && <span className="block text-xs text-destructive mt-1">{targetError}</span>}
                </span>
              )}
            </span>
          </Label>

          <Label htmlFor="ak-percent" className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer has-[:checked]:border-primary">
            <RadioGroupItem value="percent" id="ak-percent" className="mt-0.5" />
            <span className="flex-1 space-y-2">
              <span className="block font-medium">Cuando baje un porcentaje</span>
              {kind === "percent" && (
                <span className="block space-y-1">
                  <span className="flex flex-wrap gap-1.5">
                    {PERCENT_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPercent(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${percent === p ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                      >
                        {p}%
                      </button>
                    ))}
                  </span>
                  <span className="block text-xs text-muted-foreground font-normal">
                    Te avisamos si llega a {money(alertThreshold({ kind: "percent", base_price: bestPrice, percent }))} o menos.
                  </span>
                </span>
              )}
            </span>
          </Label>

          <Label htmlFor="ak-any" className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer has-[:checked]:border-primary">
            <RadioGroupItem value="any" id="ak-any" className="mt-0.5" />
            <span className="block font-medium">Ante cualquier baja</span>
          </Label>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-2">
          {current && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                removeAlert(productId);
                onOpenChange(false);
              }}
            >
              Quitar alerta
            </Button>
          )}
          <Button onClick={submit} disabled={saving || !!targetError}>
            {current ? "Guardar cambios" : "Crear alerta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
