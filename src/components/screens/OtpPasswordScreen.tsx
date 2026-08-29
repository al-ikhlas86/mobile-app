import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Phone, KeyRound, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { requestOtp, verifyOtp } from "../../services/api";
import type { SavedAccount } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  initialPhone?: string;
  lockPhone?: boolean;
  title?: string;
  onSuccess: (account: SavedAccount) => void;
  onCancel: () => void;
}

type Step = "phone" | "otp";
const RESEND_COOLDOWN_SECONDS = 60;

export function OtpPasswordScreen({ initialPhone = "", lockPhone = false, title = "Atur Kata Sandi", onSuccess, onCancel }: Props) {
  const colors = useThemeColors();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resolvedTitle, setResolvedTitle] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const autoSentRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = (seconds: number) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCooldown(Math.max(0, Math.ceil(seconds)));
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); }, []);

  const handleSendOtp = async (phoneToUse = phone) => {
    if (!phoneToUse.trim()) { setError("Masukkan nomor HP Anda."); return; }
    if (cooldown > 0) return;
    setError(""); setInfo(""); setLoading(true);
    const result = await requestOtp(phoneToUse.trim());
    setLoading(false);
    if (result.success) {
      if (result.purpose === "set_password") setResolvedTitle("Aktivasi Akun Baru");
      else if (result.purpose === "reset_password") setResolvedTitle("Lupa Kata Sandi");
      setStep("otp");
      setInfo("Kode OTP telah dikirim lewat WhatsApp ke nomor tersebut.");
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setError(result.error ?? "Gagal mengirim kode OTP.");
      if (result.waitSeconds) startCooldown(result.waitSeconds);
    }
  };

  useEffect(() => {
    if (initialPhone && lockPhone && !autoSentRef.current) {
      autoSentRef.current = true;
      handleSendOtp(initialPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhone, lockPhone]);

  const handleVerify = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) { setError("Lengkapi semua kolom."); return; }
    if (newPassword.length < 6) { setError("Kata sandi baru minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { setError("Konfirmasi kata sandi tidak cocok."); return; }
    setError(""); setLoading(true);
    const result = await verifyOtp(phone.trim(), code.trim(), newPassword);
    setLoading(false);
    if (result.success && result.account) onSuccess(result.account);
    else setError(result.error ?? "Verifikasi OTP gagal.");
  };

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-6 pt-14" contentContainerStyle={{ paddingBottom: 40 }} bottomOffset={20}>
        <Pressable onPress={onCancel} className="flex-row items-center gap-1.5 mb-4 -ml-1">
          <ArrowLeft size={16} color={colors.mutedForeground} />
          <Text className="text-sm text-muted-foreground">Kembali</Text>
        </Pressable>

        <Text className="text-lg font-bold text-foreground mb-1">{resolvedTitle ?? title}</Text>
        <Text className="text-sm text-muted-foreground mb-6">
          {step === "phone"
            ? "Masukkan nomor HP yang terdaftar di data sekolah. Kode OTP akan dikirim lewat WhatsApp."
            : "Masukkan kode OTP yang dikirim ke WhatsApp Anda, lalu buat kata sandi baru."}
        </Text>

        <View className="flex flex-col gap-4">
          {step === "phone" && lockPhone && <Text className="text-sm text-muted-foreground">Mengirim kode OTP...</Text>}
          {step === "phone" && !lockPhone && (
            <>
              <Input
                label="Nomor HP"
                placeholder="08xxxxxxxxxx"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                icon={<Phone size={18} color={colors.mutedForeground} />}
              />
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
              <Button onPress={() => handleSendOtp()} loading={loading} disabled={cooldown > 0} fullWidth size="lg">
                {loading ? "Mengirim..." : cooldown > 0 ? `Tunggu ${cooldown} detik` : "Kirim Kode OTP"}
              </Button>
            </>
          )}

          {step === "otp" && (
            <>
              <Text className="text-xs text-muted-foreground -mt-2">Kode dikirim ke: {phone}</Text>
              <Input
                label="Kode OTP"
                placeholder="6 digit kode"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                icon={<KeyRound size={18} color={colors.mutedForeground} />}
              />
              <Input
                label="Kata Sandi Baru"
                placeholder="Minimal 6 karakter"
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
              <Input
                label="Konfirmasi Kata Sandi"
                placeholder="Ulangi kata sandi baru"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon={<Lock size={18} color={colors.mutedForeground} />}
              />

              {info && !error ? <Text className="text-sm text-green-600">{info}</Text> : null}
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

              <Button onPress={handleVerify} loading={loading} fullWidth size="lg">
                {loading ? "Memproses..." : "Simpan Kata Sandi"}
              </Button>

              <Pressable disabled={loading || cooldown > 0} onPress={() => handleSendOtp()} className="items-center">
                <Text className={`text-sm font-medium ${cooldown > 0 ? "text-muted-foreground" : "text-primary"}`}>
                  {cooldown > 0 ? `Kirim ulang kode dalam ${cooldown} detik` : "Kirim ulang kode OTP"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
    </KeyboardAwareScrollView>
  );
}
