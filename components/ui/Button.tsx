import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "success" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-3)]";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]",
  secondary:
    "border border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]",
  success: "bg-[var(--success)] text-[var(--success-fg)] hover:bg-[var(--success-hover)]",
  destructive: "bg-[var(--danger)] text-[var(--danger-fg)] hover:bg-[var(--danger-hover)]",
  ghost: "text-[var(--text-2)] hover:bg-[var(--surface-1)] hover:text-[var(--text-1)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

/** Class string for the button look, usable on non-<button> elements (e.g. an <a> CTA). */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return [base, variantClasses[variant], sizeClasses[size], className].join(" ");
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
});

export default Button;
