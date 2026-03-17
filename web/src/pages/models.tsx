import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  IconBrain,
  IconCheck,
  IconLoader2,
  IconCircleCheck,
  IconCircleX,
  IconDatabase,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/custom/page-header";
import {
  getActiveModels,
  type MLModelMetadata,
} from "@/services/model.service";
import { useSocket } from "@/contexts/SocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { ModelDetailSheet } from "@/components/models/model-detail-sheet";
import {
  ActivateModelDialog,
  type ActivateTarget,
} from "@/components/models/activate-model-dialog";
import { ModelCard } from "@/components/models/model-card";
import { TrainNewVersionModal } from "@/components/models/train-new-version-modal";
import { MODELS_TERM } from "@/lib/app-constants";

// ============================================================
// PAGE
// ============================================================

export default function ModelsPage() {
  const { trainingJob, modelReload } = useSocket();
  const { role } = useAuth();
  const isTechnician = role === "technician";
  const { startLoading, stopLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  const [models, setModels] = useState<MLModelMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<MLModelMetadata | null>(null);
  const [activateTarget, setActivateTarget] = useState<ActivateTarget | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null);
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [trainTarget, setTrainTarget] = useState<string | null>(null);
  const [showTrainBanner, setShowTrainBanner] = useState(false);
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const [trainModalTestMode, setTrainModalTestMode] = useState(false);
  // 'new': mở bình thường ở step 1 | 'view': nhảy thẳng tới step 3 theo dõi tiến trình
  const [trainModalMode, setTrainModalMode] = useState<'new' | 'view'>('new');

  const isTrainingRunning = trainingJob?.status === 'running';

  /** Tự động mở detail Sheet khi navigate từ Search với openModelVersion trong state */
  useEffect(() => {
    const openVersion = (location.state as { openModelVersion?: string } | null)?.openModelVersion;
    if (!openVersion || !models.length || selectedModel) return;
    const match = models.find(m => m.model_version === openVersion);
    if (match) {
      setSelectedModel(match);
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, location.state]);
  const activateSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (activateSuccessTimerRef.current) clearTimeout(activateSuccessTimerRef.current);
    };
  }, []);

  const fetchModels = () => {
    setLoading(true);
    setError(null);
    startLoading();
    getActiveModels()
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => { setLoading(false); stopLoading(); });
  };

  useEffect(() => { fetchModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hiển/ẩn banner và auto-close khi job kết thúc
  // Dùng sessionStorage để tránh banner hiện lại sau khi navigate đi rồi quay lại
  const DISMISSED_JOBS_KEY = 'kltn_dismissed_train_jobs';
  const isJobBannerDismissed = (jobId: string) => {
    try { return (JSON.parse(sessionStorage.getItem(DISMISSED_JOBS_KEY) ?? '[]') as string[]).includes(jobId); }
    catch { return false; }
  };
  const markJobBannerDismissed = (jobId: string) => {
    try {
      const arr = JSON.parse(sessionStorage.getItem(DISMISSED_JOBS_KEY) ?? '[]') as string[];
      if (!arr.includes(jobId)) sessionStorage.setItem(DISMISSED_JOBS_KEY, JSON.stringify([...arr, jobId].slice(-10)));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!trainingJob) return;
    const jobId = trainingJob.job_id ?? '';
    // running: luôn hiện (user muốn biết job đang chạy dù navigate)
    if (trainingJob.status === 'running') {
      setShowTrainBanner(true);
      return;
    }
    // succeeded/failed: chỉ hiện nếu chưa từng dismiss job này
    if (isJobBannerDismissed(jobId)) return;
    if (trainingJob.status === 'succeeded') {
      setShowTrainBanner(true);
      // Auto-refetch models sau khi train xong (version mới xuất hiện trong history)
      fetchModels();
      const t = setTimeout(() => { setShowTrainBanner(false); markJobBannerDismissed(jobId); }, 6000);
      return () => clearTimeout(t);
    }
    if (trainingJob.status === 'failed') {
      setShowTrainBanner(true);
      const t = setTimeout(() => { setShowTrainBanner(false); markJobBannerDismissed(jobId); }, 8000);
      return () => clearTimeout(t);
    }
  }, [trainingJob?.status, trainingJob?.job_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload banner: hiện khi activate + tải model mới
  // Dùng sessionStorage tương tự training banner — tránh hiện lại sau khi navigate
  const DISMISSED_RELOADS_KEY = 'kltn_dismissed_model_reloads';
  const isReloadBannerDismissed = (reloadId: string) => {
    try { return (JSON.parse(sessionStorage.getItem(DISMISSED_RELOADS_KEY) ?? '[]') as string[]).includes(reloadId); }
    catch { return false; }
  };
  const markReloadBannerDismissed = (reloadId: string) => {
    try {
      const arr = JSON.parse(sessionStorage.getItem(DISMISSED_RELOADS_KEY) ?? '[]') as string[];
      if (!arr.includes(reloadId)) sessionStorage.setItem(DISMISSED_RELOADS_KEY, JSON.stringify([...arr, reloadId].slice(-10)));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!modelReload) return;
    const reloadId = modelReload.reload_id ?? '';
    // running: luôn hiện
    if (modelReload.status === 'running') {
      setShowReloadBanner(true);
      return;
    }
    // succeeded/failed: chỉ hiện nếu chưa dismiss
    if (isReloadBannerDismissed(reloadId)) return;
    if (modelReload.status === 'succeeded') {
      setShowReloadBanner(true);
      fetchModels(); // refresh card với metrics mới
      const t = setTimeout(() => { setShowReloadBanner(false); markReloadBannerDismissed(reloadId); }, 6000);
      return () => clearTimeout(t);
    }
    if (modelReload.status === 'failed') {
      setShowReloadBanner(true);
      const t = setTimeout(() => { setShowReloadBanner(false); markReloadBannerDismissed(reloadId); }, 8000);
      return () => clearTimeout(t);
    }
  }, [modelReload?.status, modelReload?.reload_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleActivateSuccess = (modelReloadTriggered: boolean) => {
    const version = activateTarget?.target.model_version ?? "";
    setActivateTarget(null);
    setSelectedModel(null); // đóng Sheet
    const msg = modelReloadTriggered
      ? `Đã kích hoạt phiên bản ${version.slice(-13)} — đang tải model mới vào bộ nhớ...`
      : `Đã kích hoạt phiên bản ${version.slice(-13)} — chưa thể kết nối tới image-predict`;
    setActivateSuccess(msg);
    fetchModels(); // refresh grid
    if (activateSuccessTimerRef.current) clearTimeout(activateSuccessTimerRef.current);
    activateSuccessTimerRef.current = setTimeout(() => setActivateSuccess(null), 7000);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <PageHeader
        icon={<IconBrain className="w-5 h-5" />}
        title={MODELS_TERM.page_header.title}
        description={MODELS_TERM.page_header.description}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchModels}
          disabled={loading}
          className="gap-1.5"
        >
          <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
        {isTechnician && (
          <Button
            className="text-xs px-2 py-2 h-auto"
            onClick={() => { setTrainModalMode('new'); setTrainTarget(null); setTrainModalOpen(true); }}
            disabled={isTrainingRunning}
            title={isTrainingRunning ? "Đang có tiến trình huấn luyện đang chạy" : undefined}
          >
            <IconSparkles className="w-3 h-3 mr-1" />
            Huấn luyện phiên bản mới
          </Button>
        )}
      </PageHeader>

      {/* Success banner (activate) */}
      {activateSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
          <IconCheck className="w-4 h-4 shrink-0" />
          {activateSuccess}
        </div>
      )}

      {/* Persistent training status banner (hiện khi modal đóng) */}
      {trainingJob &&
        showTrainBanner &&
        !trainModalOpen &&
        (trainingJob.status === "running" || trainingJob.status === "failed" || trainingJob.status === "succeeded") && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              trainingJob.status === "running"
                ? "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                : trainingJob.status === "failed"
                ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
                : "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
            }`}
          >
            {trainingJob.status === "running" && (
              <IconLoader2 className="w-4 h-4 shrink-0 animate-spin" />
            )}
            {trainingJob.status === "failed" && (
              <IconCircleX className="w-4 h-4 shrink-0" />
            )}
            {trainingJob.status === "succeeded" && (
              <IconCircleCheck className="w-4 h-4 shrink-0" />
            )}
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="font-medium">
                {trainingJob.status === "running" && `Đang huấn luyện: ${trainingJob.model_type?.replace(/_/g, " ")} — ${trainingJob.current_stage ?? "..."}`}
                {trainingJob.status === "failed" && `Huấn luyện thất bại: ${trainingJob.error_message ?? "Không rõ nguyên nhân"}`}
                {trainingJob.status === "succeeded" && `Huấn luyện hoàn tất: Phiên bản mới đã sẵn sàng để kích hoạt`}
              </span>
              {trainingJob.status === "running" && (
                <Progress value={trainingJob.progress_pct ?? 0} className="h-1.5" />
              )}
            </div>
            {trainingJob.status === "running" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0"
                onClick={() => { setTrainModalMode('view'); setTrainModalOpen(true); }}
              >
                Xem tiến trình
              </Button>
            )}
          </div>
        )}

      {/* Model reload banner (hiện sau khi activate — track tiến trình tải model mới) */}
      {modelReload && showReloadBanner &&
        (modelReload.status === "running" || modelReload.status === "failed" || modelReload.status === "succeeded") && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              modelReload.status === "running"
                ? "border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300"
                : modelReload.status === "failed"
                ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
                : "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300"
            }`}
          >
            {modelReload.status === "running" && <IconLoader2 className="w-4 h-4 shrink-0 animate-spin" />}
            {modelReload.status === "failed" && <IconCircleX className="w-4 h-4 shrink-0" />}
            {modelReload.status === "succeeded" && <IconCircleCheck className="w-4 h-4 shrink-0" />}
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <span className="font-medium">
                {modelReload.status === "running" && `Đang tải model: ${modelReload.model_type?.replace(/_/g, " ")} — ${modelReload.current_stage ?? "..."}`}
                {modelReload.status === "failed" && `Tải model thất bại: ${modelReload.error_message ?? "Không rõ nguyên nhân"}`}
                {modelReload.status === "succeeded" && `Đã tải model mới${modelReload.model_version ? ` (${modelReload.model_version})` : ""} — dự báo tiếp theo sẽ dùng phiên bản này`}
              </span>
              {modelReload.status === "running" && (
                <Progress value={modelReload.progress_pct ?? 0} className="h-1.5" />
              )}
            </div>
          </div>
        )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-12 w-16 bg-muted rounded-lg" />
                  ))}
                </div>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <strong>Lỗi tải dữ liệu:</strong> {error}
          <Button
            size="sm"
            variant="outline"
            className="ml-4"
            onClick={fetchModels}
          >
            Thử lại
          </Button>
        </div>
      )}

      {/* Chưa có dữ liệu */}
      {!loading && !error && models.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <IconDatabase className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">
            Chưa có mô hình nào trong hệ thống.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Các mô hình sẽ xuất hiện sau khi được upload lên MinIO và đăng ký metadata.
          </p>
        </div>
      )}

      {/* Grid cards */}
      {!loading && !error && models.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onViewDetail={setSelectedModel}
              onTrainNew={(modelType) => { setTrainModalMode('new'); setTrainTarget(modelType); setTrainModalOpen(true); }}
          isTrainingRunning={isTrainingRunning}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <ModelDetailSheet
        model={selectedModel}
        onClose={() => setSelectedModel(null)}
        onActivateRequest={(target, currentActive) =>
          setActivateTarget({ target, currentActive })
        }
      />

      {/* Activate Dialog */}
      <ActivateModelDialog
        activateTarget={activateTarget}
        onCancel={() => setActivateTarget(null)}
        onSuccess={handleActivateSuccess}
      />

      {/* Train New Version Modal */}
      <TrainNewVersionModal
        open={trainModalOpen}
        initialModelType={trainTarget}
        trainingJob={trainingJob}
        viewProgressMode={trainModalMode === 'view'}
        testMode={trainModalTestMode}
        onClose={() => { setTrainModalOpen(false); setTrainModalTestMode(false); }}
      />
    </div>
  );
}
