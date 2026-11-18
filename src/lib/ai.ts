import { formatCurrencyVND, slugify } from "@/lib/format";

export type SentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  sentiment: SentimentLabel;
  source: "gemini" | "heuristic";
}

export interface TourAiReviewSummary {
  overview: string;
  pros: string[];
  cons: string[];
  tips: string;
  updatedAt: string;
  reviewCountSnapshot: number;
  source: "gemini" | "heuristic";
}

export interface AssistantTourContext {
  id: string;
  code: string;
  name: string;
  slug: string;
  avatar: string | null;
  priceNewAdult: number;
  priceAdult: number;
  time: string;
  vehicle?: string;
  locations?: unknown;
  departureDate: string | Date | null;
  ratingAvg?: number;
  reviewCount?: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  categoryName?: string;
}

export interface AssistantChatResponse {
  reply: string;
  recommendedTours: AssistantTourContext[];
  source: "gemini" | "heuristic";
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
];

function getGeminiModelChain(): string[] {
  const preferred = (process.env.GEMINI_MODEL || "").trim();
  if (!preferred) return DEFAULT_GEMINI_MODELS;
  return [preferred, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== preferred)];
}

export function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  ).trim();
}

async function callGeminiJson<T>(
  prompt: string,
  systemInstruction: string,
  timeoutMs = 8000
): Promise<T | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const models = getGeminiModelChain();
  const deadline = Date.now() + timeoutMs;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining <= 600) break;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.25,
          },
        }),
        signal: AbortSignal.timeout(Math.min(remaining, 4500)),
      });

      if (!res.ok) {
        // Retry with the next model when deprecated (404), rate-limited (429), or overloaded (5xx)
        if (res.status === 404 || res.status === 429 || res.status >= 500) {
          continue;
        }
        return null;
      }

      const payload = await res.json();
      const text: string | undefined =
        payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      return JSON.parse(text) as T;
    } catch {
      // Network/timeout on this model: fall through to next model in chain
      continue;
    }
  }

  return null;
}

const BLOCKED_PHRASES_DIACRITIC = [
  "địt",
  "đụ mẹ",
  "lồn",
  "buồi",
  "cặc",
  "đéo",
  "óc chó",
  "ngu xuẩn",
  "chó đẻ",
  "lừa đảo bịp bợm",
  "nhà cái",
  "cá độ",
  "tài xỉu",
  "vay tiền nóng",
  "lô đề",
];

const BLOCKED_TOKEN_REGEX =
  /\b(fuck|shit|bitch|asshole|dick|pussy|bet88|kubet|jun88|hi88|789bet|vkl|vcl|dm|dcm|dkm|vl)\b/i;

const URL_SPAM_REGEX = /(https?:\/\/\S+|www\.\S+\.[a-z]{2,})/i;
const REPEATED_CHAR_REGEX = /(.)\1{7,}/;

