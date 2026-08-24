import React, { useState } from "react";
import { View, Text, Pressable, Image } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { User, Lock, Eye, EyeOff, Sun, Moon } from "lucide-react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { OtpPasswordScreen } from "./OtpPasswordScreen";
import { apiLogin } from "../../services/api";
import type { RoleName, SavedAccount } from "../../services/authService";
import { useTheme } from "../../context/ThemeContext";

interface LoginScreenProps {
  onLogin: (role: RoleName, fullName: string, avatarInitials: string, accountId: string) => void;
  notice?: string;
}

export function LoginScreen({ onLogin, notice }: LoginScreenProps) {
  const { isDark, toggleTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpMode, setOtpMode] = useState<{ phone: string; title: string; lockPhone: boolean } | null>(null);

  const applyAccount = (account: SavedAccount) => {
    onLogin(account.role, account.fullName, account.avatarInitials, account.id);
  };

  const handleLogin = async () => {
    if (!username || !password) { setError("Harap isi username dan kata sandi."); return; }
    setError(""); setLoading(true);
    const result = await apiLogin(username.trim(), password);
    setLoading(false);
    if (result.success && result.account) applyAccount(result.account);
    else if (result.needsPasswordSetup) setOtpMode({ phone: username.trim(), title: "Atur Kata Sandi Pertama Kali", lockPhone: true });
    else setError(result.error ?? "Login gagal.");
  };

  if (otpMode) {
    return (
      <OtpPasswordScreen
        initialPhone={otpMode.phone}
        lockPhone={otpMode.lockPhone}
        title={otpMode.title}
        onSuccess={applyAccount}
        onCancel={() => setOtpMode(null)}
      />
    );
  }

  return (
    <View className="flex-1 bg-card">
      <Pressable
        onPress={toggleTheme}
        className="absolute top-14 right-4 z-30 p-2.5 rounded-xl border border-border bg-card/90"
      >
        {isDark ? <Sun size={18} color="#D0AF68" /> : <Moon size={18} color="#17201B" />}
      </Pressable>

      <View className="h-[30%] min-h-[200px] max-h-[260px]">
        <Image
          source={require("../../../assets/hero.webp")}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />
        <View className="absolute inset-0 bg-black/35" />
        <View className="flex-1 justify-end p-5 pb-8">
          <Text className="text-white text-2xl font-bold">Al-Ikhlas 86</Text>
          <Text className="text-white/80 text-sm mt-1">Layanan Digital Sekolah</Text>
        </View>
      </View>

      <KeyboardAwareScrollView className="flex-1 px-6 pt-8" contentContainerStyle={{ paddingBottom: 32 }} bottomOffset={20}>
          <Text className="text-xl font-bold text-foreground mb-1">Masuk</Text>
          <Text className="text-sm text-muted-foreground mb-6">Gunakan akun yang terdaftar di data sekolah.</Text>

          {notice ? (
            <View className="bg-accent rounded-xl p-3 mb-4">
              <Text className="text-sm text-accent-foreground">{notice}</Text>
            </View>
          ) : null}

          <View className="flex flex-col gap-4">
            <Input
              label="Username / No. HP"
              placeholder="Username atau nomor HP"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              icon={<User size={18} color="#6E776F" />}
            />
            <Input
              label="Kata Sandi"
              placeholder="Kata sandi"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              icon={<Lock size={18} color="#6E776F" />}
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} color="#6E776F" /> : <Eye size={18} color="#6E776F" />}
                </Pressable>
              }
            />
            {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

            <Button onPress={handleLogin} loading={loading} fullWidth size="lg">
              {loading ? "Memproses..." : "Masuk"}
            </Button>

            <Pressable
              onPress={() => setOtpMode({ phone: "", title: "Lupa Kata Sandi / Akun Baru", lockPhone: false })}
              className="items-center mt-1"
            >
              <Text className="text-sm text-primary font-medium">Lupa Kata Sandi / Akun Baru</Text>
            </Pressable>
          </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
