import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Lock, Eye, EyeOff } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { api } from "../../services/api";
import { useThemeColors } from "../../context/ThemeContext";

export function UbahPasswordScreen({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) { setError("Lengkapi semua kolom."); return; }
    if (newPassword.length < 6) { setError("Kata sandi baru minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { setError("Konfirmasi kata sandi tidak cocok."); return; }
    setError(""); setLoading(true);
    const res = await api.changePassword({ old_password: oldPassword, new_password: newPassword });
    setLoading(false);
    if (res.success) setSuccess(true);
    else setError(res.message ?? "Gagal mengubah kata sandi.");
  };

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-6 pt-6" contentContainerStyle={{ paddingBottom: 32 + insets.bottom, gap: 16 }} bottomOffset={20}>
      {success ? (
        <View className="items-center py-10 gap-2">
          <Text className="text-base font-bold text-foreground">Kata Sandi Berhasil Diubah</Text>
          <Button onPress={() => onNavigate("profil")}>Kembali ke Profil</Button>
        </View>
      ) : (
        <>
          <Input label="Kata Sandi Lama" secureTextEntry={!showPassword} value={oldPassword} onChangeText={setOldPassword} icon={<Lock size={18} color={colors.mutedForeground} />} />
          <Input
            label="Kata Sandi Baru"
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            icon={<Lock size={18} color={colors.mutedForeground} />}
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
              </Pressable>
            }
          />
          <Input label="Konfirmasi Kata Sandi Baru" secureTextEntry={!showPassword} value={confirmPassword} onChangeText={setConfirmPassword} icon={<Lock size={18} color={colors.mutedForeground} />} />
          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          <Button onPress={handleSubmit} loading={loading} fullWidth size="lg">{loading ? "Memproses..." : "Simpan"}</Button>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}
