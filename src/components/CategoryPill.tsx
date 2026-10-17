import {
  Sparkles,
  ShoppingCart,
  Smartphone,
  Shirt,
  Home as HomeIcon,
  Heart as HeartIcon,
  Package,
} from "lucide-react";

interface CategoryPillProps {
  icon: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, any> = {
  sparkles: Sparkles,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  shirt: Shirt,
  home: HomeIcon,
  heart: HeartIcon,
  package: Package,
};

const CategoryPill = ({ icon, label, isActive, onClick }: CategoryPillProps) => {
  const Icon = iconMap[icon] || Package;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
        isActive
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-card text-foreground border border-border hover:border-primary hover:text-primary"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

export default CategoryPill;
