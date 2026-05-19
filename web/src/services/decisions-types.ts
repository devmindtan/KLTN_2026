/**
 * Decision-Making System Types
 */

export type DecisionCategory = 'congestion' | 'predictive' | 'optimization' | 'quality' | 'monitoring';
export type DecisionStatus = 'new' | 'reviewed' | 'implemented' | 'dismissed';

export interface Decision {
  id: string;
  category: DecisionCategory;
  title: string;
  recommendation: string;
  rationale: string;

  // Scoring
  score_impact: number;           // 0-100
  score_confidence: number;       // 0-100
  score_urgency: number;          // 0-100
  score_compound: number;         // 0-100 weighted average

  // Affected entities
  camera_ids: string[];
  route_id?: string;

  // Evidence & actions
  evidence: {
    historicalData?: string;
    forecastData?: string;
    modelMetrics?: string;
    currentStatus?: string;
  };
  action_items: {
    action: string;
    actor: 'technician' | 'driver' | 'system';
    timeToAction: 'immediate' | 'soon' | 'planned';
  }[];

  // Status tracking
  status: DecisionStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  feedback?: string;

  // Metadata
  generated_at: string;
  effective_until?: string;
  created_by: string;
}

export interface AnalyzeDecisionsResponse {
  success: boolean;
  count: number;
  data: Decision[];
  time_window: string;
  query: {
    cameras: string;
    category: string;
  };
}

export interface ListDecisionsResponse {
  success: boolean;
  data: Decision[];
  status_counts?: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReviewDecisionRequest {
  status: DecisionStatus;
  feedback?: string;
}

export interface ReviewDecisionResponse {
  success: boolean;
  message: string;
  data: Decision;
}

// Filter & sorting
export interface DecisionFilters {
  status?: string;           // comma-separated
  category?: string;         // comma-separated
  cameras?: string;          // comma-separated
  sort_by?: 'score' | 'urgency' | 'created_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Category display info
export const DECISION_CATEGORY_INFO: Record<DecisionCategory, { label: string; color: string; icon: string }> = {
  congestion: {
    label: 'Quản lý ùn tắc',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: '',
  },
  predictive: {
    label: 'Phòng chống trước',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    icon: '',
  },
  optimization: {
    label: 'Tối ưu tuyến',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '',
  },
  quality: {
    label: 'Chất lượng mô hình',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    icon: '',
  },
  monitoring: {
    label: 'Giám sát hệ thống',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    icon: '',
  },
};

/** Mô tả chi tiết từng loại quyết định */
export const DECISION_CATEGORY_DESCRIPTION: Record<DecisionCategory, string> = {
  congestion: 'Phát hiện ùn tắc hiện tại (V/C ≥ 85%) và đưa ra khuyến nghị can thiệp: điều hướng, điều chỉnh đèn, triển khai lực lượng. Cần hành động ngay lập tức.',
  predictive: 'Phân tích dự báo ML để phát hiện tắc nghẽn sắp xảy ra (10–60 phút tới). Hành động phòng ngừa sớm giúp ngăn leo thang trước khi xảy ra.',
  optimization: 'Phân tích tải lịch sử 7 ngày để cải thiện vận hành thường xuyên: chu kỳ đèn tín hiệu theo giờ cao điểm, định tuyến theo thời gian, hạ tầng.',
  quality: 'Giám sát độ chính xác mô hình ML. Khi MAPE > 25% hoặc số mẫu dữ liệu thấp (<10), cần huấn luyện lại hoặc kiểm tra luồng dữ liệu.',
  monitoring: 'Theo dõi sức khoẻ hệ thống: camera mất tín hiệu (>30 phút), dữ liệu bất thường, vấn đề hiệu chỉnh. Ảnh hưởng độ tin cậy toàn hệ thống.',
};

/** Giải thích ý nghĩa từng chỉ số điểm */
export const SCORE_FIELD_INFO: Record<'compound' | 'impact' | 'confidence' | 'urgency', {
  label: string;
  formula?: string;
  description: string;
  thresholds: Array<{ min: number; label: string; color: string }>;
}> = {
  compound: {
    label: 'Tổng điểm ưu tiên',
    formula: '= (Ảnh hưởng × 40%) + (Tin cậy × 35%) + (Cấp bách × 25%)',
    description: 'Điểm tổng hợp phản ánh mức độ ưu tiên xử lý. Quyết định điểm cao hơn nên được xem xét trước.',
    thresholds: [
      { min: 75, label: 'Nghiêm trọng', color: 'text-red-600' },
      { min: 50, label: 'Quan trọng', color: 'text-orange-500' },
      { min: 0, label: 'Bình thường', color: 'text-emerald-600' },
    ],
  },
  impact: {
    label: 'Ảnh hưởng',
    description: 'Dự báo mức độ cải thiện tình trạng giao thông nếu khuyến nghị được thực hiện. Điểm cao = cải thiện đáng kể.',
    thresholds: [
      { min: 80, label: 'Rất cao', color: 'text-red-600' },
      { min: 60, label: 'Cao', color: 'text-orange-500' },
      { min: 40, label: 'Trung bình', color: 'text-yellow-500' },
      { min: 0, label: 'Thấp', color: 'text-emerald-600' },
    ],
  },
  confidence: {
    label: 'Độ tin cậy',
    description: 'Mức độ chắc chắn của phân tích, phụ thuộc vào số lượng và chất lượng dữ liệu đầu vào. Điểm cao = phân tích dựa trên dữ liệu đầy đủ, tin cậy.',
    thresholds: [
      { min: 80, label: 'Rất tin cậy', color: 'text-emerald-600' },
      { min: 60, label: 'Tin cậy', color: 'text-blue-500' },
      { min: 40, label: 'Trung bình', color: 'text-yellow-500' },
      { min: 0, label: 'Thấp', color: 'text-red-500' },
    ],
  },
  urgency: {
    label: 'Mức cấp bách',
    description: 'Nhạy cảm về thời gian – thời gian tối ưu để hành động trước khi tình trạng xấu đi. Điểm cao = phải hành động ngay, điểm thấp = có thể xử lý theo kế hoạch.',
    thresholds: [
      { min: 80, label: 'Ngay lập tức', color: 'text-red-600' },
      { min: 60, label: 'Sớm', color: 'text-orange-500' },
      { min: 40, label: 'Trong hôm nay', color: 'text-yellow-500' },
      { min: 0, label: 'Theo kế hoạch', color: 'text-emerald-600' },
    ],
  },
};

// Status display info
export const DECISION_STATUS_INFO: Record<DecisionStatus, { label: string; color: string }> = {
  new: {
    label: 'Mới',
    color: 'bg-slate-100 text-slate-800',
  },
  reviewed: {
    label: 'Đã xem xét',
    color: 'bg-blue-100 text-blue-800',
  },
  implemented: {
    label: 'Đã thực hiện',
    color: 'bg-green-100 text-green-800',
  },
  dismissed: {
    label: 'Đã bỏ qua',
    color: 'bg-gray-100 text-gray-800',
  },
};

// Score priority
export function getScorePriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function getScorePriorityColor(score: number): string {
  const priority = getScorePriority(score);
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50';
    case 'medium':
      return 'text-orange-600 bg-orange-50';
    case 'low':
      return 'text-green-600 bg-green-50';
  }
}
