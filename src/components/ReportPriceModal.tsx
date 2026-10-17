import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, Flag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ReportPriceModalProps {
  priceId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  "El precio es incorrecto",
  "El producto ya no está disponible",
  "La tienda cerró",
  "Información duplicada",
  "Otro motivo",
];

const ReportPriceModal = ({ priceId, onClose }: ReportPriceModalProps) => {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState("");
  const [correctPrice, setCorrectPrice] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No autenticado");

      const reason = additionalInfo 
        ? `${selectedReason}: ${additionalInfo}`
        : selectedReason;

      const { error } = await supabase.from("price_reports").insert({
        price_id: priceId,
        reported_by: user.id,
        reason,
        correct_price: correctPrice ? Number(correctPrice) : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Reporte enviado! Gracias por tu ayuda.");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar reporte");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error("Selecciona un motivo");
      return;
    }
    reportMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold">Reportar precio</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Reason selection */}
          <div className="space-y-2">
            <Label>¿Cuál es el problema?</Label>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedReason === reason
                      ? "border-primary bg-primary-light"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Correct price if applicable */}
          {selectedReason === "El precio es incorrecto" && (
            <div className="space-y-2">
              <Label htmlFor="correctPrice">Precio correcto (opcional)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="correctPrice"
                  type="number"
                  placeholder="0"
                  value={correctPrice}
                  onChange={(e) => setCorrectPrice(e.target.value)}
                  className="pl-10"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          {/* Additional info */}
          {selectedReason === "Otro motivo" && (
            <div className="space-y-2">
              <Label htmlFor="additionalInfo">Describe el problema</Label>
              <Textarea
                id="additionalInfo"
                placeholder="Cuéntanos qué está mal..."
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="action"
              className="flex-1"
              disabled={reportMutation.isPending}
            >
              {reportMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Enviar reporte"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPriceModal;
