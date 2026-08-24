import React from "react";
import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({ label, icon, rightElement, className = "", secureTextEntry, autoCapitalize, ...props }: InputProps) {
  const { isDark } = useTheme();
  return (
    <View className="flex flex-col gap-1.5">
      {label && <Text className="text-sm font-medium text-foreground">{label}</Text>}
      <View className="relative flex-row items-center bg-input-background border border-border rounded-xl min-h-[48px]">
        {icon && <View className="absolute left-3 z-10">{icon}</View>}
        <TextInput
          placeholderTextColor={isDark ? "#A3A3AA" : "#6E776F"}
          secureTextEntry={secureTextEntry}
          // Default TextInput android/iOS = "sentences" (huruf pertama
          // otomatis kapital) - SALAH utk kolom password (rata2 orang bikin
          // password tanpa kapital), ketik "yai" jadi "Yai" di layar tanpa
          // sadar. Password field OTOMATIS "none" kalau caller tidak
          // eksplisit override - berlaku utk SEMUA kolom password di app
          // (Login, Ubah Password, dst) sekaligus dari 1 tempat.
          autoCapitalize={autoCapitalize ?? (secureTextEntry ? "none" : undefined)}
          className={`flex-1 text-foreground px-4 py-3 ${icon ? "pl-10" : ""} ${rightElement ? "pr-12" : ""} ${className}`}
          {...props}
        />
        {rightElement && <View className="absolute right-3 z-10">{rightElement}</View>}
      </View>
    </View>
  );
}
