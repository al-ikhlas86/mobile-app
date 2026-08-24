import React from "react";
import { View, Text } from "react-native";

type BadgeVariant = "success" | "error" | "warning" | "info" | "muted" | "primary";

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-green-100",
  error: "bg-red-100",
  warning: "bg-amber-100",
  info: "bg-emerald-100",
  muted: "bg-gray-100",
  primary: "bg-emerald-100",
};
const variantText: Record<BadgeVariant, string> = {
  success: "text-green-700",
  error: "text-red-700",
  warning: "text-amber-700",
  info: "text-emerald-800",
  muted: "text-gray-600",
  primary: "text-emerald-800",
};

export function Badge({ variant, children, className = "" }: { variant: BadgeVariant; children: React.ReactNode; className?: string }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${variantStyles[variant]} ${className}`}>
      <Text className={`text-xs font-medium ${variantText[variant]}`}>{children}</Text>
    </View>
  );
}
