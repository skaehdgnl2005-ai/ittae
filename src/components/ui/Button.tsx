import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = {
  children: React.ReactNode;
  variant?: Variant;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
};

const variantMap: Record<Variant, string> = {
  primary: "bg-violet-600 text-white h-[52px] text-base font-semibold active:bg-violet-700",
  secondary: "bg-gray-100 text-gray-800 h-12 text-[15px] font-medium active:bg-gray-200",
  ghost: "bg-transparent text-violet-600 h-11 text-sm",
  danger: "bg-red-50 text-red-600 h-12 text-[15px] font-medium active:bg-red-100",
};

export function Button({
  children,
  variant = "primary",
  disabled = false,
  onClick,
  className,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-4 flex items-center justify-center transition-all duration-150 active:scale-[0.97] w-full",
        variantMap[variant],
        disabled && "opacity-40 pointer-events-none",
        className
      )}
    >
      {children}
    </button>
  );
}
