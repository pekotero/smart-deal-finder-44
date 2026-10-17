import { Home, Search, MapPin, Heart, User } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const tabs = [
    { id: "home", icon: Home, label: "Inicio" },
    { id: "search", icon: Search, label: "Buscar" },
    { id: "map", icon: MapPin, label: "Mapa" },
    { id: "favorites", icon: Heart, label: "Favoritos" },
    { id: "profile", icon: User, label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border sm:hidden">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-all ${
                  isActive ? "bg-primary-light" : ""
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? "scale-110" : ""
                  }`}
                />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