function runHeuristicModeration(
  comment: string,
  rating: number
): ModerationResult {
  const trimmed = comment.trim();
  const lower = trimmed.toLowerCase();

  if (URL_SPAM_REGEX.test(trimmed)) {
    return {
      allowed: false,
      reason:
        "Bình luận không được chứa liên kết quảng cáo hoặc website bên ngoài.",
      sentiment: "NEGATIVE",
      source: "heuristic",
    };
  }

  if (REPEATED_CHAR_REGEX.test(trimmed)) {
    return {
      allowed: false,
      reason:
        "Nội dung có dấu hiệu spam ký tự lặp lại. Vui lòng viết đánh giá chân thực hơn.",
      sentiment: "NEGATIVE",
      source: "heuristic",
    };
  }

  for (const phrase of BLOCKED_PHRASES_DIACRITIC) {
    if (lower.includes(phrase)) {
      return {
        allowed: false,
        reason:
          "AI kiểm duyệt phát hiện ngôn từ không phù hợp hoặc mang tính xúc phạm/spam. Vui lòng điều chỉnh câu chữ lịch sự hơn.",
        sentiment: "NEGATIVE",
        source: "heuristic",
      };
    }
  }

  const normalizedWords = slugify(trimmed).replace(/-/g, " ");
  if (
    BLOCKED_TOKEN_REGEX.test(lower) ||
    BLOCKED_TOKEN_REGEX.test(normalizedWords) ||
    normalizedWords.includes("nha cai") ||
    normalizedWords.includes("ca do") ||
    normalizedWords.includes("tai xiu") ||
    normalizedWords.includes("vay tien nong") ||
    normalizedWords.includes("lua dao bip bom") ||
    normalizedWords.includes("oc cho")
  ) {
    return {
      allowed: false,
      reason:
        "AI kiểm duyệt phát hiện ngôn từ thô tục hoặc nội dung quảng cáo spam. Vui lòng viết đánh giá văn minh hơn.",
      sentiment: "NEGATIVE",
      source: "heuristic",
    };
  }

  const positiveCues = [
    "tuyet voi",
    "hai long",
    "nhiet tinh",
    "chu dao",
    "dep",
    "sach se",
    "dung gio",
    "ngon",
    "xung dang",
    "vui",
    "an tuong",
  ];
  const negativeCues = [
    "te",
    "kem",
    "that vong",
    "chan",
    "do",
    "ban",
    "tre gio",
    "dat",
    "khong hai long",
  ];

  let posScore = positiveCues.filter((c) => normalizedWords.includes(c)).length;
  let negScore = negativeCues.filter((c) => normalizedWords.includes(c)).length;
  if (rating >= 4) posScore += 2;
  else if (rating <= 2) negScore += 2;

  let sentiment: SentimentLabel = "NEUTRAL";
  if (posScore > negScore) sentiment = "POSITIVE";
  else if (negScore > posScore) sentiment = "NEGATIVE";

  return {
    allowed: true,
    sentiment,
    source: "heuristic",
  };
}

/**
 * AI Auto-Moderation: blocks profanity, hate speech, external link spam, and classifies review sentiment.
 * Runs deterministic pre-checks immediately, then refines with Gemini 2.5 Flash if GEMINI_API_KEY is configured.
 */
export async function moderateReviewContent(
  comment: string,
  rating: number
): Promise<ModerationResult> {
  const localCheck = runHeuristicModeration(comment, rating);
  if (!localCheck.allowed) {
    return localCheck;
  }

  if (!getGeminiApiKey()) {
    return localCheck;
  }

  const aiResponse = await callGeminiJson<{
    allowed: boolean;
    reason?: string;
    sentiment?: string;
  }>(
    JSON.stringify({ rating, comment }),
    `Bạn là hệ thống AI kiểm duyệt đánh giá tour du lịch cho TravelVN (28.TRAVEL).
Kiểm tra bình luận khách hàng:
- Chặn (allowed: false) nếu chứa ngôn từ thô tục, chửi bới, công kích cá nhân, kỳ thị, quảng cáo cờ bạc/tín dụng đen/spam link, hoặc chữ vô nghĩa.
- Cho phép (allowed: true) các lời góp ý/phê bình lịch sự dù chấm ít sao (ví dụ: chê xe cũ, lịch trình hơi gấp).
Trả về JSON: { "allowed": boolean, "reason": "lý do tiếng Việt ngắn gọn nếu false", "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE" }.`
  );

  if (!aiResponse || typeof aiResponse.allowed !== "boolean") {
    return localCheck;
  }

  const sentiment: SentimentLabel =
    aiResponse.sentiment === "NEGATIVE" ||
    aiResponse.sentiment === "NEUTRAL" ||
    aiResponse.sentiment === "POSITIVE"
      ? aiResponse.sentiment
      : localCheck.sentiment;

  return {
    allowed: aiResponse.allowed,
    reason: aiResponse.allowed
      ? undefined
      : aiResponse.reason ||
        "Nội dung chưa phù hợp tiêu chuẩn cộng đồng của 28.TRAVEL. Vui lòng chỉnh sửa lại.",
    sentiment,
    source: "gemini",
  };
}

