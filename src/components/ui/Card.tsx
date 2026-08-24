import React from "react";
import { View, Pressable } from "react-native";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  padding?: "sm" | "md" | "lg" | "none";
}

const paddingMap = { none: "", sm: "p-3", md: "p-4", lg: "p-5" };

export function Card({ children, className = "", onPress, padding = "md" }: CardProps) {
  const classes = `bg-card rounded-2xl border border-border ${paddingMap[padding]} ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${classes} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return <View className={classes}>{children}</View>;
}
