import { useEffect, useMemo, useRef, useState } from "react";
import { IconBook, IconCheck, IconGripVertical, IconHelp, IconMail, IconMessageCircle, IconPencil, IconPhone, IconSearch } from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import { HELP_TERM } from "@/lib/app-constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getHelpArticles, type HelpArticle } from "@/services/help.service";
import { smartMatch, calculateRelevanceScore } from "@/lib/search-utils";

const FEATURED_DOCS_KEY = "help_featured_docs";
const FEATURED_FAQ_KEY  = "help_featured_faq";
const MAX_FEATURED = 10;

/** Trang trợ giúp – hiển thị bài viết nổi bật và liên kết tới tài liệu */
export default function Help() {
  const navigate = useNavigate();
  const { routePrefix, role } = useAuth();
  const isTechnician = role === "technician";

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [featuredDocs, setFeaturedDocs] = useState<string[]>([]);
  const [featuredFaq,  setFeaturedFaq]  = useState<string[]>([]);

  /** null = đóng; "document" | "question" = đang mở dialog chọn bài */
  const [dialogType, setDialogType] = useState<"document" | "question" | null>(null);
  const [dialogSearch, setDialogSearch] = useState("");
  /** Lưu tạm lựa chọn trong dialog, chỉ apply khi bấm Lưu */
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const dragItem    = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  /** Tạo URL điều hướng tương thích cả viewer (bare path) và technician (prefix path) */
  const navTo = (page: string, params = "") =>
    routePrefix ? `/${routePrefix}/${page}${params}` : `/${page}${params}`;

  useEffect(() => {
    setLoading(true);
    getHelpArticles()
      .then((all) => {
        setArticles(all.filter((a) => a.is_published));
        setFeaturedDocs(JSON.parse(localStorage.getItem(FEATURED_DOCS_KEY) ?? "[]"));
        setFeaturedFaq(JSON.parse(localStorage.getItem(FEATURED_FAQ_KEY)  ?? "[]"));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const docArticles = articles.filter((a) => a.type === "document");
  const faqArticles = articles.filter((a) => a.type === "question");

  /** Toggle chọn/bỏ bài trong dialog; giới hạn MAX_FEATURED */
  const togglePending = (key: string) => {
    setPendingSelection((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < MAX_FEATURED ? [...prev, key] : prev,
    );
  };

  /** Mở dialog và khởi tạo pending từ lựa chọn hiện tại */
  const openDialog = (type: "document" | "question") => {
    const current = type === "document" ? featuredDocs : featuredFaq;
    setPendingSelection(current);
    setDialogSearch("");
    setDialogType(type);
  };

  /** Lưu lựa chọn và đóng dialog */
  const saveDialog = () => {
    if (dialogType === "document") {
      setFeaturedDocs(pendingSelection);
      localStorage.setItem(FEATURED_DOCS_KEY, JSON.stringify(pendingSelection));
    } else if (dialogType === "question") {
      setFeaturedFaq(pendingSelection);
      localStorage.setItem(FEATURED_FAQ_KEY, JSON.stringify(pendingSelection));
    }
    setDialogType(null);
  };

  /** Kéo thả để sắp xếp thứ tự bài đã chọn */
  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOverItem.current = idx; };
  const handleDragEnd   = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const reordered = [...pendingSelection];
    const [moved] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, moved);
    setPendingSelection(reordered);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const dialogPool = dialogType === "document" ? docArticles : faqArticles;
  const dialogArticles = useMemo(() => {
    const q = dialogSearch.trim();
    if (!q) return dialogPool;
    
    // Filter với smart search
    const filtered = dialogPool.filter(a => smartMatch(a.title, q));
    
    // Sort theo relevance score
    return filtered.sort((a, b) => {
      const scoreA = calculateRelevanceScore(a.title, q);
      const scoreB = calculateRelevanceScore(b.title, q);
      return scoreB - scoreA;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogType, dialogSearch, docArticles, faqArticles]);

  /**
   * Render danh sách bài nổi bật đã được chọn.
   * Nếu featured rỗng → chỉ hiện số bài có sẵn, không liệt kê.
   */
  const renderArticleList = (all: HelpArticle[], featured: string[]) => {
    if (loading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="h-5 w-3/4 rounded bg-muted animate-pulse" />
      ));
    }

    if (featured.length === 0) {
      return (
        <li className="text-sm text-muted-foreground">
          {all.length > 0
            ? `${all.length} bài viết có sẵn`
            : "Chưa có bài viết nào."}
        </li>
      );
    }

    const displayed = featured
      .map((key) => all.find((a) => a.section_key === key))
      .filter(Boolean) as HelpArticle[];

    if (displayed.length === 0) {
      return (
        <li className="text-sm text-muted-foreground">
          {all.length > 0
            ? `${all.length} bài viết có sẵn`
            : "Chưa có bài viết nào."}
        </li>
      );
    }

    return displayed.map((article) => (
      <li key={article.section_key}>
        <Button
          variant="link"
          className="h-auto p-0 text-sm font-normal text-left justify-start"
          onClick={() => navigate(navTo("documentation", `?doc=${article.section_key}`))}
        >
          {article.title}
        </Button>
      </li>
    ));
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <PageHeader
        icon={<IconHelp className="w-5 h-5" />}
        title={HELP_TERM.page_header.title}
        description={HELP_TERM.page_header.description}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Tài liệu hướng dẫn */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <IconBook className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Tài liệu hướng dẫn</CardTitle>
                  <CardDescription className="mt-1">Các khái niệm và hướng dẫn sử dụng hệ thống</CardDescription>
                </div>
              </div>
              {isTechnician && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  title="Chọn bài nổi bật"
                  onClick={() => openDialog("document")}
                >
                  <IconPencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {renderArticleList(docArticles, featuredDocs)}
            </ul>
          </CardContent>
        </Card>

        {/* Câu hỏi thường gặp */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <IconMessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Câu hỏi thường gặp</CardTitle>
                  <CardDescription className="mt-1">Giải đáp các thắc mắc phổ biến</CardDescription>
                </div>
              </div>
              {isTechnician && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  title="Chọn bài nổi bật"
                  onClick={() => openDialog("question")}
                >
                  <IconPencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {renderArticleList(faqArticles, featuredFaq)}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Liên hệ hỗ trợ */}
      <Card>
        <CardHeader>
          <CardTitle>Liên hệ hỗ trợ</CardTitle>
          <CardDescription>Nếu bạn cần hỗ trợ trực tiếp, hãy liên hệ với chúng tôi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: IconMail,          label: "Email",     value: "devmind.tan@gmail.com",  bg: "bg-blue-50 dark:bg-blue-950/20",   color: "text-blue-600" },
              { icon: IconPhone,         label: "Hotline",   value: "+84 942 510 317",         bg: "bg-green-50 dark:bg-green-950/20",  color: "text-green-600" },
              { icon: IconMessageCircle, label: "Live Chat", value: "8:00 – 18:00 hàng ngày", bg: "bg-purple-50 dark:bg-purple-950/20", color: "text-purple-600" },
            ].map(({ icon: Icon, label, value, bg, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-sm text-muted-foreground">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog chọn bài viết nổi bật */}
      <Dialog open={!!dialogType} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="m-auto">
              Chọn {dialogType === "document" ? "tài liệu" : "FAQ"} nổi bật
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Khu vực sắp xếp thứ tự — chỉ hiện khi đã chọn ít nhất 1 bài */}
            {pendingSelection.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-0.5">Thứ tự hiển thị (kéo để sắp xếp)</p>
                <div className="border rounded-lg divide-y">
                  {pendingSelection.map((key, idx) => {
                    const article = dialogPool.find((a) => a.section_key === key);
                    if (!article) return null;
                    return (
                      <div
                        key={key}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragEnter={() => handleDragEnter(idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex items-center gap-2 px-3 py-2 bg-background hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-colors select-none"
                      >
                        <IconGripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm flex-1 truncate">{article.title}</span>
                        <button
                          className="text-muted-foreground hover:text-destructive transition-colors text-xs shrink-0"
                          onClick={() => togglePending(key)}
                          title="Bỏ chọn"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thanh tìm kiếm */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm bài viết..."
                value={dialogSearch}
                onChange={(e) => setDialogSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Danh sách bài viết có thể chọn */}
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <div className="p-3 border-b bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Tìm thấy {dialogArticles.length} bài viết
                  </span>
                  <Badge variant={pendingSelection.length >= MAX_FEATURED ? "destructive" : "secondary"}>
                    {pendingSelection.length}/{MAX_FEATURED}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1 p-3">
                {dialogArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Không tìm thấy bài viết nào.</p>
                ) : (
                  dialogArticles.map((article) => {
                    const checked = pendingSelection.includes(article.section_key);
                    const disabled = !checked && pendingSelection.length >= MAX_FEATURED;
                    return (
                      <div
                        key={article.section_key}
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors ${
                          disabled ? "opacity-60" : ""
                        }`}
                      >
                        <Checkbox
                          id={`dialog-${article.section_key}`}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => togglePending(article.section_key)}
                        />
                        <label
                          htmlFor={`dialog-${article.section_key}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {article.title}
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Hủy
            </Button>
            <Button onClick={saveDialog} className="min-w-20">
              <IconCheck className="w-4 h-4 mr-1.5" />
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}