interface ReviewSummaryInput {
  rating: number;
  comment: string;
  isVerifiedBooking: boolean;
}

const PRO_ASPECT_MATCHERS: Array<{ keywords: string[]; label: string }> = [
  {
    keywords: ["huong dan vien", "hdv", "nhiet tinh", "chu dao", "tan tam"],
    label: "Hướng dẫn viên nhiệt tình, hỗ trợ đoàn chu đáo suốt tuyến",
  },
  {
    keywords: ["khach san", "resort", "phong", "sach", "tien nghi", "view"],
    label: "Chỗ nghỉ & khách sạn sạch sẽ, vị trí thuận tiện",
  },
  {
    keywords: ["lich trinh", "hop ly", "dung gio", "diem tham quan", "hap dan"],
    label: "Lịch trình sắp xếp khoa học, đúng giờ, đi được nhiều điểm nổi bật",
  },
  {
    keywords: ["an uong", "bua an", "do an", "ngon", "hai san", "dac san"],
    label: "Thực đơn bữa ăn phong phú, hợp khẩu vị vùng miền",
  },
  {
    keywords: ["xe", "di chuyen", "tai xe", "an toan", "em ai", "may bay"],
    label: "Phương tiện di chuyển đời mới, tài xế cẩn thận và đúng lịch",
  },
  {
    keywords: ["gia", "xung dang", "uu dai", "hop ly", "tiet kiem"],
    label: "Chi phí hợp lý so với chất lượng dịch vụ trọn gói",
  },
];

const CON_ASPECT_MATCHERS: Array<{ keywords: string[]; label: string }> = [
  {
    keywords: ["gap", "hoi voi", "di chuyen nhieu", "met", "day dac"],
    label: "Một số khung giờ di chuyển hơi dày, lịch trình khá nhanh",
  },
  {
    keywords: ["dong", "xep hang", "cho doi", "mua cao diem"],
    label: "Điểm tham quan có thể đông vào cuối tuần hoặc mùa cao điểm",
  },
  {
    keywords: ["thoi tiet", "mua", "nang", "nong", "lanh"],
    label: "Trải nghiệm tham quan ngoài trời phụ thuộc phần nào vào thời tiết",
  },
  {
    keywords: ["thuc don", "an uong", "hoi it", "nhat", "khau vi"],
    label: "Khẩu vị một vài bữa ăn địa phương có thể chưa hợp với tất cả du khách",
  },
];

function buildHeuristicSummary(
  tourName: string,
  reviews: ReviewSummaryInput[]
): TourAiReviewSummary {
  const count = reviews.length;
  const avg = Number(
    (reviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)
  );
  const verifiedCount = reviews.filter((r) => r.isVerifiedBooking).length;
  const highRatings = reviews.filter((r) => r.rating >= 4).length;

  const corpus = reviews
    .map((r) => slugify(r.comment).replace(/-/g, " "))
    .join(" | ");

  const pros: string[] = [];
  for (const matcher of PRO_ASPECT_MATCHERS) {
    if (matcher.keywords.some((kw) => corpus.includes(kw))) {
      pros.push(matcher.label);
    }
    if (pros.length >= 3) break;
  }

  if (pros.length === 0) {
    pros.push(
      `Tỷ lệ đánh giá tích cực đạt ${Math.round((highRatings / count) * 100)}% (${highRatings}/${count} lượt)`
    );
    if (verifiedCount > 0) {
      pros.push(
        `Có ${verifiedCount} đánh giá từ khách đã trực tiếp đặt và trải nghiệm tour`
      );
    }
  }

  const cons: string[] = [];
  for (const matcher of CON_ASPECT_MATCHERS) {
    if (matcher.keywords.some((kw) => corpus.includes(kw))) {
      cons.push(matcher.label);
    }
    if (cons.length >= 2) break;
  }

  if (cons.length === 0 && reviews.some((r) => r.rating <= 3)) {
    cons.push(
      "Một số góp ý nhỏ về nhịp độ tham quan hoặc dịch vụ phát sinh theo từng ngày khởi hành"
    );
  }

  const sentimentSummary =
    avg >= 4.5
      ? "rất hài lòng"
      : avg >= 3.8
        ? "khá hài lòng"
        : "có ý kiến trái chiều";

  const overview = `Dựa trên ${count} đánh giá thực tế (${verifiedCount} khách đã đặt tour), du khách nhìn chung ${sentimentSummary} với "${tourName}" (điểm trung bình ${avg}/5 sao).`;

  const tips =
    cons.length > 0
      ? "Nên chuẩn bị giày đi bộ thoải mái, xem trước dự báo thời tiết và đặt chỗ sớm 1–2 tuần để chọn khung giờ đẹp."
      : "Tour đang nhận phản hồi ổn định; bạn nên mang theo giấy tờ tùy thân và đặt sớm để giữ suất ưu đãi tốt nhất.";

  return {
    overview,
    pros,
    cons,
    tips,
    updatedAt: new Date().toISOString(),
    reviewCountSnapshot: count,
    source: "heuristic",
  };
}

