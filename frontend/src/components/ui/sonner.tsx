import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "#18181b",
          "--normal-border": "#1c1c1f",
          "--normal-text": "#f4f3ef",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
