/**
 * Các hàm tiện ích dùng chung cho các component monitoring
 */
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

/** Badge trạng thái dựa trên Level of Service */
export const getStatusBadge = (status: string) => {
  switch (status) {
    case "free_flow":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><IconCheck className="w-3 h-3 mr-1" />Thông thoáng</Badge>;
    case "smooth":
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><IconCheck className="w-3 h-3 mr-1" />Ổn định</Badge>;
    case "moderate":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Trung bình</Badge>;
    case "heavy":
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Nặng</Badge>;
    case "congested":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><IconAlertTriangle className="w-3 h-3 mr-1" />Ùn tắc</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Không rõ</Badge>;
  }
};