/**
 * AI Review Summary: synthesizes verified & community reviews into pros, cons, overview and travel tips.
 */
export async function buildTourReviewSummary(
  tourName: string,
  reviews: ReviewSummaryInput[]
): Promise<TourAiReviewSummary | null> {
  if (reviews.length === 0) return null;

  const fallback = buildHeuristicSummary(tourName, reviews);
  if (!getGeminiApiKey()) return fallback;

  const compactReviews = reviews.slice(0, 25).map((r) => ({
    rating: r.rating,
    verified: r.isVerifiedBooking,
    comment: r.comment.slice(0, 400),
  }));

  const aiResult = await callGeminiJson<{
    overview?: string;
    pros?: string[];
    cons?: string[];
    tips?: string;
  }>(
    JSON.stringify({ tourName, reviews: compactReviews }),
    `Bạn là AI phân tích phản hồi khách hàng cho nền tảng du lịch 28.TRAVEL.
Hãy tổng hợp danh sách đánh giá thật dưới đây bằng tiếng Việt tự nhiên, khách quan, ngắn gọn:
- overview: 1–2 câu khái quát mức độ hài lòng chung dựa trên số sao và nội dung nhận xét.
- pros: mảng 2–3 điểm cộng cụ thể được khách khen nhiều nhất.
- cons: mảng 0–2 điểm cần lưu ý hoặc khách góp ý (nếu hầu như không có điểm chê thì để mảng rỗng []).
- tips: 1 câu lời khuyên thực tế cho khách chuẩn bị đi tour này.
Trả về JSON đúng cấu trúc: { "overview": string, "pros": string[], "cons": string[], "tips": string }.`
  );

  if (!aiResult || !aiResult.overview) {
    return fallback;
  }

  return {
    overview: String(aiResult.overview).trim(),
    pros: Array.isArray(aiResult.pros)
      ? aiResult.pros.map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : fallback.pros,
    cons: Array.isArray(aiResult.cons)
      ? aiResult.cons.map((s) => String(s).trim()).filter(Boolean).slice(0, 2)
      : fallback.cons,
    tips: aiResult.tips ? String(aiResult.tips).trim() : fallback.tips,
    updatedAt: new Date().toISOString(),
    reviewCountSnapshot: reviews.length,
    source: "gemini",
  };
}

function parseMaxBudgetVND(normalizedQuery: string): number | null {
  const underMatch = normalizedQuery.match(
    /(?:duoi|tam|khoang|toi da|khong qua)\s*(\d+(?:[.,]\d+)?)\s*(?:trieu|tr|m)/
  );
  if (underMatch) {
    return Number(underMatch[1].replace(",", ".")) * 1_000_000;
  }

  const genericMillion = normalizedQuery.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)\b/);
  if (genericMillion && !normalizedQuery.includes("tren")) {
    return Number(genericMillion[1].replace(",", ".")) * 1_000_000;
  }

  return null;
}

