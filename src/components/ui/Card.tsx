import React from "react";
import { View, Pressable } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  padding?: "sm" | "md" | "lg" | "none";
}

const paddingMap = { none: "", sm: "p-3", md: "p-4", lg: "p-5" };

// Bayangan lembut hanya di mode terang (di latar gelap tidak terlihat); sama dengan versi web (src/styles/theme.css).
const BAYANGAN_TERANG = { boxShadow: "0 1px 2px rgba(23,32,27,0.10), 0 3px 10px rgba(23,32,27,0.08)" } as const;

export function Card({ children, className = "", onPress, padding = "md" }: CardProps) {
  const { isDark } = useTheme();
  const style = isDark ? undefined : BAYANGAN_TERANG;
  const classes = `bg-card rounded-2xl border border-border ${paddingMap[padding]} ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={style} className={`${classes} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return <View style={style} className={classes}>{children}</View>;
}
