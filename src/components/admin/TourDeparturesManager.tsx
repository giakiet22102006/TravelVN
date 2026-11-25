"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Edit3, Loader2, Plane, Plus, Trash2, X } from "lucide-react";
import { formatCurrencyVND, formatDateVN } from "@/lib/format";

interface DepartureItem {
  id: string;
  tourId: string;
  code: string;
  departureDate: string;
  returnDate: string | null;
  departureLocation: string;
  airline: string | null;
  flightOut: string | null;
  flightBack: string | null;
  hotelStar: number;
  priceAdult: number;
  priceChild: number;
  priceBaby: number;
  priceNewAdult: number;
  priceNewChild: number;
  priceNewBaby: number;
  singleRoomSurcharge: number;
  stockAdult: number;
  stockChild: number;
  stockBaby: number;
  status: "ACTIVE" | "INACTIVE";
}

interface TourDeparturesManagerProps {
  tourId: string;
  tourCode?: string;
}

const LOCATION_CHOICES = [
  "Hà Nội",
  "Đà Nẵng",
  "Nha Trang",
  "Hồ Chí Minh",
  "Phú Quốc",
  "Sapa",
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function TourDeparturesManager({
  tourId,
  tourCode,
}: TourDeparturesManagerProps) {
  const [departures, setDepartures] = useState<DepartureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form fields
  const [code, setCode] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [departureLocation, setDepartureLocation] = useState("Hà Nội");
  const [airline, setAirline] = useState("");
  const [flightOut, setFlightOut] = useState("");
  const [flightBack, setFlightBack] = useState("");
  const [hotelStar, setHotelStar] = useState(4);
  const [priceAdult, setPriceAdult] = useState(0);
  const [priceChild, setPriceChild] = useState(0);
  const [priceBaby, setPriceBaby] = useState(0);
  const [priceNewAdult, setPriceNewAdult] = useState(0);
  const [priceNewChild, setPriceNewChild] = useState(0);
  const [priceNewBaby, setPriceNewBaby] = useState(0);
  const [singleRoomSurcharge, setSingleRoomSurcharge] = useState(500000);
  const [stockAdult, setStockAdult] = useState(20);
  const [stockChild, setStockChild] = useState(10);
  const [stockBaby, setStockBaby] = useState(5);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  const loadDepartures = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tours/${tourId}/departures`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Không thể tải lịch khởi hành");
      }
      setDepartures(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Lỗi tải lịch khởi hành"
      );
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    if (tourId) {
      loadDepartures();
    }
  }, [tourId, loadDepartures]);

  function openCreateForm() {
    setEditingId(null);
    setCode("");
    setDepartureDate("");
    setReturnDate("");
    setDepartureLocation("Hà Nội");
    setAirline("");
    setFlightOut("");
    setFlightBack("");
    setHotelStar(4);
    setPriceAdult(0);
    setPriceChild(0);
    setPriceBaby(0);
    setPriceNewAdult(0);
    setPriceNewChild(0);
    setPriceNewBaby(0);
    setSingleRoomSurcharge(500000);
    setStockAdult(20);
    setStockChild(10);
    setStockBaby(5);
    setStatus("ACTIVE");
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(dep: DepartureItem) {
    setEditingId(dep.id);
    setCode(dep.code);
    setDepartureDate(toDateInputValue(dep.departureDate));
    setReturnDate(toDateInputValue(dep.returnDate));
    setDepartureLocation(dep.departureLocation);
    setAirline(dep.airline || "");
    setFlightOut(dep.flightOut || "");
    setFlightBack(dep.flightBack || "");
    setHotelStar(dep.hotelStar);
    setPriceAdult(dep.priceAdult);
    setPriceChild(dep.priceChild);
    setPriceBaby(dep.priceBaby);
    setPriceNewAdult(dep.priceNewAdult);
    setPriceNewChild(dep.priceNewChild);
    setPriceNewBaby(dep.priceNewBaby);
    setSingleRoomSurcharge(dep.singleRoomSurcharge);
    setStockAdult(dep.stockAdult);
    setStockChild(dep.stockChild);
    setStockBaby(dep.stockBaby);
    setStatus(dep.status);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const endpoint = editingId
        ? `/api/admin/tours/${tourId}/departures/${editingId}`
        : `/api/admin/tours/${tourId}/departures`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          departureDate,
          returnDate: returnDate || null,
          departureLocation,
          airline: airline.trim() || null,
          flightOut: flightOut.trim() || null,
          flightBack: flightBack.trim() || null,
          hotelStar,
          priceAdult,
          priceChild,
          priceBaby,
          priceNewAdult,
          priceNewChild,
          priceNewBaby,
          singleRoomSurcharge,
          stockAdult,
          stockChild,
          stockBaby,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể lưu lịch khởi hành");
        return;
      }

      setNotice(data.message || "Đã lưu lịch khởi hành!");
      setFormOpen(false);
      setEditingId(null);
      await loadDepartures();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(dep: DepartureItem) {
    setDeletingId(dep.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/admin/tours/${tourId}/departures/${dep.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể xóa lịch khởi hành");
        return;
      }
      setNotice(data.message || `Đã xóa lịch ${dep.code}`);
      await loadDepartures();
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-[14px] border border-[#E0E0E0] p-6 sm:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E0E0E0]">
        <div>
          <h2 className="text-lg font-bold text-[#202224] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#4880FF]" />
            <span>
              Quản lý Lịch khởi hành &amp; Giá theo ngày{" "}
              {tourCode ? `(${tourCode})` : ""}
            </span>
          </h2>
          <p className="text-xs text-[#606060] mt-1">
            Mọi thay đổi ở đây tự động đồng bộ giá thấp nhất, ngày khởi hành
            gần nhất và tổng số chỗ lên Tour cha.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="h-10 px-4 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm lịch khởi hành</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 font-medium">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 font-semibold">
          {notice}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-[#C5D6FF] bg-[#F5F6FA] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202224]">
              {editingId ? `Chỉnh sửa lịch ${code}` : "Tạo lịch khởi hành mới"}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1 text-[#606060] hover:text-[#202224]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Mã lịch (tự động nếu trống)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: TOUR001-260615"
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Ngày khởi hành <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Ngày về
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Điểm khởi hành <span className="text-red-500">*</span>
              </label>
              <select
                value={departureLocation}
                onChange={(e) => setDepartureLocation(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              >
                {LOCATION_CHOICES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Hãng bay / Phương tiện
              </label>
              <input
                type="text"
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="VD: Vietnam Airlines"
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Chuyến đi
              </label>
              <input
                type="text"
                value={flightOut}
                onChange={(e) => setFlightOut(e.target.value)}
                placeholder="VD: VN123 (08:30)"
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Chuyến về
              </label>
              <input
                type="text"
                value={flightBack}
                onChange={(e) => setFlightBack(e.target.value)}
                placeholder="VD: VN124 (18:00)"
                className="w-full h-10 px-3 rounded-lg border border-[#D5D5D5] bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#606060] mb-1">
                Hạng sao khách sạn &amp; Trạng thái
              </label>
              <div className="flex gap-2">
                <select
                  value={hotelStar}
                  onChange={(e) => setHotelStar(Number(e.target.value))}
                  className="w-24 h-10 px-2 rounded-lg border border-[#D5D5D5] bg-white text-sm"
                >
                  {[3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s} sao
                    </option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE"
                    )
                  }
                  className="flex-1 h-10 px-2 rounded-lg border border-[#D5D5D5] bg-white text-sm"
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Tạm dừng</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E0E0E0]">
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#202224]">
                Giá gốc (VNĐ)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={0}
                  value={priceAdult}
                  onChange={(e) => setPriceAdult(Number(e.target.value))}
                  placeholder="NL"
                  title="Giá gốc Người lớn"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={priceChild}
                  onChange={(e) => setPriceChild(Number(e.target.value))}
                  placeholder="TE"
                  title="Giá gốc Trẻ em"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={priceBaby}
                  onChange={(e) => setPriceBaby(Number(e.target.value))}
                  placeholder="EB"
                  title="Giá gốc Em bé"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-[#202224]">
                Giá bán mới (VNĐ)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={0}
                  value={priceNewAdult}
                  onChange={(e) => setPriceNewAdult(Number(e.target.value))}
                  placeholder="NL"
                  title="Giá mới Người lớn"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={priceNewChild}
                  onChange={(e) => setPriceNewChild(Number(e.target.value))}
                  placeholder="TE"
                  title="Giá mới Trẻ em"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={priceNewBaby}
                  onChange={(e) => setPriceNewBaby(Number(e.target.value))}
                  placeholder="EB"
                  title="Giá mới Em bé"
                  className="h-9 px-2.5 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-[#202224]">
                Số chỗ (NL / TE / EB) &amp; Phụ thu P.Đơn
              </p>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  min={0}
                  value={stockAdult}
                  onChange={(e) => setStockAdult(Number(e.target.value))}
                  title="Số chỗ Người lớn"
                  className="h-9 px-2 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={stockChild}
                  onChange={(e) => setStockChild(Number(e.target.value))}
                  title="Số chỗ Trẻ em"
                  className="h-9 px-2 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={stockBaby}
                  onChange={(e) => setStockBaby(Number(e.target.value))}
                  title="Số chỗ Em bé"
                  className="h-9 px-2 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={singleRoomSurcharge}
                  onChange={(e) =>
                    setSingleRoomSurcharge(Number(e.target.value))
                  }
                  title="Phụ thu phòng đơn (VNĐ)"
                  className="h-9 px-2 rounded-lg border border-[#D5D5D5] bg-white text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-9 px-4 rounded-lg border border-[#D5D5D5] bg-white text-xs font-semibold text-[#202224]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-[#4880FF] hover:bg-[#3a6ce0] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingId ? "Lưu cập nhật" : "Tạo lịch khởi hành"}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-[#606060]">
          Đang tải danh sách lịch khởi hành...
        </div>
      ) : departures.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#606060] bg-[#F5F6FA] rounded-xl border border-dashed border-[#D5D5D5]">
          Chưa có lịch khởi hành riêng. Tour đang dùng cấu hình giá và số chỗ
          mặc định.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#F5F6FA] border-y border-[#E0E0E0] text-xs text-[#606060]">
                <th className="py-2.5 px-3 font-semibold">Mã lịch</th>
                <th className="py-2.5 px-3 font-semibold">Khởi hành / Về</th>
                <th className="py-2.5 px-3 font-semibold">Điểm đi &amp; Bay</th>
                <th className="py-2.5 px-3 font-semibold">Giá NL / P.Đơn</th>
                <th className="py-2.5 px-3 font-semibold">Chỗ (NL/TE/EB)</th>
                <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {departures.map((dep) => (
                <tr key={dep.id} className="hover:bg-[#F5F6FA]/60">
                  <td className="py-3 px-3 font-bold text-[#202224] tabular-nums">
                    {dep.code}
                  </td>
                  <td className="py-3 px-3 tabular-nums text-xs">
                    <div className="font-semibold text-[#202224]">
                      {formatDateVN(dep.departureDate)}
                    </div>
                    {dep.returnDate && (
                      <div className="text-[#606060]">
                        Về: {formatDateVN(dep.returnDate)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    <div className="font-semibold text-[#202224]">
                      {dep.departureLocation}
                    </div>
                    {(dep.airline || dep.flightOut) && (
                      <div className="text-[#4880FF] inline-flex items-center gap-1 mt-0.5">
                        <Plane className="w-3 h-3" />
                        <span>
                          {dep.airline}
                          {dep.flightOut ? ` (${dep.flightOut})` : ""}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 tabular-nums text-xs">
                    <div className="font-bold text-[#B91C1C]">
                      {formatCurrencyVND(
                        dep.priceNewAdult > 0
                          ? dep.priceNewAdult
                          : dep.priceAdult
                      )}
                    </div>
                    <div className="text-[#606060]">
                      P.Đơn: {formatCurrencyVND(dep.singleRoomSurcharge)}
                    </div>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-xs font-semibold text-[#202224]">
                    {dep.stockAdult} / {dep.stockChild} / {dep.stockBaby}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        dep.status === "ACTIVE"
                          ? "bg-[#CCFBF1] text-[#0F766E]"
                          : "bg-[#FEE2E2] text-[#B91C1C]"
                      }`}
                    >
                      {dep.status === "ACTIVE" ? "Hoạt động" : "Tạm dừng"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditForm(dep)}
                        title="Sửa lịch khởi hành"
                        className="p-2 rounded-lg border border-[#D5D5D5] text-[#4880FF] hover:bg-[#EAF2FF]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === dep.id}
                        onClick={() => handleDelete(dep)}
                        title="Xóa lịch khởi hành"
                        className="p-2 rounded-lg border border-[#FECACA] text-[#EF3826] hover:bg-[#FEE2E2] disabled:opacity-50"
                      >
                        {deletingId === dep.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
