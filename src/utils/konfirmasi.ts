import { Alert } from "react-native";

// Padanan window.confirm webview (tidak ada di RN) dalam bentuk Promise<boolean>,
// supaya alur async layar Nilai Raport (terbitkan, tarik ke draf, "belum lengkap
// tetap lanjutkan?") bisa ditulis sama persis dgn versi web: `if (!(await konfirmasi(...))) return;`.
// Menutup dialog di luar tombol (tap area gelap / tombol kembali Android) dihitung "Batal".
export function konfirmasi(judul: string, pesan: string, labelOk = "Lanjutkan"): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      judul,
      pesan,
      [
        { text: "Batal", style: "cancel", onPress: () => resolve(false) },
        { text: labelOk, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
