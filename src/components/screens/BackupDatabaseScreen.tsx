import React, { useState } from "react";
import { View, Text } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { DatabaseBackup, Download } from "lucide-react-native";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { API_URL } from "../../services/api";
import { getActiveToken } from "../../services/authService";

// Download backup database - di native tidak ada elemen <a download> spt
// web, jadi file diunduh ke storage sementara app (expo-file-system) lalu
// dibuka dialog "Simpan/Bagikan ke..." (expo-sharing) supaya user bisa
// pilih taruh di mana (Files, Drive, dst).
export function BackupDatabaseScreen() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const token = getActiveToken();
      const dest = FileSystem.cacheDirectory + `backup_mobileapp_${Date.now()}.sql`;
      const result = await FileSystem.downloadAsync(`${API_URL}/api/admin/backup`, dest, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (result.status !== 200) throw new Error("Gagal membuat backup.");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: "application/sql", dialogTitle: "Simpan Backup Database" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat backup.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex-1 bg-background px-4 pt-5 gap-5">
      <Text className="text-xs text-muted-foreground">
        Tombol ini membuat salinan LENGKAP database aplikasi ini (akun, notifikasi, cache data siswa/pegawai, dst) dan
        mengunduhnya. Ini melengkapi, bukan menggantikan, backup otomatis yang berjalan di server - simpan file yang
        diunduh di tempat lain (Google Drive, dst) secara berkala.
      </Text>
      {error ? <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><Text className="text-sm text-red-600">{error}</Text></View> : null}
      <Card padding="lg">
        <View className="items-center py-4">
          <DatabaseBackup size={40} color="#6E776F" />
          <Text className="text-xs text-muted-foreground mb-4 mt-3 text-center">File berformat .sql, bisa dipulihkan kapan saja lewat mysql -u root nama_db {"<"} file.sql.</Text>
          <Button onPress={handleDownload} loading={downloading} fullWidth>
            <Download size={16} color="#fff" />{"  "}{downloading ? "Membuat backup..." : "Download Backup Sekarang"}
          </Button>
        </View>
      </Card>
    </View>
  );
}
