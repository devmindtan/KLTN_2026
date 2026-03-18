/**
 * Documentation — Trang Tài liệu hướng dẫn (wiki-style CMS).
 * Layout 2 cột: nội dung bên trái (flex-1), nav panel bên phải (sticky).
 * Bài viết được chọn qua URL param ?doc=section_key.
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { IconBook } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { useLoading } from "@/contexts/LoadingContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArticleView } from "@/components/help/article-view";
import { ArticleEditor } from "@/components/help/article-editor";
import { ArticleEditBar } from "@/components/help/article-edit-bar";
import { AddArticleModal } from "@/components/help/add-article-modal";
import { HelpSearchBar } from "@/components/help/help-search-bar";
import { DocumentationSidebar } from "@/components/help/documentation-sidebar";
import { BookOpenIcon } from "lucide-react";
import {
  getHelpArticles,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
  buildArticleTree,
  type HelpArticle,
  type UpdateArticlePayload,
} from "@/services/help.service";

export default function Documentation() {
  const { startLoading, stopLoading } = useLoading();
  const { role } = useAuth();
  const { prefix } = useParams<{ prefix: string }>();
  const isTechnician = role === "technician";

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedKey = searchParams.get("doc");

  const [articles, setArticles]         = useState<HelpArticle[]>([]);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [isSaving, setIsSaving]         = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addParentKey, setAddParentKey] = useState<string | null>(null);
  const [initialized, setInitialized]  = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    startLoading();
    getHelpArticles()
      .then(data => {
        setArticles(data);
        if (!searchParams.get("doc") && data.length > 0) {
          const first = data.find(a => a.parent_key !== null) ?? data[0];
          setSearchParams({ doc: first.section_key }, { replace: true });
        }
        setInitialized(true);
      })
      .finally(() => stopLoading());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────────────
  const selectedArticle = articles.find(a => a.section_key === selectedKey) ?? null;
  const rootSections    = articles.filter(a => a.parent_key === null);
  const tree            = buildArticleTree(articles);

  // ── Handlers ──────────────────────────────────────────────────────────────────────────

  /** Thay đổi bài viết đang xem (dùng URL param) */
  const handleSelect = useCallback((key: string) => {
    setSearchParams({ doc: key });
    setEditingId(null);
  }, [setSearchParams]);

  /** Mở editor */
  const handleEdit = useCallback(() => {
    if (selectedArticle) setEditingId(selectedArticle.id);
  }, [selectedArticle]);

  /** Lưu bài viết */
  const handleSave = useCallback(async (payload: UpdateArticlePayload) => {
    if (!selectedArticle) return;
    setIsSaving(true);
    try {
      setArticles(prev =>
        prev.map(a =>
          a.id === selectedArticle.id
            ? { ...a, ...payload, updated_at: new Date().toISOString() }
            : a
        )
      );
      await updateHelpArticle(selectedArticle.id, payload);
      setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  }, [selectedArticle]);

  /** Hủy chỉnh sửa */
  const handleCancel = useCallback(() => setEditingId(null), []);

  /** Xóa bài viết */
  const handleDelete = useCallback(async () => {
    if (!selectedArticle) return;
    const nextArticle = articles.find(a => a.id !== selectedArticle.id && a.parent_key !== null);
    setArticles(prev => prev.filter(a => a.id !== selectedArticle.id));
    await deleteHelpArticle(selectedArticle.id);
    if (nextArticle) {
      setSearchParams({ doc: nextArticle.section_key });
    } else {
      navigate(`/${prefix}/documentation`, { replace: true });
    }
    setEditingId(null);
  }, [selectedArticle, articles, setSearchParams, navigate, prefix]);

  /** Mở modal tạo bài viết */
  const handleOpenAddModal = useCallback((parentKey: string | null) => {
    setAddParentKey(parentKey);
    setAddModalOpen(true);
  }, []);

  /** Tạo bài viết mới */
  const handleCreateArticle = useCallback(async (payload: Parameters<typeof createHelpArticle>[0]) => {
    const newArticle = await createHelpArticle(payload);
    setArticles(prev => [...prev, newArticle]);
    setSearchParams({ doc: newArticle.section_key });
    setEditingId(newArticle.id);
  }, [setSearchParams]);

  // ── Check ?add= param ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const addParam = searchParams.get("add");
    if (addParam !== null && initialized) {
      setAddParentKey(addParam || null);
      setAddModalOpen(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete("add");
        return next;
      }, { replace: true });
    }
  }, [searchParams, initialized, setSearchParams]);

  // ── Skeleton ──────────────────────────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 animate-pulse">
        <div className="h-14 rounded-lg bg-muted w-full" />
        <div className="flex flex-1 gap-6">
          <div className="flex-1 h-[500px] rounded-lg bg-muted" />
          <div className="w-52 h-[400px] rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconBook className="w-5 h-5" />}
        title="Tài liệu hướng dẫn"
        description="Giải thích các khái niệm và hướng dẫn sử dụng hệ thống"
      />

      {/* Layout 2 cột */}
      <div className="flex gap-6 items-start">

        {/* Left — nội dung bài viết */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selectedArticle ? (
            <>
              {isTechnician && editingId !== selectedArticle.id && (
                <ArticleEditBar
                  article={selectedArticle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={() => handleOpenAddModal(selectedArticle.section_key)}
                />
              )}
              {editingId === selectedArticle.id ? (
                <ArticleEditor
                  key={selectedArticle.id}
                  article={selectedArticle}
                  isSaving={isSaving}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              ) : (
                <ArticleView article={selectedArticle} />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3">
              <BookOpenIcon className="h-10 w-10 opacity-20" />
              <p className="text-sm">Chọn một mục từ danh sách bên phải để đọc tài liệu</p>
            </div>
          )}
        </div>

        {/* Right — nav panel danh mục */}
        <aside className="w-52 xl:w-60 shrink-0 sticky top-16 self-start max-h-[calc(100vh-5rem)] flex flex-col">
          <div className="rounded-lg border bg-card p-3 flex flex-col gap-2 min-h-0 flex-1">
            <HelpSearchBar
              articles={articles}
              onSelect={handleSelect}
            />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 shrink-0">
              Danh mục
            </p>
            <div className="overflow-y-auto scrollbar-hidden flex-1 min-h-0">
              <DocumentationSidebar
                tree={tree}
                selectedKey={selectedKey}
                isTechnician={isTechnician}
                onSelect={handleSelect}
                onAddArticle={handleOpenAddModal}
              />
            </div>
          </div>
        </aside>

      </div>

      <AddArticleModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onConfirm={handleCreateArticle}
        defaultParentKey={addParentKey}
        rootSections={rootSections}
      />
    </div>
  );
}
