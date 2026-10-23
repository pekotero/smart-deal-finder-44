import { Button } from "@/components/ui/button";

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CATEGORIES = [
  "Todas",
  "Almacén",
  "Lácteos",
  "Bebidas",
  "Limpieza",
  "Perfumería",
  "Frescos",
];

const CategoryFilter = ({
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORIES.map((category) => {
        const isSelected = selectedCategory === category;
        return (
          <Button
            key={category}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectCategory(category)}
            className={`rounded-full text-xs font-medium transition-all ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {category}
          </Button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;