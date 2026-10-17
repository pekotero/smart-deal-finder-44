import { Check, Crown, Building2, Briefcase, User, ArrowLeft, Home } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const tierIcons = {
  free: User,
  emprendedor: Briefcase,
  negocio: Building2,
  empresa: Crown,
};

const tierColors = {
  free: "bg-muted",
  emprendedor: "bg-blue-500",
  negocio: "bg-purple-500",
  empresa: "bg-amber-500",
};

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    plans, 
    currentPlan, 
    productCount, 
    productLimit, 
    remainingProducts,
    isLoading 
  } = useSubscription();

  const formatPrice = (price: number) => {
    if (price === 0) return "Gratis";
    return `$${(price / 100).toLocaleString("es-AR")}/mes`;
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return "Ilimitados";
    return `${limit} productos`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/")}
            className="text-primary-foreground hover:bg-primary-foreground/20 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Planes de Suscripción</h1>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Elige el plan que mejor se adapte a tu negocio. Publica tus productos 
              y gana visibilidad en nuestra plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* Estado actual del usuario */}
      {user && (
        <div className="max-w-6xl mx-auto px-4 -mt-6">
          <Card className="bg-card border-2 border-primary/20">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tu plan actual</p>
                  <p className="font-semibold text-lg">{currentPlan?.name || "Gratuito"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Productos publicados</p>
                  <p className="font-semibold text-lg">
                    {productCount} / {productLimit === -1 ? "∞" : productLimit}
                    {remainingProducts !== Infinity && remainingProducts <= 2 && remainingProducts > 0 && (
                      <span className="text-amber-500 ml-2 text-sm">
                        ({remainingProducts} restantes)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Planes */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const Icon = tierIcons[plan.tier];
            const isCurrentPlan = currentPlan?.tier === plan.tier;
            const isPopular = plan.tier === "negocio";

            return (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col ${isCurrentPlan ? "border-2 border-primary" : ""} ${isPopular ? "ring-2 ring-primary" : ""}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Más Popular
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 right-4 bg-green-500">
                    Plan Actual
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-2">
                  <div className={`w-12 h-12 rounded-full ${tierColors[plan.tier]} flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-3xl font-bold">{formatPrice(plan.price_monthly)}</span>
                  </div>

                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{formatLimit(plan.max_products)}</span>
                    </li>
                    {plan.featured_visibility && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">Visibilidad destacada</span>
                      </li>
                    )}
                    {plan.priority_in_search > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">Prioridad en búsquedas</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Soporte por email</span>
                    </li>
                    {plan.tier !== "free" && (
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">Badge de comercio verificado</span>
                      </li>
                    )}
                  </ul>
                </CardContent>

                <CardFooter>
                  {!user ? (
                    <Button 
                      className="w-full" 
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => navigate("/auth")}
                    >
                      Crear cuenta
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plan actual
                    </Button>
                  ) : plan.tier === "free" ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plan base
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant={isPopular ? "default" : "outline"}
                      disabled
                    >
                      Próximamente
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Info adicional */}
        <div className="mt-12 text-center">
          <h2 className="text-xl font-semibold mb-4">¿Por qué suscribirse?</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2">Mayor visibilidad</h3>
              <p className="text-sm text-muted-foreground">
                Tus productos aparecerán primero en las búsquedas de los usuarios.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2">Más productos</h3>
              <p className="text-sm text-muted-foreground">
                Publica más productos y llega a más clientes potenciales.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2">Credibilidad</h3>
              <p className="text-sm text-muted-foreground">
                Obtén un badge de comercio verificado que genera confianza.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
