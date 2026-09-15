// ============================================================
// BERITA ACARA VIEWER — port native dari webview. Embed iframe YouTube/
// Instagram/Facebook (webview punya ini) DISEDERHANAKAN jadi buka link
// eksternal via Linking - RN tidak punya iframe, dan react-native-webview
// utk tiap link jadi berat/tidak konsisten dgn keamanan platform. Semua
// fungsi INTI (baca, galeri foto+lightbox, like, komentar+balas+hapus+
// blokir) tetap 100% ada.
// ============================================================
import React, { useState, useEffect } from "react";
import { View, Text, Image, Pressable, ScrollView, TextInput, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Calendar, User, ImageIcon, Tag, Link2, X, Heart, MessageCircle, Send, Ban } from "lucide-react-native";
import { api, resolveAvatarUrl } from "../../services/api";
import { getActiveSession } from "../../services/authService";
import { useThemeColors } from "../../context/ThemeContext";
import { useImageReloadGeneration } from "../../services/networkService";

interface Media { id: number; media_type: "thumbnail" | "activity"; url: string; }
interface LinkItem { id: number; url: string; thumbnail_url: string | null; }
interface BeritaDetail {
  id: number; title: string; category: string | null; description: string | null; author_name: string | null;
  activity_date: string | null; approved_at: string | null; created_by_name: string; media: Media[]; links: LinkItem[];
  likes_count: number; liked_by_me: boolean; blocked_from_commenting: boolean;
}
interface CommentItem {
  id: number; comment: string; parent_comment_id: number | null; created_at: string; user_id: number; full_name: string; avatar_url: string | null;
  likes_count: number; liked_by_me: boolean; is_edited: boolean;
}

// admin_media_sd/tk DIGABUNG jadi generik (2026-09-14, Sistem Katalog) -
// nama lama TETAP dicek (pola "legacy names") jaga2 sesi lama.
const CAN_MODERATE_ROLES = ["Admin IT", "Supervisor", "Admin Media", "Admin Media (SD)", "Admin Media (TK & Playground)"];
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); }

