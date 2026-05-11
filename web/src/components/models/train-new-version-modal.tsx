import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  IconSparkles,
  IconAlertTriangle,
  IconLoader2,
  IconCircleCheck,
  IconCircleX,
} from "@tabler/icons-react";
import { trainModel } from "@/services/model.service";
import { type TrainingJobData } from "@/contexts/SocketContext";
import { MetricChip } from "@/components/models/metric-chip";

const RF_MODEL_TYPES = [
  { value: "random_forest_5m",  label: "Random Forest • Dự báo 5 phút"  },
  { value: "random_forest_10m", label: "Random Forest • Dự báo 10 phút" },
  { value: "random_forest_15m", label: "Random Forest • Dự báo 15 phút" },
  { value: "random_forest_30m", label: "Random Forest • Dự báo 30 phút" },
  { value: "random_forest_60m", label: "Random Forest • Dự báo 60 phút" },
];

/**
 * Dialog đa bước để chọn loại mô hình, khoảng thời gian dữ liệu
 * và theo dõi tiến trình huấn luyện qua WebSocket.
 * POST /api/models/train
 */
export function TrainNewVersionModal({
  open,
  initialModelType,
  trainingJob,
  viewProgressMode,
  testMode,
  onClose,
}: {
  open: boolean;
  initialModelType: string | null;
  trainingJob: TrainingJobData | null;
  /** Khi true: bỏ qua step 1-2, hiển thị trực tiếp tiến trình job đang chạy */
  viewProgressMode?: boolean;
  /** Khi true: nhảy thẳng step 3 với fake jobId để test timeout mechanism (TC-09) */
  testMode?: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  // TC-09: timeout khi step 3 không nhận được FIWARE response
  const [jobStartTimeout, setJobStartTimeout] = useState(false);

  // Ngày mặc định: start cố định 13/02/2026, end = hôm qua
  const DEFAULT_START = "2026-02-13";
  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  // Khi modal mở: viewProgressMode → thẳng tới step 3, ngược lại reset bình thường
  useEffect(() => {
    if (!open) return;
    setJobStartTimeout(false);
    if (viewProgressMode) {
      setStep(3);
      setCurrentJobId(trainingJob?.job_id ?? null);
      setSubmitError(null);
    } else if (testMode) {
      // Chế độ test TC-09: nhảy thẳng step 3 với fake jobId để không có FIWARE response
      setCurrentJobId(`test_stuck_${Date.now()}`);
      setStep(3);
      setSubmitError(null);
    } else {
      setSelectedType(initialModelType ?? "random_forest_5m");
      setStartDate(DEFAULT_START);
      setEndDate(getYesterday());
      setStep(1);
      setSubmitError(null);
      setCurrentJobId(null);
    }
  }, [open, initialModelType, viewProgressMode, testMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // TC-09 fix: enable close button nếu không nhận được phản hồi sau 60s
  useEffect(() => {
    if (step !== 3 || activeJob != null) { // eslint-disable-line react-hooks/exhaustive-deps
      setJobStartTimeout(false);
      return;
    }
    const t = setTimeout(() => setJobStartTimeout(true), 60_000);
    return () => clearTimeout(t);
  }, [step, trainingJob?.job_id, currentJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewProgressMode && trainingJob && trainingJob.job_id === currentJobId && step !== 3) {
      setStep(3);
    }
  }, [trainingJob, currentJobId, step, viewProgressMode]);

  const handleStartTraining = async () => {
    if (!startDate || !endDate) {
      setSubmitError("Vui lòng chọn đủ ngày bắt đầu và kết thúc");
      return;
    }
    if (startDate >= endDate) {
      setSubmitError("Ngày bắt đầu phải nhỏ hơn ngày kết thúc");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await trainModel({
        model_type: selectedType,
        start_date: startDate,
        end_date: endDate,
      });
      setCurrentJobId(res.job_id);
      setStep(3);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Lỗi khởi động training"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // job đang được theo dõi trong step 3
  // viewProgressMode: dùng bất kỳ trainingJob nào đang có (không cần khớp currentJobId)
  const activeJob: TrainingJobData | null = viewProgressMode
    ? trainingJob
    : trainingJob && trainingJob.job_id === currentJobId
    ? trainingJob
    : null;

  const isJobDone =
    activeJob?.status === "succeeded" || activeJob?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSparkles className="w-5 h-5 text-primary" />
            Huấn Luyện Phiên Bản Mới
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Bước 1/2: Chọn loại mô hình cần huấn luyện"}
            {step === 2 && "Bước 2/2: Chọn khoảng thời gian dữ liệu"}
            {step === 3 && "Tiến trình huấn luyện"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Chọn loại mô hình */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            {RF_MODEL_TYPES.map((rt) => (
              <label
                key={rt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === rt.value
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="model_type"
                  value={rt.value}
                  checked={selectedType === rt.value}
                  onChange={() => setSelectedType(rt.value)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{rt.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* STEP 2: Chọn ngày */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Loại mô hình: </span>
              <span className="font-medium">
                {RF_MODEL_TYPES.find((r) => r.value === selectedType)?.label}
              </span>
            </div>
            <div className="rounded-md border bg-blue-50/50 dark:bg-blue-900/10 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
              📅 Phạm vi dữ liệu:{" "}
              <span className="font-medium">{DEFAULT_START}</span> →{" "}
              <span className="font-medium">{getYesterday()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={DEFAULT_START}
                  max={getYesterday()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Ngày kết thúc
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || DEFAULT_START}
                  max={getYesterday()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ℹ️ Hệ thống sẽ tạo k8s Job chạy{" "}
              <code className="font-mono bg-muted px-1 rounded">
                train_single.py
              </code>
              . Kết quả lưu với{" "}
              <strong>is_active=FALSE</strong> — bạn tự kiểm tra và kích hoạt
              sau.
            </p>
            {submitError && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <IconAlertTriangle className="w-3.5 h-3.5" /> {submitError}
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Theo dõi tiến trình */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              {!activeJob || activeJob.status === "running" ? (
                <IconLoader2 className="w-5 h-5 text-primary animate-spin" />
              ) : activeJob.status === "succeeded" ? (
                <IconCircleCheck className="w-5 h-5 text-green-600" />
              ) : (
                <IconCircleX className="w-5 h-5 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {!activeJob
                  ? "Khởi động job..."
                  : activeJob.current_stage}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tiến độ</span>
                <span>{activeJob?.progress_pct ?? 0}%</span>
              </div>
              <Progress value={activeJob?.progress_pct ?? 0} className="h-2" />
            </div>

            {/* Error message */}
            {activeJob?.status === "failed" && activeJob.error_message && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <strong>Lỗi:</strong> {activeJob.error_message}
              </div>
            )}

            {/* TC-09: Timeout khi không nhận được phản hồi */}
            {jobStartTimeout && !activeJob && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300">
                <strong>⚠️ Không nhận được phản hồi sau 60 giây.</strong>
                <br />
                Có thể k8s Job không khởi động được. Kiểm tra:{" "}
                <code className="font-mono bg-muted px-1 rounded">
                  kubectl get jobs -n backend
                </code>
              </div>
            )}

            {/* Success result */}
            {activeJob?.status === "succeeded" && (
              <div className="space-y-3">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  ✅ Huấn luyện hoàn tất — phiên bản mới đã được lưu với
                  is_active=FALSE
                </p>
                {activeJob.result_metrics && (
                  <div className="flex gap-2">
                    <MetricChip
                      label="MAE"
                      value={activeJob.result_metrics.mae?.toFixed(2)}
                      unit=" xe"
                    />
                    <MetricChip
                      label="RMSE"
                      value={activeJob.result_metrics.rmse?.toFixed(2)}
                      unit=" xe"
                    />
                    <MetricChip
                      label="R²"
                      value={activeJob.result_metrics.r2?.toFixed(3)}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  → Mở <strong>Xem chi tiết</strong> của loại mô hình này để
                  so sánh metrics và kích hoạt phiên bản mới nếu kết quả tốt
                  hơn.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button onClick={() => setStep(2)} disabled={!selectedType}>
                Tiếp theo
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                Quay lại
              </Button>
              <Button onClick={handleStartTraining} disabled={submitting}>
                {submitting ? (
                  <>
                    <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Đang khởi tạo...
                  </>
                ) : (
                  <>
                    <IconSparkles className="w-4 h-4 mr-2" /> Bắt đầu huấn
                    luyện
                  </>
                )}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button
              onClick={onClose}
              disabled={!isJobDone && !jobStartTimeout}
            >
              {isJobDone
                ? "Đóng"
                : jobStartTimeout
                ? "Đóng (hết thời gian chờ)"
                : "Đang xử lý..."}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
