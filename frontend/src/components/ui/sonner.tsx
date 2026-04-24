import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "oklch(0.16 0.025 255)",
          "--normal-border": "oklch(1 0 0 / 0.08)",
          "--normal-text": "oklch(0.92 0.008 65)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
