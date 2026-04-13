import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-gray-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        onClick && "cursor-pointer active:scale-[0.98] active:bg-gray-50 transition-all duration-150",
        className
      )}
    >
      {children}
    </div>
  );
}