// Aksi "Ubah/Hapus" SEBELUMNYA berupa ikon tong sampah yang SELALU tampil di
// samping tiap komentar - user minta jangan langsung siap-pakai spt itu,
// harus tap komentarnya dulu baru opsi itu muncul (mencegah kehapus tanpa
// sengaja). "Balas"/"Suka" tetap selalu tampil (bukan aksi merusak).
function CommentRow({ comment, canModerate, isMine, onReply, onLike, onDelete, onBlock, onEdit }: {
  comment: CommentItem; canModerate: boolean; isMine: boolean;
  onReply: () => void; onLike: () => void; onDelete: () => void; onBlock: () => void; onEdit: (newText: string) => void;
}) {
  const colors = useThemeColors();
  const avatar = resolveAvatarUrl(comment.avatar_url);
  // Reload gambar otomatis begitu online kembali (2026-09-05, W4E).
  const reloadGen = useImageReloadGeneration();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.comment);

  if (editing) {
    return (
      <View className="flex-row items-start gap-2">
        <View className="w-7 h-7 rounded-full bg-secondary items-center justify-center overflow-hidden">
          {avatar ? <Image key={reloadGen} source={{ uri: avatar }} className="w-full h-full" /> : <Text className="text-[10px] font-bold text-foreground">{initials(comment.full_name)}</Text>}
        </View>
        <View className="flex-1 gap-1.5">
          <TextInput value={draft} onChangeText={setDraft} multiline className="bg-input-background border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
          <View className="flex-row gap-3">
            <Pressable onPress={() => { setEditing(false); setDraft(comment.comment); }}><Text className="text-xs text-muted-foreground">Batal</Text></Pressable>
            <Pressable onPress={() => { if (draft.trim()) { onEdit(draft.trim()); setEditing(false); } }}><Text className="text-xs text-primary font-semibold">Simpan</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-start gap-2">
      <View className="w-7 h-7 rounded-full bg-secondary items-center justify-center overflow-hidden">
        {avatar ? <Image key={reloadGen} source={{ uri: avatar }} className="w-full h-full" /> : <Text className="text-[10px] font-bold text-foreground">{initials(comment.full_name)}</Text>}
      </View>
      <Pressable onPress={() => setExpanded((v) => !v)} className="flex-1 bg-muted rounded-xl px-3 py-2">
        <Text className="text-xs font-semibold text-foreground">{comment.full_name}</Text>
        <Text className="text-sm text-foreground">{comment.comment}</Text>
        {comment.is_edited && <Text className="text-[10px] text-muted-foreground mt-0.5">(diubah)</Text>}
        <View className="flex-row items-center gap-3 mt-1.5">
          <Pressable onPress={onReply}><Text className="text-xs text-primary font-medium">Balas</Text></Pressable>
          <Pressable onPress={onLike} className="flex-row items-center gap-1">
            <Heart size={12} color={comment.liked_by_me ? "#ef4444" : colors.mutedForeground} fill={comment.liked_by_me ? "#ef4444" : "none"} />
            {comment.likes_count > 0 && <Text className="text-xs text-muted-foreground">{comment.likes_count}</Text>}
          </Pressable>
        </View>
        {expanded && (
          <View className="flex-row items-center gap-3 mt-2 pt-2 border-t border-border/60">
            {isMine && <Pressable onPress={() => setEditing(true)}><Text className="text-xs text-foreground font-medium">Ubah</Text></Pressable>}
            {(isMine || canModerate) && <Pressable onPress={onDelete}><Text className="text-xs text-red-500 font-medium">Hapus</Text></Pressable>}
            {canModerate && !isMine && <Pressable onPress={onBlock}><Text className="text-xs text-muted-foreground">Blokir</Text></Pressable>}
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function BeritaAcaraViewer({ newsId, onNavigate }: { newsId?: string; onNavigate: (screen: string, params?: Record<string, unknown>) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [post, setPost] = useState<BeritaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; full_name: string } | null>(null);
  const [moderationMessage, setModerationMessage] = useState("");
  const session = getActiveSession();
  const myUserId = Number(session?.accountId.replace("USR", ""));
  const canModerate = session ? CAN_MODERATE_ROLES.includes(session.role) : false;
  // Reload gambar otomatis begitu online kembali (2026-09-05, W4E) - lihat
  // catatan lengkap di services/networkService.ts.
  const reloadGen = useImageReloadGeneration();

  // reloadGen ikut dependency (2026-09-05, susulan W4E) - auto-retry
  // begitu TERDETEKSI online kembali, sama alasan dgn BeritaAcaraScreen.tsx
  // (koneksi terputus PAS layar ini fetch, jangan nyangkut di pesan error).
  useEffect(() => {
    if (!newsId) { setError("Berita tidak ditemukan."); setLoading(false); return; }
    (async () => {
      setLoading(true);
      setError("");
      const res = await api.beritaAcaraDetail(Number(newsId));
      if (res.success) {
        setPost(res.data);
        const commentsRes = await api.beritaAcaraComments(Number(newsId));
        if (commentsRes.success) setComments(commentsRes.data);
      } else setError(res.message ?? "Berita tidak ditemukan.");
      setLoading(false);
    })();
  }, [newsId, reloadGen]);

  async function handleToggleLike() {
    if (!post || likeBusy) return;
    setLikeBusy(true);
    const res = await api.beritaAcaraToggleLike(post.id);
    setLikeBusy(false);
    if (res.success) setPost({ ...post, liked_by_me: res.data.liked, likes_count: res.data.likes_count });
  }
  async function handleAddComment() {
    if (!post || !newComment.trim()) return;
    setCommentSaving(true);
    const res = await api.beritaAcaraAddComment(post.id, newComment.trim(), replyingTo?.id);
    setCommentSaving(false);
    if (res.success) { setComments((prev) => [...prev, res.data]); setNewComment(""); setReplyingTo(null); }
  }
  async function handleDeleteComment(commentId: number) {
    if (!post) return;
    const res = await api.beritaAcaraDeleteComment(post.id, commentId);
    if (res.success) setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
  }
  async function handleEditComment(commentId: number, newText: string) {
    if (!post) return;
    const res = await api.beritaAcaraEditComment(post.id, commentId, newText);
    if (res.success) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, comment: newText, is_edited: true } : c)));
    }
  }
  async function handleLikeComment(commentId: number) {
    if (!post) return;
    const res = await api.beritaAcaraToggleCommentLike(post.id, commentId);
    if (res.success) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, liked_by_me: res.data.liked, likes_count: res.data.likes_count } : c)));
    }
  }
  async function handleBlockCommenter(commentId: number) {
    if (!post) return;
    const res = await api.beritaAcaraBlockCommenter(post.id, commentId);
    setModerationMessage(res.message ?? (res.success ? "Berhasil." : "Gagal memblokir."));
    setTimeout(() => setModerationMessage(""), 4000);
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={colors.primary} /></View>;
  if (!post) {
    return (
      <View className="flex-1 items-center justify-center bg-background gap-3 px-8">
        <Text className="text-muted-foreground text-center">{error || "Berita tidak ditemukan."}</Text>
        <Pressable onPress={() => onNavigate("berita-acara")}><Text className="text-primary text-sm font-medium">← Kembali</Text></Pressable>
      </View>
    );
  }

  const thumbnail = post.media.find((m) => m.media_type === "thumbnail");
  const activityImages = post.media.filter((m) => m.media_type === "activity");

  return (
    <>
    <KeyboardAwareScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 + insets.bottom }} bottomOffset={20}>
      {thumbnail ? (
        <Pressable onPress={() => setLightbox(resolveAvatarUrl(thumbnail.url))}>
          <Image key={reloadGen} source={{ uri: resolveAvatarUrl(thumbnail.url) ?? undefined }} className="w-full h-52" resizeMode="cover" />
        </Pressable>
      ) : (
        <View className="w-full h-40 bg-primary/10 items-center justify-center"><ImageIcon size={40} color={colors.primary} /></View>
      )}

      <View className="px-4 py-5 gap-4">
        {post.category ? (
          <View className="self-start flex-row items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-full">
            <Tag size={10} color={colors.primary} /><Text className="text-xs text-primary font-medium">{post.category}</Text>
          </View>
        ) : null}

        <Text className="text-xl font-bold text-foreground">{post.title}</Text>

        <View className="gap-1.5">
          {(post.approved_at || post.activity_date) && (
            <View className="flex-row items-center gap-1.5"><Calendar size={13} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">{formatDate(post.approved_at ?? post.activity_date!)}</Text></View>
          )}
          <View className="flex-row items-center gap-1.5"><User size={13} color={colors.mutedForeground} /><Text className="text-xs text-muted-foreground">{post.author_name || post.created_by_name}</Text></View>
        </View>

        {post.description ? <Text className="text-sm text-foreground leading-relaxed">{post.description}</Text> : null}

        {post.links.length > 0 && (
          <View className="gap-2">
            {post.links.map((link) => (
              <Pressable key={link.id} onPress={() => Linking.openURL(link.url)} className="flex-row items-center gap-1.5">
                <Link2 size={15} color={colors.primary} />
                <Text numberOfLines={1} className="text-sm text-primary flex-1">{link.url}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {activityImages.length > 0 && (
          <View className="gap-3 mt-2">
            <View className="flex-row items-center gap-1.5"><ImageIcon size={14} color={colors.foreground} /><Text className="text-sm font-semibold text-foreground">Foto Kegiatan</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {activityImages.map((img) => (
                <Pressable key={img.id} onPress={() => setLightbox(resolveAvatarUrl(img.url))} className="mr-2">
                  <Image key={reloadGen} source={{ uri: resolveAvatarUrl(img.url) ?? undefined }} className="w-40 h-40 rounded-xl" resizeMode="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="flex-row items-center gap-4 pt-3 border-t border-border">
          <Pressable onPress={handleToggleLike} disabled={likeBusy} className="flex-row items-center gap-1.5">
            <Heart size={18} color={post.liked_by_me ? "#ef4444" : colors.mutedForeground} fill={post.liked_by_me ? "#ef4444" : "none"} />
            <Text className={`text-sm font-medium ${post.liked_by_me ? "text-red-500" : "text-muted-foreground"}`}>{post.likes_count}</Text>
          </Pressable>
          <View className="flex-row items-center gap-1.5"><MessageCircle size={18} color={colors.mutedForeground} /><Text className="text-sm text-muted-foreground">{comments.length}</Text></View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-semibold text-foreground">Komentar</Text>
          {moderationMessage ? <Text className="text-xs text-center text-primary bg-primary/10 rounded-lg py-2">{moderationMessage}</Text> : null}
          {replyingTo && (
            <View className="flex-row items-center justify-between bg-muted rounded-lg px-3 py-1.5">
              <Text className="text-xs text-muted-foreground">Membalas <Text className="font-semibold text-foreground">{replyingTo.full_name}</Text></Text>
              <Pressable onPress={() => setReplyingTo(null)}><X size={13} color={colors.mutedForeground} /></Pressable>
            </View>
          )}
          {post.blocked_from_commenting ? (
            <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Ban size={16} color="#ef4444" />
              <Text className="text-xs text-red-600 flex-1">Admin memblokir Anda untuk berkomentar.</Text>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <TextInput
                value={newComment}
                onChangeText={setNewComment}
                placeholder={replyingTo ? `Balas ${replyingTo.full_name}...` : "Tulis komentar..."}
                className="flex-1 bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground"
              />
              <Pressable onPress={handleAddComment} disabled={commentSaving || !newComment.trim()} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
                <Send size={16} color={colors.primaryForeground} />
              </Pressable>
            </View>
          )}
          {comments.length === 0 ? (
            <Text className="text-xs text-muted-foreground text-center py-3">Belum ada komentar.</Text>
          ) : (
            <View className="gap-3">
              {comments.filter((c) => !c.parent_comment_id).map((c) => (
                <View key={c.id} className="gap-2">
                  <CommentRow
                    comment={c} canModerate={canModerate} isMine={c.user_id === myUserId}
                    onReply={() => setReplyingTo({ id: c.id, full_name: c.full_name })}
                    onLike={() => handleLikeComment(c.id)}
                    onDelete={() => handleDeleteComment(c.id)}
                    onBlock={() => handleBlockCommenter(c.id)}
                    onEdit={(text) => handleEditComment(c.id, text)}
                  />
                  {comments.filter((r) => r.parent_comment_id === c.id).map((r) => (
                    <View key={r.id} className="ml-6">
                      <CommentRow
                        comment={r} canModerate={canModerate} isMine={r.user_id === myUserId}
                        onReply={() => setReplyingTo({ id: c.id, full_name: c.full_name })}
                        onLike={() => handleLikeComment(r.id)}
                        onDelete={() => handleDeleteComment(r.id)}
                        onBlock={() => handleBlockCommenter(r.id)}
                        onEdit={(text) => handleEditComment(r.id, text)}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

    </KeyboardAwareScrollView>
    {/* SENGAJA overlay biasa di tree yang sama, BUKAN <Modal> - lihat
        catatan panjang di AccountSwitcher.tsx (window Modal Android
        bikin nav bar HP tidak konsisten). */}
    {!!lightbox && (
      <Pressable className="absolute inset-0 bg-black/90 items-center justify-center p-4" style={{ zIndex: 50, elevation: 50 }} onPress={() => setLightbox(null)}>
        <Pressable className="absolute top-10 right-4" onPress={() => setLightbox(null)}><X size={28} color="#fff" /></Pressable>
        <Image key={reloadGen} source={{ uri: lightbox }} className="w-full h-2/3" resizeMode="contain" />
      </Pressable>
    )}
    </>
  );
}
