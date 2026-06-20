/**
 * Router mock trung tâm — được apiFetch gọi thay cho network thật khi Mock Mode bật.
 * Phân tích path sau "/api/" + method, gọi vào generator tương ứng, trả về Response
 * JSON giống hệt format backend thật để toàn bộ service layer không cần sửa đổi.
 *
 * Lưu ý: KHÔNG xử lý "/api/auth/*" — auth luôn dùng API thật (xem mock-mode.ts).
 */
import { networkDelay } from "./utils";
import * as cameraEngine from "./camera-engine";
import * as forecastGen from "../generators/forecast";
import * as modelsGen from "../generators/models";
import * as metricsGen from "../generators/model-metrics";
import * as libraryGen from "../generators/data-library";
import * as reportsGen from "../generators/reports";
import * as decisionsGen from "../generators/decisions";
import * as helpGen from "../generators/help";
import * as patternGen from "../generators/traffic-pattern";
import * as historyGen from "../generators/traffic-history";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function notFound(message = "Không tìm thấy dữ liệu"): Response {
  return json({ success: false, message }, 404);
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== "string" || body.length === 0) return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isTechnician(): boolean {
  try {
    return localStorage.getItem("auth_role") === "technician";
  } catch {
    return false;
  }
}

/** Router chính — nhận url đầy đủ (chứa "/api/...") + options của apiFetch */
export async function mockApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  await networkDelay();

  const apiIdx = url.indexOf("/api/");
  const afterApi = apiIdx >= 0 ? url.slice(apiIdx + 5) : url;
  const [pathPart, queryPart] = afterApi.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart ?? "");
  const method = (options.method ?? "GET").toUpperCase();
  const body = parseBody(options.body as BodyInit | null | undefined);

  try {
    // ── /cameras ────────────────────────────────────────────────────────────
    if (segments[0] === "cameras") {
      if (segments.length === 1 && method === "GET") {
        return json({ success: true, data: cameraEngine.getMockCameraInfoList() });
      }
      if (segments[1] === "nearby" && method === "GET") {
        // Mock đơn giản: trả toàn bộ camera (không lọc khoảng cách chính xác)
        return json({ success: true, data: cameraEngine.getMockCameraInfoList() });
      }
      if (segments.length === 2 && method === "GET") {
        const all = cameraEngine.getMockCameraInfoList();
        const found = all.filter((c) => c.cam_id === segments[1]);
        return json({ success: found.length > 0, data: found });
      }
    }

    // ── /forecast ───────────────────────────────────────────────────────────
    if (segments[0] === "forecast") {
      if (segments[1] === "rolling" && method === "GET") {
        return json(forecastGen.buildForecastRolling());
      }
      if (segments[1] === "summary" && method === "GET") {
        return json({ success: true, data: forecastGen.buildForecastSummary(query.get("date") ?? "") });
      }
      if (segments[1] === "timeline" && method === "GET") {
        return json(forecastGen.buildForecastTimeline(query.get("date") ?? "", query.get("camId") ?? "all"));
      }
      if (segments[1] === "slots" && method === "GET") {
        const horizon = Number(query.get("horizon") ?? 5) as 5 | 10 | 15 | 30 | 60;
        return json(forecastGen.buildForecastSlots(query.get("date") ?? "", horizon, Number(query.get("limit") ?? 200)));
      }
    }

    // ── /models ─────────────────────────────────────────────────────────────
    if (segments[0] === "models") {
      if (segments.length === 1 && method === "GET") {
        return json({ success: true, data: modelsGen.getActiveModels() });
      }
      if (segments[1] === "all" && method === "GET") {
        return json({ success: true, data: modelsGen.getAllModelVersions() });
      }
      if (segments[1] === "train" && method === "POST") {
        return json(
          modelsGen.trainModel({
            model_type: String(body.model_type ?? ""),
            start_date: String(body.start_date ?? ""),
            end_date: String(body.end_date ?? ""),
          })
        );
      }
      if (segments.length === 3 && segments[2] === "history" && method === "GET") {
        const result = modelsGen.getModelHistory(Number(segments[1]));
        return result ? json({ success: true, ...result }) : notFound();
      }
      if (segments.length === 3 && segments[2] === "activate" && method === "POST") {
        const result = modelsGen.activateModel(Number(segments[1]));
        return result ? json(result) : notFound();
      }
      if (segments.length === 2 && method === "GET") {
        const m = modelsGen.getModelById(Number(segments[1]));
        return m ? json({ success: true, data: m }) : notFound();
      }
    }

    // ── /model-metrics ──────────────────────────────────────────────────────
    if (segments[0] === "model-metrics") {
      if (segments[1] === "latest" && method === "GET") {
        return json({ success: true, data: metricsGen.getLatestModelMetrics() });
      }
      if (segments[1] === "history" && method === "GET") {
        const limit = Number(query.get("limit") ?? 20);
        const data = metricsGen.getModelMetricsHistory(limit);
        return json({ success: true, pagination: { total: data.length, limit, offset: 0 }, data });
      }
    }

    // ── /data-library ───────────────────────────────────────────────────────
    if (segments[0] === "data-library") {
      if (segments[1] === "collections") {
        if (segments.length === 2 && method === "GET") {
          return json(
            libraryGen.listCollections({
              source: query.get("source") ?? undefined,
              type: query.get("type") ?? undefined,
              page: query.get("page") ? Number(query.get("page")) : undefined,
              limit: query.get("limit") ? Number(query.get("limit")) : undefined,
            })
          );
        }
        if (segments.length === 2 && method === "POST") {
          return json(
            libraryGen.createCollection({
              title: String(body.title ?? ""),
              data_type: String(body.data_type ?? ""),
              description: body.description as string | undefined,
              tags: body.tags as string[] | undefined,
            })
          );
        }
        if (segments.length === 3 && method === "GET") {
          const result = libraryGen.getCollectionDetail(segments[2]);
          return result ? json(result) : notFound();
        }
        if (segments.length === 3 && method === "PUT") {
          const result = libraryGen.updateCollection(segments[2], body as { title?: string; description?: string | null; data_type?: string });
          return result ? json(result) : notFound();
        }
        if (segments.length === 3 && method === "DELETE") {
          return json(libraryGen.deleteCollection(segments[2]));
        }
      }
      if (segments[1] === "entries" && segments.length === 3 && method === "DELETE") {
        return json(libraryGen.deleteEntry(segments[2]));
      }
    }

    // ── /reports ────────────────────────────────────────────────────────────
    if (segments[0] === "reports") {
      if (segments.length === 1 && method === "GET") {
        return json(
          reportsGen.listReports({
            page: query.get("page") ? Number(query.get("page")) : undefined,
            limit: query.get("limit") ? Number(query.get("limit")) : undefined,
            type: query.get("type") ?? undefined,
            status: query.get("status") ?? undefined,
            search: query.get("search") ?? undefined,
          })
        );
      }
      if (segments[1] === "generate" && method === "POST") {
        return json(
          reportsGen.createReport({
            title: String(body.title ?? ""),
            type: body.type as never,
            period_from: String(body.period_from ?? ""),
            period_to: String(body.period_to ?? ""),
            settings: body.settings as never,
          })
        );
      }
      if (segments[1] === "history" && method === "GET") {
        return json(
          reportsGen.getReportHistory({
            limit: query.get("limit") ? Number(query.get("limit")) : undefined,
            offset: query.get("offset") ? Number(query.get("offset")) : undefined,
            action: query.get("action") ?? undefined,
          })
        );
      }
      if (segments.length === 4 && segments[2] === "download") {
        const reportResult = reportsGen.getReportById(segments[1]);
        const format = segments[3] as "pdf" | "xlsx" | "zip";
        const title = reportResult?.data.title ?? segments[1];
        const { blob, mime } = reportsGen.buildFakeFileBlob(format, title);
        return new Response(blob, { status: 200, headers: { "Content-Type": mime } });
      }
      if (segments.length === 2 && method === "GET") {
        const result = reportsGen.getReportById(segments[1]);
        return result ? json(result) : notFound();
      }
      if (segments.length === 2 && method === "DELETE") {
        return json(reportsGen.deleteReport(segments[1]));
      }
    }

    // ── /decisions ──────────────────────────────────────────────────────────
    if (segments[0] === "decisions") {
      if (segments.length === 1 && method === "GET") {
        return json(
          decisionsGen.listDecisions({
            status: query.get("status") ?? undefined,
            category: query.get("category") ?? undefined,
            cameras: query.get("cameras") ?? undefined,
            sort_by: (query.get("sort_by") as never) ?? undefined,
            sort_order: (query.get("sort_order") as never) ?? undefined,
            page: query.get("page") ? Number(query.get("page")) : undefined,
            limit: query.get("limit") ? Number(query.get("limit")) : undefined,
          })
        );
      }
      if (segments[1] === "analyze" && method === "GET") {
        return json(
          decisionsGen.analyzeDecisions({
            cameras: query.get("cameras") ?? undefined,
            time_window: query.get("time_window") ?? undefined,
            category: query.get("category") ?? undefined,
            limit: query.get("limit") ? Number(query.get("limit")) : undefined,
          })
        );
      }
      if (segments[1] === "create" && method === "POST") {
        return json(decisionsGen.createDecision(body as never));
      }
      if (segments[1] === "camera" && segments.length === 3 && method === "GET") {
        const data = decisionsGen.getDecisionHistory(segments[2], Number(query.get("limit") ?? 50));
        return json({ success: true, data });
      }
      if (segments.length === 3 && segments[2] === "review" && method === "POST") {
        const result = decisionsGen.reviewDecision(segments[1], String(body.status ?? "reviewed") as never, body.feedback as string | undefined);
        return result ? json(result) : notFound();
      }
      if (segments.length === 3 && segments[2] === "implement" && method === "POST") {
        const result = decisionsGen.implementDecision(segments[1], body.implementation_details as string | undefined);
        return result ? json(result) : notFound();
      }
      if (segments.length === 2 && method === "DELETE") {
        const result = decisionsGen.dismissDecision(segments[1]);
        return result ? json(result) : notFound();
      }
      if (segments.length === 2 && method === "GET") {
        const data = decisionsGen.getDecisionById(segments[1]);
        return data ? json({ success: true, data }) : notFound();
      }
    }

    // ── /help/articles ──────────────────────────────────────────────────────
    if (segments[0] === "help" && segments[1] === "articles") {
      if (segments.length === 2 && method === "GET") {
        return json({ success: true, data: helpGen.getArticles(isTechnician()) });
      }
      if (segments.length === 2 && method === "POST") {
        const result = helpGen.createArticle(body as never);
        return result.ok ? json({ success: true, data: result.data }) : json({ success: false, message: result.message }, result.status);
      }
      if (segments.length === 3 && method === "PUT") {
        const result = helpGen.updateArticle(segments[2], body as never);
        return result ? json({ success: true, data: result }) : notFound();
      }
      if (segments.length === 4 && segments[3] === "publish" && method === "PATCH") {
        const result = helpGen.togglePublish(segments[2]);
        return result ? json({ success: true, data: result }) : notFound();
      }
      if (segments.length === 3 && method === "DELETE") {
        return json({ success: helpGen.deleteArticle(segments[2]) });
      }
    }

    // ── /traffic ────────────────────────────────────────────────────────────
    if (segments[0] === "traffic" && segments[1] === "patterns" && method === "GET") {
      return json(
        patternGen.buildTrafficPattern((query.get("type") as never) ?? "hour", query.get("camera_id") ?? "all")
      );
    }
    if (segments[0] === "traffic" && segments[1] === "history" && method === "GET") {
      return json(historyGen.buildTrafficHistory(query.get("date") ?? "", query.get("camera_id") ?? "all"));
    }

    return notFound(`Mock route chưa hỗ trợ: ${method} /api/${pathPart}`);
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : "Lỗi mock router" }, 500);
  }
}