function scoreTourForQuery(
  tour: AssistantTourContext,
  normalizedQuery: string,
  maxBudget: number | null
): number {
  const price = tour.priceNewAdult > 0 ? tour.priceNewAdult : tour.priceAdult;
  const hay = slugify(
    [
      tour.name,
      tour.code,
      tour.time,
      tour.vehicle || "",
      tour.category?.name || tour.categoryName || "",
      Array.isArray(tour.locations) ? tour.locations.join(" ") : "",
    ].join(" ")
  ).replace(/-/g, " ");

  let score = 0;

  if (maxBudget !== null) {
    if (price <= maxBudget) score += 25;
    else if (price <= maxBudget * 1.15) score += 8;
    else score -= 30;
  }

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !["tour", "di", "cho", "minh", "co", "nao", "bao", "nhieu"].includes(w));

  for (const token of queryTokens) {
    if (hay.includes(token)) score += 12;
  }

  // Regional & theme cues
  if (
    normalizedQuery.includes("bien") &&
    ["phu quoc", "da nang", "ha long", "nha trang", "quy nhon", "con dao", "dao"].some((k) =>
      hay.includes(k)
    )
  ) {
    score += 24;
  }

  if (
    normalizedQuery.includes("nui") &&
    ["sapa", "ha giang", "da lat", "fansipan", "moc chau", "ninh binh"].some((k) =>
      hay.includes(k)
    )
  ) {
    score += 24;
  }

  if (
    normalizedQuery.includes("nuoc ngoai") &&
    (hay.includes("chau a") ||
      hay.includes("chau au") ||
      hay.includes("nhat ban") ||
      hay.includes("han quoc") ||
      hay.includes("thai lan") ||
      hay.includes("singapore") ||
      hay.includes("nuoc ngoai"))
  ) {
    score += 22;
  }

  if (
    normalizedQuery.includes("trong nuoc") &&
    (hay.includes("mien bac") ||
      hay.includes("mien trung") ||
      hay.includes("mien nam") ||
      hay.includes("trong nuoc"))
  ) {
    score += 20;
  }

  if (
    normalizedQuery.includes("danh gia") ||
    normalizedQuery.includes("tot nhat") ||
    normalizedQuery.includes("hot")
  ) {
    score += (tour.ratingAvg ?? 5) * 3 + Math.min(10, tour.reviewCount ?? 0);
  }

  if (
    normalizedQuery.includes("giam gia") ||
    normalizedQuery.includes("re") ||
    normalizedQuery.includes("khuyen mai")
  ) {
    const discountPct =
      tour.priceAdult > price && price > 0
        ? Math.round(((tour.priceAdult - price) / tour.priceAdult) * 100)
        : 0;
    score += discountPct;
  }

  // Mild preference for tours with verified reviews
  score += Math.min(5, tour.reviewCount ?? 0);
  return score;
}

/**
 * AI Travel Assistant (Lightweight RAG): reads active tour catalog from Neon DB,
 * ranks candidates against user preferences, and answers in Vietnamese with tour card links.
 */
