import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import MapView from "./components/MapView";
import NotFound from "./pages/NotFound";
import Promos from "./pages/Promos";
import StoreDetail from "./pages/StoreDetail";
import Cart from "./pages/Cart";
import Alerts from "./pages/Alerts";
import { CartProvider } from "@/hooks/useCart";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/promos" element={<Promos />} />
            <Route path="/store/:id" element={<StoreDetail />} />
            <Route path="/carrito" element={<Cart />} />
            <Route path="/alertas" element={<Alerts />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;