import React from "react";
import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}

const variantBg: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-primary bg-transparent",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
};
const variantText: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-primary",
  ghost: "text-primary",
  destructive: "text-destructive-foreground",
};
const sizeBox: Record<ButtonSize, string> = {
  sm: "px-4 py-2 rounded-full min-h-[36px]",
  md: "px-5 py-3 rounded-full min-h-[44px]",
  lg: "px-6 py-3.5 rounded-full min-h-[52px]",
};
const sizeText: Record<ButtonSize, string> = { sm: "text-sm", md: "text-base", lg: "text-base" };

export function Button({
  variant = "primary", size = "md", children, fullWidth = false, loading = false,
  className = "", disabled, ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 ${variantBg[variant]} ${sizeBox[size]} ${fullWidth ? "w-full" : ""} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color="currentColor" />}
      {/* Bungkus TIAP anak yang berupa string/number mentah (mis. "Simpan",
          atau spasi "  " dipakai bikin jarak ikon-teks) ke <Text> - dulu
          cuma dicek `typeof children === "string"` (children TUNGGAL),
          jadi kalau Button isinya campuran ikon+teks (children jadi ARRAY),
          string mentahnya lolos tanpa dibungkus & bikin app CRASH-warning
          "Text strings must be rendered within a <Text> component" -
          ketahuan dari log Metro, bukan asumsi, dan terjadi di BANYAK layar
          sekaligus (pola ini dipakai luas di seluruh app). */}
      {React.Children.map(children, (child) =>
        typeof child === "string" || typeof child === "number" ? (
          <Text className={`font-semibold ${variantText[variant]} ${sizeText[size]}`}>{child}</Text>
        ) : (
          child
        )
      )}
    </Pressable>
  );
}