export async function askTravelAssistant(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  tours: AssistantTourContext[]
): Promise<AssistantChatResponse> {
  if (tours.length === 0) {
    return {
      reply:
        "Hiện tại hệ thống chưa có tour đang mở bán. Bạn vui lòng quay lại sau hoặc liên hệ hotline 28.TRAVEL để được tư vấn trực tiếp nhé!",
      recommendedTours: [],
      source: "heuristic",
    };
  }

  const normalizedQuery = slugify(userMessage).replace(/-/g, " ");
  const maxBudget = parseMaxBudgetVND(normalizedQuery);

  const ranked = [...tours]
    .map((tour) => ({
      tour,
      score: scoreTourForQuery(tour, normalizedQuery, maxBudget),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const priceA = a.tour.priceNewAdult || a.tour.priceAdult;
      const priceB = b.tour.priceNewAdult || b.tour.priceAdult;
      return priceA - priceB;
    });

  const topCandidates = ranked.slice(0, 12).map((item) => item.tour);
  const heuristicTop3 = ranked
    .filter((item) => item.score >= 0)
    .slice(0, 3)
    .map((item) => item.tour);
  const fallbackRecommended =
    heuristicTop3.length > 0 ? heuristicTop3 : ranked.slice(0, 3).map((i) => i.tour);

  if (getGeminiApiKey()) {
    const catalogSnippet = topCandidates.map((t) => ({
      slug: t.slug,
      code: t.code,
      name: t.name,
      category: t.category?.name || t.categoryName || "",
      priceAdultVND: t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult,
      originalPriceVND: t.priceAdult,
      duration: t.time,
      vehicle: t.vehicle || "",
      departures: t.locations,
      ratingAvg: t.ratingAvg ?? 5,
      reviewCount: t.reviewCount ?? 0,
    }));

    const recentHistory = history.slice(-4).map((h) => ({
      role: h.role,
      content: h.content.slice(0, 300),
    }));

    const aiChat = await callGeminiJson<{
      reply?: string;
      recommendedSlugs?: string[];
    }>(
      JSON.stringify({
        userMessage,
        recentHistory,
        availableTours: catalogSnippet,
      }),
      `Bạn là Trợ lý Du lịch AI thân thiện của 28.TRAVEL.
Chỉ tư vấn dựa trên danh sách tour thật trong "availableTours", tuyệt đối không bịa tour hay giá không có trong danh sách.
Nếu không có tour khớp hoàn toàn ngân sách/điểm đến, hãy giải thích khéo và gợi ý phương án gần nhất.
Trả về JSON: { "reply": "câu trả lời tiếng Việt tự nhiên, súc tích 2-4 câu", "recommendedSlugs": ["slug-1", "slug-2"] (tối đa 3 slug hợp lệ) }.`,
      8500
    );

    if (aiChat?.reply) {
      const slugMap = new Map(tours.map((t) => [t.slug, t]));
      const chosen = Array.isArray(aiChat.recommendedSlugs)
        ? aiChat.recommendedSlugs
            .map((s) => slugMap.get(String(s).trim()))
            .filter((t): t is AssistantTourContext => Boolean(t))
            .slice(0, 3)
        : [];

      return {
        reply: aiChat.reply.trim(),
        recommendedTours: chosen.length > 0 ? chosen : fallbackRecommended,
        source: "gemini",
      };
    }
  }

  // Deterministic Vietnamese travel assistant response
  const intro =
    maxBudget !== null && heuristicTop3.length === 0
      ? `Hiện chưa có tour đúng mức dưới ${formatCurrencyVND(maxBudget)}, nhưng mình gợi ý 3 tour giá mềm và lịch trình đẹp nhất gần ngân sách của bạn:`
      : `Mình tìm thấy ${fallbackRecommended.length} hành trình phù hợp nhất cho nhu cầu "${userMessage.trim()}" của bạn:`;

  const lines = fallbackRecommended.map((t, idx) => {
    const price = t.priceNewAdult > 0 ? t.priceNewAdult : t.priceAdult;
    const locs = Array.isArray(t.locations)
      ? (t.locations as string[]).join(", ")
      : "Hà Nội";
    const ratingText =
      (t.reviewCount ?? 0) > 0
        ? `${t.ratingAvg ?? 5}★ (${t.reviewCount} đánh giá)`
        : "Tour mới";
    return `${idx + 1}. ${t.name} — ${formatCurrencyVND(price)}/khách (${t.time}, khởi hành ${locs}, ${ratingText})`;
  });

  return {
    reply: `${intro}\n\n${lines.join("\n")}\n\nBạn bấm trực tiếp vào thẻ tour bên dưới để xem lịch trình chi tiết và đặt chỗ ngay nhé!`,
    recommendedTours: fallbackRecommended,
    source: "heuristic",
  };
}
