import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Phone, KeyRound, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { requestOtp, checkOtp, verifyOtp } from "../../services/api";
import type { SavedAccount } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";

interface Props {
  initialPhone?: string;
  lockPhone?: boolean;
  title?: string;
  onSuccess: (account: SavedAccount) => void;
  onCancel: () => void;
}

// Halaman 1 ("otp"): nomor HP + tombol Kirim OTP + kolom Kode OTP, SEMUANYA tampil sejak awal. Halaman 2 ("password"): kata sandi baru.
type Step = "otp" | "password";
const RESEND_COOLDOWN_SECONDS = 60;

export function OtpPasswordScreen({ initialPhone = "", lockPhone = false, title = "Atur Kata Sandi", onSuccess, onCancel }: Props) {
  const colors = useThemeColors();
  const [step, setStep] = useState<Step>("otp");
  const [sent, setSent] = useState(false);
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
      setSent(true);
      setInfo("Kode OTP telah dikirim lewat WhatsApp. Ketik kode di kolom bawah.");
      startCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      // Pengiriman bisa gagal/lambat di sisi WhatsApp padahal kodenya sudah masuk: kolom kode tetap terbuka dan diberi petunjuk.
      const gagalKirim = /mengirim OTP|Timeout/i.test(result.error ?? "");
      setError(gagalKirim ? `${result.error} Jika kode sudah masuk di WhatsApp Anda, tetap ketik di kolom Kode OTP di bawah.` : (result.error ?? "Gagal mengirim kode OTP."));
      if (result.waitSeconds) startCooldown(result.waitSeconds);
      else if (gagalKirim) startCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  useEffect(() => {
    if (initialPhone && lockPhone && !autoSentRef.current) {
      autoSentRef.current = true;
      handleSendOtp(initialPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhone, lockPhone]);

  const handleLanjut = async () => {
    if (!phone.trim()) { setError("Masukkan nomor HP Anda."); return; }
    if (!code.trim()) { setError("Masukkan kode OTP yang dikirim ke WhatsApp Anda."); return; }
    setError(""); setInfo(""); setLoading(true);
    const result = await checkOtp(phone.trim(), code.trim());
    setLoading(false);
    if (result.success) setStep("password");
    else setError(result.error ?? "Kode OTP salah.");
  };

  const handleVerify = async () => {
    if (!newPassword || !confirmPassword) { setError("Lengkapi semua kolom."); return; }
    if (newPassword.length < 6) { setError("Kata sandi baru minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { setError("Konfirmasi kata sandi tidak cocok."); return; }
    setError(""); setLoading(true);
    const result = await verifyOtp(phone.trim(), code.trim(), newPassword);
    setLoading(false);
    if (result.success && result.account) onSuccess(result.account);
    else {
      const pesan = result.error ?? "Verifikasi OTP gagal.";
      setError(pesan);
      // Kode kedaluwarsa/hangus di tengah jalan: kembali ke halaman 1 untuk minta kode baru.
      if (/OTP|kode/i.test(pesan)) { setStep("otp"); setCode(""); }
    }
  };

  return (
    <KeyboardAwareScrollView className="flex-1 bg-background px-6 pt-14" contentContainerStyle={{ paddingBottom: 40 }} bottomOffset={20}>
        <Pressable onPress={onCancel} className="flex-row items-center gap-1.5 mb-4 -ml-1">
          <ArrowLeft size={16} color={colors.mutedForeground} />
          <Text className="text-sm text-muted-foreground">Kembali</Text>
        </Pressable>

        <Text className="text-lg font-bold text-foreground mb-1">{resolvedTitle ?? title}</Text>
        <Text className="text-sm text-muted-foreground mb-6">
          {step === "otp"
            ? "Masukkan nomor HP yang terdaftar di data sekolah, tekan Kirim Kode OTP, lalu ketik kode yang masuk ke WhatsApp Anda."
            : "Kode OTP benar. Buat kata sandi baru Anda."}
        </Text>

        <View className="flex flex-col gap-4">
          {step === "otp" && (
            <>
              <Input
                label="Nomor HP"
                placeholder="08xxxxxxxxxx"
                keyboardType="phone-pad"
                value={phone}
                editable={!lockPhone}
                onChangeText={setPhone}
                icon={<Phone size={18} color={colors.mutedForeground} />}
              />
              <Button onPress={() => handleSendOtp()} loading={loading && !code} disabled={cooldown > 0 || loading} variant={sent ? "outline" : "primary"} fullWidth size="lg">
                {loading && !code ? "Mengirim..." : cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : sent ? "Kirim Ulang Kode OTP" : "Kirim Kode OTP"}
              </Button>

              <Input
                label="Kode OTP"
                placeholder="6 digit kode dari WhatsApp"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                value={code}
                onChangeText={setCode}
                icon={<KeyRound size={18} color={colors.mutedForeground} />}
              />

              {info && !error ? <Text className="text-sm text-green-600 dark:text-green-400">{info}</Text> : null}
              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

              <Button onPress={handleLanjut} loading={loading && !!code} fullWidth size="lg">
                {loading && !!code ? "Memeriksa..." : "Lanjut"}
              </Button>
            </>
          )}

          {step === "password" && (
            <>
              <Text className="text-xs text-muted-foreground -mt-2">Nomor: {phone}</Text>
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

              {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

              <Button onPress={handleVerify} loading={loading} fullWidth size="lg">
                {loading ? "Memproses..." : "Simpan Kata Sandi"}
              </Button>

              <Pressable disabled={loading} onPress={() => { setStep("otp"); setError(""); }} className="items-center">
                <Text className="text-sm font-medium text-primary">Ubah nomor / kode OTP</Text>
              </Pressable>
            </>
          )}
        </View>
    </KeyboardAwareScrollView>
  );
}
