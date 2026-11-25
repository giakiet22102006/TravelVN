import {
  ContactStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

export const ADMIN_ACCOUNT_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  positionCompany: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  avatar: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminAccountSelect;

export const USER_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  address: true,
  avatar: true,
  provider: true,
  status: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface PermissionItem {
  key: string;
  label: string;
  group: string;
}

export const PERMISSION_ITEMS: PermissionItem[] = [
  { key: "dashboard_view", label: "Xem trang Tổng quan", group: "Tổng quan" },

  { key: "category_view", label: "Xem danh mục", group: "Danh mục" },
  { key: "category_create", label: "Tạo danh mục", group: "Danh mục" },
  { key: "category_edit", label: "Sửa danh mục", group: "Danh mục" },
  { key: "category_delete", label: "Xóa danh mục", group: "Danh mục" },

  { key: "tour_view", label: "Xem tour", group: "Tour" },
  { key: "tour_create", label: "Tạo tour", group: "Tour" },
  { key: "tour_edit", label: "Sửa tour", group: "Tour" },
  { key: "tour_delete", label: "Xóa tour", group: "Tour" },
  { key: "tour_trash", label: "Thùng rác tour", group: "Tour" },

  { key: "order_view", label: "Xem đơn hàng", group: "Đơn hàng" },
  { key: "order_edit", label: "Sửa đơn hàng", group: "Đơn hàng" },
  { key: "order_delete", label: "Xóa đơn hàng", group: "Đơn hàng" },

  { key: "review_view", label: "Xem đánh giá tour", group: "Đánh giá & Bình luận" },
  { key: "review_edit", label: "Duyệt & Trả lời đánh giá", group: "Đánh giá & Bình luận" },
  { key: "review_delete", label: "Xóa đánh giá", group: "Đánh giá & Bình luận" },

  { key: "news_view", label: "Xem tin tức", group: "Tin tức & Cẩm nang" },
  { key: "news_create", label: "Tạo bài viết", group: "Tin tức & Cẩm nang" },
  { key: "news_edit", label: "Sửa bài viết", group: "Tin tức & Cẩm nang" },
  { key: "news_delete", label: "Xóa bài viết", group: "Tin tức & Cẩm nang" },

  { key: "user_view", label: "Xem người dùng", group: "Người dùng & Liên hệ" },
  { key: "user_edit", label: "Sửa người dùng", group: "Người dùng & Liên hệ" },
  {
    key: "contact_view",
    label: "Xem thông tin liên hệ",
    group: "Người dùng & Liên hệ",
  },
  {
    key: "contact_edit",
    label: "Xử lý thông tin liên hệ",
    group: "Người dùng & Liên hệ",
  },
  {
    key: "contact_delete",
    label: "Xóa thông tin liên hệ",
    group: "Người dùng & Liên hệ",
  },

  { key: "setting_view", label: "Xem cài đặt chung", group: "Cài đặt" },
  { key: "setting_edit", label: "Cập nhật thông tin website", group: "Cài đặt" },

  { key: "role_view", label: "Xem nhóm quyền", group: "Nhóm quyền" },
  { key: "role_create", label: "Tạo nhóm quyền", group: "Nhóm quyền" },
  { key: "role_edit", label: "Sửa nhóm quyền", group: "Nhóm quyền" },
  { key: "role_delete", label: "Xóa nhóm quyền", group: "Nhóm quyền" },

  {
    key: "admin_view",
    label: "Xem tài khoản quản trị",
    group: "Tài khoản quản trị",
  },
  {
    key: "admin_create",
    label: "Tạo tài khoản quản trị",
    group: "Tài khoản quản trị",
  },
  {
    key: "admin_edit",
    label: "Sửa tài khoản quản trị",
    group: "Tài khoản quản trị",
  },
  {
    key: "admin_delete",
    label: "Xóa tài khoản quản trị",
    group: "Tài khoản quản trị",
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_ITEMS.map((item) => item.key);

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tiền mặt",
  MOMO: "Ví Momo",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  INITIAL: "Khởi tạo",
  APPROVED: "Đã duyệt",
  CANCELLED: "Đã hủy",
};

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  INITIAL: "bg-[#FEF3C7] text-[#B45309]",
  APPROVED: "bg-[#CCFBF1] text-[#0F766E]",
  CANCELLED: "bg-[#FEE2E2] text-[#B91C1C]",
};

export const PAYMENT_STATUS_TEXT_CLASSES: Record<PaymentStatus, string> = {
  PAID: "text-[#0F766E] font-bold",
  UNPAID: "text-[#B91C1C] font-bold",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: "Chưa xử lý",
  PROCESSED: "Đã liên hệ",
};

export const CONTACT_STATUS_BADGE_CLASSES: Record<ContactStatus, string> = {
  NEW: "bg-[#FEF3C7] text-[#B45309]",
  PROCESSED: "bg-[#CCFBF1] text-[#0F766E]",
};
