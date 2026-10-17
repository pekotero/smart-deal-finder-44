import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SearchPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  initialQuery?: string;
}

const SearchPopup = ({ open, onOpenChange, onSearch, initialQuery = "" }: SearchPopupProps) => {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      // Focus input when popup opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 bg-card border-border">
        <VisuallyHidden>
          <DialogTitle>Buscar productos</DialogTitle>
        </VisuallyHidden>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="¿Qué producto estás buscando?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-lg bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              autoComplete="off"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="p-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!query.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SearchPopup;
