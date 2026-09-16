import React from "react";
import { View, Text } from "react-native";

type BadgeVariant = "success" | "error" | "warning" | "info" | "muted" | "primary";

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-green-100 dark:bg-green-900/20",
  error: "bg-red-100 dark:bg-red-900/20",
  warning: "bg-amber-100 dark:bg-amber-900/20",
  info: "bg-emerald-100 dark:bg-emerald-900/20",
  muted: "bg-gray-100 dark:bg-gray-800",
  primary: "bg-emerald-100 dark:bg-emerald-900/20",
};
const variantText: Record<BadgeVariant, string> = {
  success: "text-green-700 dark:text-green-400",
  error: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  info: "text-emerald-800 dark:text-emerald-400",
  muted: "text-gray-600 dark:text-gray-300",
  primary: "text-emerald-800 dark:text-emerald-400",
};

export function Badge({ variant, children, className = "" }: { variant: BadgeVariant; children: React.ReactNode; className?: string }) {
  return (
    <View className={`px-2 py-0.5 rounded-full ${variantStyles[variant]} ${className}`}>
      <Text className={`text-xs font-medium ${variantText[variant]}`}>{children}</Text>
    </View>
  );
}
