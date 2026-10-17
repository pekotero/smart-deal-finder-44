import { useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  const { signIn, signUp } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        await signUp(formData.email, formData.password, formData.fullName);
      }
      onClose();
      setFormData({ email: "", password: "", fullName: "" });
    } catch (error) {
      // Error is handled in useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-card-hover overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="gradient-hero p-6 pb-12">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="text-center text-primary-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary-foreground/20 mx-auto flex items-center justify-center mb-4">
              <span className="text-3xl font-bold">$</span>
            </div>
            <h2 className="text-2xl font-bold">
              {isLogin ? "¡Bienvenido!" : "Crear cuenta"}
            </h2>
            <p className="text-primary-foreground/80 mt-1">
              {isLogin
                ? "Ingresa para comparar y ahorrar"
                : "Únete y empieza a ahorrar"}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 -mt-6 bg-card rounded-t-3xl relative">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border-2 border-transparent focus:border-primary focus:bg-card outline-none transition-all"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border-2 border-transparent focus:border-primary focus:bg-card outline-none transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full h-12 pl-12 pr-12 rounded-xl bg-secondary border-2 border-transparent focus:border-primary focus:bg-card outline-none transition-all"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              variant="action"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                "Iniciar sesión"
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-semibold hover:underline"
            >
              {isLogin ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
