import { PrismaClient, Prisma, RecordStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildTourReviewSummary } from "../src/lib/ai";
import { ALL_PERMISSION_KEYS } from "../src/lib/permissions";
import { syncTourSummaryFromDepartures } from "../src/lib/departure-sync";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = ALL_PERMISSION_KEYS;

async function main() {
  console.log("Seeding TravelVN database...");

  // 1. Roles
  const roleAdmin = await prisma.role.upsert({
    where: { id: "role-admin" },
    update: { permissions: ALL_PERMISSIONS },
    create: {
      id: "role-admin",
      name: "Quản trị viên",
      description: "Có đầy đủ các quyền trong hệ thống",
      permissions: ALL_PERMISSIONS,
    },
  });

  await prisma.role.upsert({
    where: { id: "role-tour" },
    update: {},
    create: {
      id: "role-tour",
      name: "Quản lý tour",
      description: "Có đầy đủ quyền liên quan đến tour và danh mục",
      permissions: [
        "dashboard_view",
        "category_view",
        "category_create",
        "category_edit",
        "tour_view",
        "tour_create",
        "tour_edit",
        "tour_delete",
        "tour_trash",
      ],
    },
  });

  await prisma.role.upsert({
    where: { id: "role-order" },
    update: {},
    create: {
      id: "role-order",
      name: "Quản lý đơn hàng",
      description: "Có đầy đủ quyền liên quan đến đơn hàng",
      permissions: ["dashboard_view", "order_view", "order_edit"],
    },
  });

  // 2. Admin Accounts
  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  const adminA = await prisma.adminAccount.upsert({
    where: { email: "levana@gmail.com" },
    update: {},
    create: {
      fullName: "Lê Văn A",
      email: "levana@gmail.com",
      phone: "0123456789",
      positionCompany: "Giám đốc",
      roleId: roleAdmin.id,
      password: hashedPassword,
      status: RecordStatus.ACTIVE,
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80",
    },
  });

  const adminB = await prisma.adminAccount.upsert({
    where: { email: "admin@vntravel.com" },
    update: {},
    create: {
      fullName: "Lê Văn B",
      email: "admin@vntravel.com",
      phone: "0987654321",
      positionCompany: "Trưởng phòng điều hành",
      roleId: roleAdmin.id,
      password: hashedPassword,
      status: RecordStatus.ACTIVE,
      avatar:
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=80",
    },
  });

  // 3. Categories (Hierarchical)
  const catDomestic = await prisma.category.upsert({
    where: { slug: "tour-trong-nuoc" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Trong Nước",
      slug: "tour-trong-nuoc",
      position: 1,
      status: RecordStatus.ACTIVE,
      description: "Khám phá vẻ đẹp mọi miền tổ quốc Việt Nam cùng VN.TRAVEL.",
      avatar:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=90",
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const catInternational = await prisma.category.upsert({
    where: { slug: "tour-nuoc-ngoai" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Nước Ngoài",
      slug: "tour-nuoc-ngoai",
      position: 2,
      status: RecordStatus.ACTIVE,
      description: "Du lịch Châu Á, Châu Âu, Châu Úc, Châu Mỹ đẳng cấp 5 sao.",
      avatar:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=90",
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const catNorth = await prisma.category.upsert({
    where: { slug: "tour-mien-bac" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Miền Bắc",
      slug: "tour-mien-bac",
      parentId: catDomestic.id,
      position: 1,
      status: RecordStatus.ACTIVE,
      description: "Hà Nội - Ninh Bình - Hạ Long - Yên Tử - Sapa hùng vĩ.",
      avatar:
        "https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1600&q=90",
      createdById: adminA.id,
      updatedById: adminB.id,
    },
  });

  const catCentral = await prisma.category.upsert({
    where: { slug: "tour-mien-trung" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Miền Trung",
      slug: "tour-mien-trung",
      parentId: catDomestic.id,
      position: 2,
      status: RecordStatus.ACTIVE,
      description: "Đà Nẵng - Hội An - Bà Nà Hill - Huế - Nha Trang.",
      avatar:
        "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=90",
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  const catSouth = await prisma.category.upsert({
    where: { slug: "tour-mien-nam" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1704268391342-72363ec2b98c?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Miền Nam",
      slug: "tour-mien-nam",
      parentId: catDomestic.id,
      position: 3,
      status: RecordStatus.ACTIVE,
      description: "Phú Quốc - Cần Thơ - Miền Tây sông nước.",
      avatar:
        "https://images.unsplash.com/photo-1704268391342-72363ec2b98c?auto=format&fit=crop&w=1600&q=90",
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const catAsia = await prisma.category.upsert({
    where: { slug: "tour-chau-a" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Châu Á",
      slug: "tour-chau-a",
      parentId: catInternational.id,
      position: 1,
      status: RecordStatus.ACTIVE,
      description:
        "Du lịch Châu Á với những điểm đến hàng đầu: Nhật Bản, Hàn Quốc, Singapore, Thái Lan.",
      avatar:
        "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1600&q=90",
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const catEurope = await prisma.category.upsert({
    where: { slug: "tour-chau-au" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      name: "Tour Châu Âu",
      slug: "tour-chau-au",
      parentId: catInternational.id,
      position: 2,
      status: RecordStatus.ACTIVE,
      description: "Pháp - Thụy Sĩ - Ý - Đức trọn gói.",
      avatar:
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=90",
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  // 4. Tours
  const tour1Images = [
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1787173824957-9b6cc293494a?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1734220476344-c165ecc8b5c1?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour1Schedules = [
    {
      title: "NGÀY 1 | ĐIỂM HẸN KHỞI HÀNH – THỦ ĐÔ HÀ NỘI",
      description:
        "Hướng dẫn viên đón khách tại điểm khởi hành (sân bay Tân Sơn Nhất / Đà Nẵng bay ra Nội Bài hoặc điểm hẹn trung tâm Hà Nội). Nhận phòng khách sạn 5 sao, tham quan Hồ Hoàn Kiếm, Đền Ngọc Sơn, Văn Miếu Quốc Tử Giám và thưởng thức ẩm thực phố cổ.",
    },
    {
      title: "NGÀY 2 | HÀ NỘI – TRÀNG AN – NINH BÌNH",
      description:
        "Khởi hành đi Ninh Bình, ngồi thuyền nan tham quan Quần thể Danh thắng Tràng An – Di sản Thiên nhiên & Văn hóa Thế giới, sau đó chiêm bái chùa Bái Đính uy nghiêm.",
    },
    {
      title: "NGÀY 3 | NINH BÌNH – VỊNH HẠ LONG",
      description:
        "Di chuyển tới Vịnh Hạ Long, lên du thuyền 5 sao thưởng thức bữa trưa hải sản, tham quan Hang Sửng Sốt, Đảo Titop và trải nghiệm hoàng hôn trên vịnh.",
    },
    {
      title: "NGÀY 4 | YÊN TỬ – CHÙA ĐỒNG – HÀ NỘI",
      description:
        "Ngắm bình minh trên Vịnh Hạ Long, trả phòng du thuyền. Buổi chiều hành hương lên non thiêng Yên Tử bằng cáp treo, viếng Chùa Hoa Yên và Chùa Đồng trên đỉnh núi.",
    },
    {
      title: "NGÀY 5 | HÀ NỘI – SAPA – BẢN CÁT CÁT",
      description:
        "Theo cao tốc Nội Bài – Lào Cai lên thị trấn Sapa mờ sương. Tham quan bản Cát Cát của đồng bào H'Mông, check-in thác Tiên Sa và tự do dạo chợ đêm Sapa.",
    },
    {
      title: "NGÀY 6 | CHINH PHỤC ĐỈNH FANSIPAN – TIỄN SÂN BAY",
      description:
        "Trải nghiệm tàu hỏa leo núi Mường Hoa và cáp treo chinh phục Nóc nhà Đông Dương Fansipan 3.143m. Chiều quay về Hà Nội ra sân bay Nội Bài kết thúc hành trình.",
    },
  ];

  const tour1 = await prisma.tour.upsert({
    where: { slug: "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d" },
    update: {
      images: tour1Images,
      schedules: tour1Schedules,
    },
    create: {
      code: "TOUR00001",
      name: "Tour Hà Nội - Ninh Bình - Hạ Long - Yên Tử - Sapa | 6N5D",
      slug: "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d",
      categoryId: catNorth.id,
      position: 1,
      status: RecordStatus.ACTIVE,
      avatar: tour1Images[0],
      images: tour1Images,
      priceAdult: 13650000,
      priceChild: 9500000,
      priceBaby: 4500000,
      priceNewAdult: 10000000,
      priceNewChild: 7990000,
      priceNewBaby: 3990000,
      stockAdult: 20,
      stockChild: 12,
      stockBaby: 6,
      locations: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng"],
      time: "6 Ngày 5 Đêm",
      vehicle: "Ô tô 45 chỗ & Máy bay",
      departureDate: new Date("2026-12-20T07:00:00.000Z"),
      information:
        "Khám phá hành trình di sản miền Bắc với tiêu chuẩn khách sạn 5 sao đẳng cấp, trải nghiệm du thuyền Vịnh Hạ Long, chinh phục đỉnh Fansipan Sapa và chiêm bái non thiêng Yên Tử.",
      schedules: tour1Schedules,
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const tour2Avatar =
    "https://images.unsplash.com/photo-1704268391342-72363ec2b98c?auto=format&fit=crop&w=1600&q=90";
  const tour2Images = [
    tour2Avatar,
    "https://images.unsplash.com/photo-1692892085515-e5771e7f2948?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1694682872053-1d75cd2c266a?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour2Schedules = [
    {
      title: "NGÀY 1 | ĐẾN PHÚ QUỐC – SUNSET TOWN – CẦU HÔN",
      description:
        "Đón đoàn tại sân bay Phú Quốc, nhận phòng resort sát biển. Buổi chiều check-in Thị trấn Hoàng Hôn (Sunset Town), dạo bước trên Cầu Hôn và thưởng thức show diễn nhạc nước Kiss of The Sea.",
    },
    {
      title: "NGÀY 2 | TOUR 4 ĐẢO – CÁP TREO HÒN THƠM",
      description:
        "Lên cano cao tốc khám phá 4 hòn đảo đẹp nhất Nam Đảo (Hòn Móng Tay, Hòn Gầm Ghì, Hòn Mây Rút), lặn ngắm san hô tự nhiên và trải nghiệm cáp treo 3 dây vượt biển Hòn Thơm.",
    },
    {
      title: "NGÀY 3 | GRAND WORLD – CHỢ DƯƠNG ĐÔNG – TIỄN BAY",
      description:
        "Tham quan Thành phố không ngủ Grand World, chùa Hộ Quốc và mua sắm đặc sản nước mắm, hồ tiêu Phú Quốc trước khi xe đưa đoàn ra sân bay làm thủ tục về lại đất liền.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "tour-phu-quoc-thien-duong-dao-ngoc-3n2d" },
    update: {
      avatar: tour2Avatar,
      images: tour2Images,
      schedules: tour2Schedules,
    },
    create: {
      code: "TOUR00002",
      name: "Tour Phú Quốc – Thiên Đường Đảo Ngọc (3N2Đ)",
      slug: "tour-phu-quoc-thien-duong-dao-ngoc-3n2d",
      categoryId: catSouth.id,
      position: 2,
      status: RecordStatus.ACTIVE,
      avatar: tour2Avatar,
      images: tour2Images,
      priceAdult: 6990000,
      priceChild: 4990000,
      priceBaby: 1990000,
      priceNewAdult: 4890000,
      priceNewChild: 3690000,
      priceNewBaby: 1490000,
      stockAdult: 25,
      stockChild: 15,
      stockBaby: 10,
      locations: ["Hà Nội", "Hồ Chí Minh"],
      time: "3 Ngày 2 Đêm",
      vehicle: "Máy bay Vietnam Airlines",
      departureDate: new Date("2026-12-24T06:00:00.000Z"),
      information:
        "Tận hưởng kỳ nghỉ dưỡng tại Đảo Ngọc Phú Quốc, đi cáp treo Hòn Thơm vượt biển và ngắm hoàng hôn tại Sunset Town.",
      schedules: tour2Schedules,
      createdById: adminA.id,
      updatedById: adminB.id,
    },
  });

  const tour3Images = [
    "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1733041449281-9f5c8cd67780?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1692892085515-e5771e7f2948?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour3Schedules = [
    {
      title: "NGÀY 1 | ĐÀ NẴNG – BÁN ĐẢO SƠN TRÀ – PHỐ CỔ HỘI AN",
      description:
        "Đón đoàn tại sân bay Đà Nẵng, nhận phòng khách sạn ven biển Mỹ Khê. Buổi chiều viếng chùa Linh Ứng Bãi Bụt, tham quan Ngũ Hành Sơn và thả đèn hoa đăng lung linh tại phố cổ Hội An về đêm.",
    },
    {
      title: "NGÀY 2 | BÀ NÀ HILLS – CẦU VÀNG – LÀNG PHÁP",
      description:
        "Khởi hành lên khu du lịch Sun World Bà Nà Hills, dạo bước trên Cầu Vàng nổi tiếng thế giới, check-in Làng Pháp cổ kính, Vườn hoa Le Jardin D'Amour và vui chơi tại Fantasy Park.",
    },
    {
      title: "NGÀY 3 | CÙ LAO CHÀM – RỪNG DỪA BẢY MẪU",
      description:
        "Trải nghiệm lặn ngắm san hô tại Khu dự trữ sinh quyển Cù Lao Chàm hoặc chèo thuyền thúng khám phá rừng dừa Bảy Mẫu. Tối tự do ngắm Cầu Rồng phun lửa, phun nước.",
    },
    {
      title: "NGÀY 4 | CHỢ HÀN – ĐẶC SẢN MIỀN TRUNG – TIỄN SÂN BAY",
      description:
        "Tự do tắm biển Mỹ Khê buổi sáng, tham quan cầu Tình Yêu và mua sắm đặc sản tại Chợ Hàn trước giờ ra sân bay Đà Nẵng đáp chuyến bay về.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "combo-da-nang-hoi-an-ba-na-hill" },
    update: {
      avatar: tour3Images[0],
      images: tour3Images,
      schedules: tour3Schedules,
    },
    create: {
      code: "TOUR00003",
      name: "Combo Đà Nẵng: ĐÀ NẴNG – HỘI AN – BÀ NÀ HILLS (4N3Đ)",
      slug: "combo-da-nang-hoi-an-ba-na-hill",
      categoryId: catCentral.id,
      position: 3,
      status: RecordStatus.ACTIVE,
      avatar: tour3Images[0],
      images: tour3Images,
      priceAdult: 5500000,
      priceChild: 4100000,
      priceBaby: 1500000,
      priceNewAdult: 3990000,
      priceNewChild: 2990000,
      priceNewBaby: 990000,
      stockAdult: 30,
      stockChild: 15,
      stockBaby: 8,
      locations: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng"],
      time: "4 Ngày 3 Đêm",
      vehicle: "Máy bay & Ô tô",
      departureDate: new Date("2026-12-28T07:30:00.000Z"),
      information:
        "Check-in Cầu Vàng Bà Nà Hills, thả đèn hoa đăng phố cổ Hội An và thưởng thức đặc sản miền Trung.",
      schedules: tour3Schedules,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  const tour4Images = [
    "https://images.unsplash.com/photo-1570366583862-f91883984fde?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1787173824957-9b6cc293494a?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour4Schedules = [
    {
      title: "NGÀY 1 | HÀ NỘI – SAPA – BẢN CÁT CÁT",
      description:
        "Xe giường nằm cao cấp đón khách tại Hà Nội, di chuyển theo cao tốc Nội Bài – Lào Cai đến Sapa. Chiều trekking nhẹ thăm Bản Cát Cát, tìm hiểu nghề dệt thổ cẩm truyền thống.",
    },
    {
      title: "NGÀY 2 | FANSIPAN LEGEND – NHÀ THỜ ĐÁ SAPA",
      description:
        "Chinh phục đỉnh Fansipan hùng vĩ bằng cáp treo hiện đại, săn biển mây và chiêm bái quần thể tâm linh trên đỉnh cao 3.143m. Tối thưởng thức lẩu cá tầm nóng hổi tại chợ đêm.",
    },
    {
      title: "NGÀY 3 | THUNG LŨNG MƯỜNG HOA – LAO CHẢI – TẢ VAN",
      description:
        "Ngắm ruộng bậc thang mùa lúa chín tuyệt đẹp dọc thung lũng Mường Hoa, giao lưu văn hóa bản địa tại Lao Chải – Tả Van và check-in Cầu Kính Rồng Mây.",
    },
    {
      title: "NGÀY 4 | NÚI HÀM RỒNG – CỬA KHẨU LÀO CAI – HÀ NỘI",
      description:
        "Dạo chơi vườn hoa Núi Hàm Rồng ngắm toàn cảnh thị trấn Sapa từ trên cao. Chiều ghé chợ Cốc Lếu (Lào Cai) mua sắm quà trước khi lên xe về lại Hà Nội.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "ha-noi-lao-cai-sapa-4n3d" },
    update: {
      images: tour4Images,
      schedules: tour4Schedules,
    },
    create: {
      code: "TOUR00004",
      name: "Hà Nội – Lào Cai – SaPa 4N3Đ",
      slug: "ha-noi-lao-cai-sapa-4n3d",
      categoryId: catNorth.id,
      position: 4,
      status: RecordStatus.ACTIVE,
      avatar: tour4Images[0],
      images: tour4Images,
      priceAdult: 4200000,
      priceChild: 3100000,
      priceBaby: 1200000,
      priceNewAdult: 2590000,
      priceNewChild: 1990000,
      priceNewBaby: 990000,
      stockAdult: 10,
      stockChild: 6,
      stockBaby: 4,
      locations: ["Hà Nội"],
      time: "4 Ngày 3 Đêm",
      vehicle: "Ô tô giường nằm cao cấp",
      departureDate: new Date("2026-12-22T06:30:00.000Z"),
      information: "Ưu đãi giờ chót khám phá Sapa - Bản Cát Cát - Thung lũng Mường Hoa - Đỉnh Fansipan.",
      schedules: tour4Schedules,
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const tour5Schedules = [
    {
      title: "NGÀY 1 | HÀ NỘI/TP.HCM – SÂN BAY NARITA (TOKYO)",
      description:
        "Tập trung tại sân bay quốc tế làm thủ tục đáp chuyến bay thẳng Vietnam Airlines tới Nhật Bản, nghỉ đêm trên máy bay.",
    },
    {
      title: "NGÀY 2 | TOKYO – CHÙA ASAKUSA – THÁP TOKYO SKYTREE",
      description:
        "Đáp sân bay Narita, tham quan ngôi cổ tự Asakusa Kannon (Sensoji), phố mua sắm Nakamise, chụp hình tháp Tokyo Skytree và dạo khu phố điện tử Akihabara.",
    },
    {
      title: "NGÀY 3 | NÚI PHÚ SĨ – LÀNG CỔ OSHINO HAKKAI – ONSEN",
      description:
        "Di chuyển tới Trạm 5 Núi Phú Sĩ ngắm cảnh hùng vĩ, tham quan làng cổ Oshino Hakkai thanh bình. Buổi tối thưởng thức cua tuyết và tắm suối khoáng nóng Onsen truyền thống.",
    },
    {
      title: "NGÀY 4 | TRẢI NGHIỆM SHINKANSEN – NAGOYA – KYOTO",
      description:
        "Trải nghiệm tàu cao tốc Shinkansen vận tốc 300km/h hướng về cố đô Kyoto, thăm Chùa Vàng Kinkakuji và rừng trúc Sagano thơ mộng.",
    },
    {
      title: "NGÀY 5 | KYOTO – OSAKA – LÂU ĐÀI OSAKA – SHINSAIBASHI",
      description:
        "Khám phá Chùa Thanh Thủy Kiyomizu-dera tại Kyoto trước khi sang Osaka tham quan Lâu đài Osaka và thỏa sức mua sắm tại thiên đường Shinsaibashi – Dotonbori.",
    },
    {
      title: "NGÀY 6 | SÂN BAY KANSAI – VIỆT NAM",
      description:
        "Dùng bữa sáng tại khách sạn, tự do mua quà lưu niệm và đáp chuyến bay từ sân bay quốc tế Kansai về lại Việt Nam.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "kham-pha-nhat-ban-tokyo-phu-si-kyoto" },
    update: {
      schedules: tour5Schedules,
    },
    create: {
      code: "TOUR00005",
      name: "Khám phá Nhật Bản: Tokyo - Núi Phú Sĩ - Kyoto 6N5Đ",
      slug: "kham-pha-nhat-ban-tokyo-phu-si-kyoto",
      categoryId: catAsia.id,
      position: 5,
      status: RecordStatus.ACTIVE,
      avatar:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=90",
      images: [
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=90",
      ],
      priceAdult: 32900000,
      priceChild: 27900000,
      priceBaby: 12000000,
      priceNewAdult: 28900000,
      priceNewChild: 24500000,
      priceNewBaby: 9900000,
      stockAdult: 18,
      stockChild: 8,
      stockBaby: 4,
      locations: ["Hà Nội", "Hồ Chí Minh"],
      time: "6 Ngày 5 Đêm",
      vehicle: "Vietnam Airlines",
      departureDate: new Date("2027-01-10T23:00:00.000Z"),
      information: "Trải nghiệm tàu Shinkansen, tắm suối khoáng Onsen và ngắm núi Phú Sĩ.",
      schedules: tour5Schedules,
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  const tour6Schedules = [
    {
      title: "NGÀY 1 | VIỆT NAM – SINGAPORE – JEWEL CHANGI",
      description:
        "Đáp sân bay Changi, chiêm ngưỡng thác nước trong nhà Rain Vortex tại Jewel Changi, tham quan Công viên Sư tử biển Merlion Park và nhà hát Esplanade.",
    },
    {
      title: "NGÀY 2 | GARDENS BY THE BAY – ĐẢO SENTOSA",
      description:
        "Tham quan khu vườn siêu cây Gardens by the Bay (Cloud Forest & Flower Dome), khám phá Thủy cung S.E.A Aquarium và thưởng thức show nhạc nước Wings of Time trên đảo Sentosa.",
    },
    {
      title: "NGÀY 3 | UNIVERSAL STUDIOS – ORCHARD ROAD",
      description:
        "Trọn ngày vui chơi tại công viên giải trí Universal Studios Singapore, chiều dạo phố mua sắm Orchard Road và khu Chinatown sầm uất.",
    },
    {
      title: "NGÀY 4 | MARINA BARRAGE – CHÙA RĂNG PHẬT – TIỄN BAY",
      description:
        "Check-in Đập nước Marina Barrage, viếng Chùa Răng Phật trang nghiêm trước khi ra sân bay Changi trở về Việt Nam.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "du-lich-singapore-dao-quoc-su-tu-4n3d" },
    update: {
      priceAdult: 12900000,
      priceChild: 10200000,
      priceBaby: 3900000,
      priceNewAdult: 12900000,
      priceNewChild: 10200000,
      priceNewBaby: 3900000,
      schedules: tour6Schedules,
    },
    create: {
      code: "TOUR00006",
      name: "Du lịch Singapore - Đảo Quốc Sư Tử 4N3Đ",
      slug: "du-lich-singapore-dao-quoc-su-tu-4n3d",
      categoryId: catAsia.id,
      position: 6,
      status: RecordStatus.ACTIVE,
      avatar:
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=90",
      images: [
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=90",
      ],
      priceAdult: 12900000,
      priceChild: 10200000,
      priceBaby: 3900000,
      priceNewAdult: 12900000,
      priceNewChild: 10200000,
      priceNewBaby: 3900000,
      stockAdult: 16,
      stockChild: 10,
      stockBaby: 5,
      locations: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng"],
      time: "4 Ngày 3 Đêm",
      vehicle: "Singapore Airlines",
      departureDate: new Date("2027-01-15T08:00:00.000Z"),
      information: "Check-in Jewel Changi, Gardens by the Bay, Universal Studios Sentosa.",
      schedules: tour6Schedules,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  // Europe Tour (Hot Deal)
  const tour8Images = [
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1545721264-23fdc0850396?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1531743579253-fa8d52993ba5?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour8Schedules = [
    {
      title: "NGÀY 1 | VIỆT NAM – PARIS (KINH ĐÔ ÁNH SÁNG)",
      description:
        "Đáp chuyến bay quốc tế tới Paris, xe đưa đoàn đi qua Đại lộ Champs-Élysées, Khải Hoàn Môn và du thuyền trên dòng sông Seine thơ mộng.",
    },
    {
      title: "NGÀY 2 | THÁP EIFFEL – BẢO TÀNG LOUVRE – MONTMARTRE",
      description:
        "Chụp hình lưu niệm tại Tháp Eiffel, tham quan Bảo tàng Louvre danh tiếng và dạo bước trên đồi nghệ sĩ Montmartre.",
    },
    {
      title: "NGÀY 3 | PARIS – STRASBOURG – COLMAR",
      description:
        "Rời Paris hướng về vùng Alsace cổ kính, dạo chơi khu phố cổ Petite France tại Strasbourg và thị trấn sắc màu Colmar.",
    },
    {
      title: "NGÀY 4 | LUCERNE – CHINH PHỤC ĐỈNH TITLIS (THỤY SĨ)",
      description:
        "Khám phá Cầu Gỗ Chapel Bridge tại Lucerne và đi cáp treo quay 360 độ Rotair lên đỉnh núi tuyết vĩnh cửu Titlis.",
    },
    {
      title: "NGÀY 5 | ZERMATT – DÃY ALPS – MILAN",
      description:
        "Chiêm ngưỡng ngọn núi biểu tượng Matterhorn hùng vĩ tại Zermatt, sau đó di chuyển sang kinh đô thời trang Milan tham quan Nhà thờ Duomo.",
    },
    {
      title: "NGÀY 6 | MILAN – TIỄN SÂN BAY – VIỆT NAM",
      description:
        "Mua sắm tại trung tâm Galleria Vittorio Emanuele II trước khi ra sân bay quốc tế Malpensa đáp chuyến bay về Việt Nam.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "tour-chau-au-phap-thuy-si-y-6n5d" },
    update: {
      avatar: tour8Images[0],
      images: tour8Images,
      schedules: tour8Schedules,
    },
    create: {
      code: "TOUR00008",
      name: "Tour Châu Âu: Pháp - Thụy Sĩ - Ý 6N5Đ",
      slug: "tour-chau-au-phap-thuy-si-y-6n5d",
      categoryId: catEurope.id,
      position: 7,
      status: RecordStatus.ACTIVE,
      avatar: tour8Images[0],
      images: tour8Images,
      priceAdult: 56900000,
      priceChild: 48900000,
      priceBaby: 19900000,
      priceNewAdult: 49900000,
      priceNewChild: 42900000,
      priceNewBaby: 16900000,
      stockAdult: 14,
      stockChild: 6,
      stockBaby: 3,
      locations: ["Hà Nội", "Hồ Chí Minh"],
      time: "6 Ngày 5 Đêm",
      vehicle: "Qatar Airways / Air France",
      departureDate: new Date("2027-02-05T09:00:00.000Z"),
      information:
        "Hành trình Châu Âu tinh gọn khám phá Paris hoa lệ, dãy Alps Thụy Sĩ phủ tuyết trắng và kinh đô thời trang Milan.",
      schedules: tour8Schedules,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  // Standard Full-Price Domestic Central Tour (Da Lat) so /tours?deal=true filters accurately & News cards match real tours
  const tour9Images = [
    "https://images.unsplash.com/photo-1652829792625-055eb9e877a3?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1643799297057-374040b7db1b?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour9Schedules = [
    {
      title: "NGÀY 1 | ĐẾN ĐÀ LẠT – QUẢNG TRƯỜNG LÂM VIÊN – HỒ XUÂN HƯƠNG",
      description:
        "Đón khách tại sân bay Liên Khương, nhận phòng homestay giữa rừng thông. Buổi chiều check-in Quảng trường Lâm Viên, dạo Hồ Xuân Hương và thưởng thức ẩm thực chợ đêm Đà Lạt.",
    },
    {
      title: "NGÀY 2 | SĂN MÂY CẦU ĐẤT – THÁC DATANLA – HỒ TUYỀN LÂM",
      description:
        "Sáng sớm săn biển mây tại đồi chè Cầu Đất, trưa trải nghiệm máng trượt xuyên rừng tại thác Datanla và chèo SUP ngắm hoàng hôn bên Hồ Tuyền Lâm.",
    },
    {
      title: "NGÀY 3 | VƯỜN HOA THÀNH PHỐ – ĐỒI MỘNG MƠ – TIỄN SÂN BAY",
      description:
        "Tham quan Thiền viện Trúc Lâm, mua sắm đặc sản mứt và cà phê Arabica trước khi ra sân bay Liên Khương trở về.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "tour-da-lat-ngan-hoa-san-may-3n2d" },
    update: {
      avatar: tour9Images[0],
      images: tour9Images,
      schedules: tour9Schedules,
    },
    create: {
      code: "TOUR00009",
      name: "Tour Đà Lạt Ngàn Hoa – Săn Mây Thác Datanla 3N2Đ",
      slug: "tour-da-lat-ngan-hoa-san-may-3n2d",
      categoryId: catCentral.id,
      position: 8,
      status: RecordStatus.ACTIVE,
      avatar: tour9Images[0],
      images: tour9Images,
      priceAdult: 3890000,
      priceChild: 2990000,
      priceBaby: 990000,
      priceNewAdult: 3890000,
      priceNewChild: 2990000,
      priceNewBaby: 990000,
      stockAdult: 22,
      stockChild: 10,
      stockBaby: 5,
      locations: ["Hồ Chí Minh", "Đà Nẵng", "Hà Nội"],
      time: "3 Ngày 2 Đêm",
      vehicle: "Máy bay & Xe du lịch",
      departureDate: new Date("2027-01-20T07:00:00.000Z"),
      information:
        "Trải nghiệm trekking rừng thông, săn mây Cầu Đất, chèo SUP Hồ Tuyền Lâm và nghỉ dưỡng homestay giữa thiên nhiên Đà Lạt.",
      schedules: tour9Schedules,
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  // Standard Full-Price Europe Tour (Switzerland)
  const tour10Images = [
    "https://images.unsplash.com/photo-1531743579253-fa8d52993ba5?auto=format&fit=crop&w=1600&q=90",
    "https://images.unsplash.com/photo-1545721264-23fdc0850396?auto=format&fit=crop&w=1600&q=90",
  ];
  const tour10Schedules = [
    {
      title: "NGÀY 1 | VIỆT NAM – ZURICH (THỤY SĨ)",
      description:
        "Đáp sân bay Zurich, nhận phòng khách sạn bên bờ hồ Zurich và tự do dạo phố cổ Altstadt thanh bình.",
    },
    {
      title: "NGÀY 2 | ZURICH – THUNG LŨNG LAUTERBRUNNEN – INTERLAKEN",
      description:
        "Chiêm ngưỡng thung lũng 72 thác nước Lauterbrunnen đẹp như cổ tích và dạo chơi thành phố du lịch Interlaken nằm giữa hai hồ Thun và Brienz.",
    },
    {
      title: "NGÀY 3 | CHINH PHỤC ĐỈNH JUNGFRAUJOCH – NÓC NHÀ CHÂU ÂU",
      description:
        "Trải nghiệm tuyến tàu răng cưa huyền thoại lên đỉnh Jungfraujoch cao 3.454m, tham quan Cung điện Băng vĩnh cửu.",
    },
    {
      title: "NGÀY 4 | ZERMATT – NGẮM NÚI MATTERHORN",
      description:
        "Di chuyển tới ngôi làng không khói bụi Zermatt bằng tàu hỏa ngắm cảnh qua dãy Alps và chiêm ngưỡng đỉnh Matterhorn biểu tượng.",
    },
    {
      title: "NGÀY 5 | ZERMATT – GENEVA – TIỄN SÂN BAY",
      description:
        "Ghé thăm Hồ Geneva và đài phun nước Jet d'Eau trước khi ra sân bay quốc tế Geneva bay về Việt Nam.",
    },
  ];

  await prisma.tour.upsert({
    where: { slug: "tour-thuy-si-alps-jungfraujoch-5n4d" },
    update: {
      avatar: tour10Images[0],
      images: tour10Images,
      schedules: tour10Schedules,
    },
    create: {
      code: "TOUR00010",
      name: "Tour Thụy Sĩ Cổ Tích: Zurich - Alps - Jungfraujoch 5N4Đ",
      slug: "tour-thuy-si-alps-jungfraujoch-5n4d",
      categoryId: catEurope.id,
      position: 9,
      status: RecordStatus.ACTIVE,
      avatar: tour10Images[0],
      images: tour10Images,
      priceAdult: 62500000,
      priceChild: 52500000,
      priceBaby: 21000000,
      priceNewAdult: 62500000,
      priceNewChild: 52500000,
      priceNewBaby: 21000000,
      stockAdult: 12,
      stockChild: 4,
      stockBaby: 2,
      locations: ["Hà Nội", "Hồ Chí Minh"],
      time: "5 Ngày 4 Đêm",
      vehicle: "Swiss International Air Lines",
      departureDate: new Date("2027-02-14T08:00:00.000Z"),
      information:
        "Hành trình cao cấp khám phá dãy Alps Thụy Sĩ, thung lũng Lauterbrunnen và tàu ngắm cảnh Glacier Express.",
      schedules: tour10Schedules,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });

  // Soft-deleted tour in Trash (for Phase 1 Trash page testing)
  await prisma.tour.upsert({
    where: { slug: "tour-ha-long-du-thuyen-5-sao-tam-xoa" },
    update: {
      avatar:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=90",
    },
    create: {
      code: "TOUR00007",
      name: "Tour Hạ Long - Du Thuyền 5 Sao (Mẫu trong thùng rác)",
      slug: "tour-ha-long-du-thuyen-5-sao-tam-xoa",
      categoryId: catNorth.id,
      position: 10,
      status: RecordStatus.INACTIVE,
      avatar:
        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=90",
      images: [],
      priceAdult: 3500000,
      priceChild: 2500000,
      priceBaby: 900000,
      priceNewAdult: 2990000,
      priceNewChild: 2190000,
      priceNewBaby: 790000,
      stockAdult: 15,
      stockChild: 8,
      stockBaby: 4,
      locations: ["Hà Nội"],
      time: "2 Ngày 1 Đêm",
      vehicle: "Ô tô 45 chỗ",
      departureDate: new Date("2026-12-30T07:00:00.000Z"),
      information: "Tour du thuyền vịnh Hạ Long mẫu đang ở trong thùng rác để test khôi phục.",
      schedules: [
        {
          title: "NGÀY 1 | HÀ NỘI – HẠ LONG",
          description: "Lên du thuyền ăn trưa, chèo kayak Hang Luồn.",
        },
        {
          title: "NGÀY 2 | VỊNH HẠ LONG – HÀ NỘI",
          description: "Ngắm bình minh trên boong tàu, dùng bữa trưa và xe đón về Hà Nội.",
        },
      ],
      deleted: true,
      deletedById: adminA.id,
      deletedAt: new Date(),
      createdById: adminA.id,
      updatedById: adminA.id,
    },
  });

  // 4B. Enrich OTA Metadata (Duration, Hotel Star, Tags, Route Waypoints) & Multi-Date TourDepartures
  const allToursForOta = await prisma.tour.findMany({
    select: {
      id: true,
      code: true,
      priceAdult: true,
      priceChild: true,
      priceBaby: true,
      priceNewAdult: true,
      priceNewChild: true,
      priceNewBaby: true,
      time: true,
      locations: true,
      deleted: true,
    },
  });

  const otaMetaByCode: Record<
    string,
    {
      durationDays: number;
      hotelStar: number;
      singleRoomSurcharge: number;
      tags: string[];
      airlineDefault: string;
      flightOutDefault: string;
      flightBackDefault: string;
      routeWaypoints: Array<{ day: number; label: string; lat: number; lng: number; note?: string }>;
      departureDates: string[];
    }
  > = {
    TOUR00001: {
      durationDays: 6,
      hotelStar: 5,
      singleRoomSurcharge: 2200000,
      tags: ["NO_SHOP", "GIA_DINH", "NGHI_DUONG"],
      airlineDefault: "Vietnam Airlines",
      flightOutDefault: "VN244 · 07:30",
      flightBackDefault: "VN257 · 19:20",
      routeWaypoints: [
        { day: 1, label: "Hà Nội", lat: 21.0285, lng: 105.8542, note: "Phố cổ & Văn Miếu" },
        { day: 2, label: "Tràng An – Ninh Bình", lat: 20.2506, lng: 105.9745, note: "Quần thể di sản Tràng An" },
        { day: 3, label: "Vịnh Hạ Long", lat: 20.9101, lng: 107.1839, note: "Du thuyền 5 sao" },
        { day: 4, label: "Yên Tử (Quảng Ninh)", lat: 21.1583, lng: 106.7161, note: "Chùa Đồng đỉnh núi" },
        { day: 5, label: "SaPa – Bản Cát Cát", lat: 22.3364, lng: 103.8438, note: "Chợ đêm SaPa" },
        { day: 6, label: "Đỉnh Fansipan 3.143m", lat: 22.3033, lng: 103.775, note: "Nóc nhà Đông Dương" },
      ],
      departureDates: ["2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27", "2027-01-10"],
    },
    TOUR00002: {
      durationDays: 3,
      hotelStar: 5,
      singleRoomSurcharge: 1400000,
      tags: ["BAY_THANG", "NGHI_DUONG", "GIA_DINH"],
      airlineDefault: "Vietnam Airlines",
      flightOutDefault: "VN1823 · 08:15",
      flightBackDefault: "VN1828 · 18:45",
      routeWaypoints: [
        { day: 1, label: "Sunset Town & Cầu Hôn", lat: 10.0329, lng: 104.0059, note: "Hoàng hôn Nam Đảo" },
        { day: 2, label: "Quần đảo An Thới – Hòn Thơm", lat: 9.9547, lng: 104.0176, note: "Cáp treo vượt biển & lặn san hô" },
        { day: 3, label: "Grand World – Dương Đông", lat: 10.3315, lng: 103.8548, note: "Thành phố không ngủ" },
      ],
      departureDates: ["2026-12-05", "2026-12-12", "2026-12-24", "2027-01-02", "2027-01-16"],
    },
    TOUR00003: {
      durationDays: 4,
      hotelStar: 4,
      singleRoomSurcharge: 1200000,
      tags: ["NO_SHOP", "BAY_THANG", "GIA_DINH"],
      airlineDefault: "Vietjet Air",
      flightOutDefault: "VJ505 · 07:45",
      flightBackDefault: "VJ522 · 20:10",
      routeWaypoints: [
        { day: 1, label: "Sơn Trà & Mỹ Khê", lat: 16.0544, lng: 108.2478, note: "Chùa Linh Ứng & biển" },
        { day: 2, label: "Bà Nà Hills – Cầu Vàng", lat: 15.9977, lng: 107.9881, note: "Làng Pháp trên mây" },
        { day: 3, label: "Cù Lao Chàm – Hội An", lat: 15.8801, lng: 108.338, note: "Phố cổ đèn lồng" },
        { day: 4, label: "Chợ Hàn – Đà Nẵng", lat: 16.0683, lng: 108.2244, note: "Đặc sản miền Trung" },
      ],
      departureDates: ["2026-12-07", "2026-12-18", "2026-12-28", "2027-01-08", "2027-01-22"],
    },
    TOUR00004: {
      durationDays: 4,
      hotelStar: 3,
      singleRoomSurcharge: 850000,
      tags: ["NO_SHOP", "KHUYEN_MAI"],
      airlineDefault: "Xe Limousine / Giường nằm",
      flightOutDefault: "Xuất phát 06:30 (Mỹ Đình)",
      flightBackDefault: "Về Hà Nội 20:30",
      routeWaypoints: [
        { day: 1, label: "Hà Nội – Bản Cát Cát", lat: 22.3279, lng: 103.8318, note: "Bản làng H'Mông" },
        { day: 2, label: "Đỉnh Fansipan", lat: 22.3033, lng: 103.775, note: "Săn mây 3.143m" },
        { day: 3, label: "Mường Hoa – Tả Van", lat: 22.3046, lng: 103.8902, note: "Ruộng bậc thang" },
        { day: 4, label: "Hàm Rồng – Lào Cai", lat: 22.4856, lng: 103.9707, note: "Cửa khẩu Lào Cai" },
      ],
      departureDates: ["2026-12-08", "2026-12-15", "2026-12-22", "2026-12-30"],
    },
    TOUR00005: {
      durationDays: 6,
      hotelStar: 5,
      singleRoomSurcharge: 3200000,
      tags: ["NO_SHOP", "BAY_THANG", "NGHI_DUONG"],
      airlineDefault: "Vietnam Airlines",
      flightOutDefault: "VN310 · 23:55",
      flightBackDefault: "VN321 · 10:30",
      routeWaypoints: [
        { day: 1, label: "Sân bay Quốc tế Narita", lat: 35.772, lng: 140.3929, note: "Đáp chuyến bay đêm" },
        { day: 2, label: "Tokyo – Asakusa & Skytree", lat: 35.7148, lng: 139.7967, note: "Cổ tự Sensoji" },
        { day: 3, label: "Núi Phú Sĩ – Oshino Hakkai", lat: 35.3606, lng: 138.7274, note: "Tắm Onsen truyền thống" },
        { day: 4, label: "Tàu Shinkansen – Kyoto", lat: 35.0394, lng: 135.7292, note: "Chùa Vàng Kinkakuji" },
        { day: 5, label: "Osaka Castle & Shinsaibashi", lat: 34.6873, lng: 135.5262, note: "Lâu đài Osaka" },
        { day: 6, label: "Sân bay Kansai (KIX)", lat: 34.4342, lng: 135.244, note: "Bay về Việt Nam" },
      ],
      departureDates: ["2026-12-18", "2026-12-26", "2027-01-10", "2027-01-24", "2027-02-08"],
    },
    TOUR00006: {
      durationDays: 4,
      hotelStar: 4,
      singleRoomSurcharge: 2400000,
      tags: ["BAY_THANG", "GIA_DINH"],
      airlineDefault: "Singapore Airlines",
      flightOutDefault: "SQ177 · 09:20",
      flightBackDefault: "SQ178 · 16:40",
      routeWaypoints: [
        { day: 1, label: "Jewel Changi & Merlion Park", lat: 1.3602, lng: 103.9898, note: "Thác nước Rain Vortex" },
        { day: 2, label: "Gardens by the Bay – Sentosa", lat: 1.2816, lng: 103.8636, note: "Cloud Forest & Wings of Time" },
        { day: 3, label: "Universal Studios & Orchard", lat: 1.254, lng: 103.8238, note: "Công viên điện ảnh" },
        { day: 4, label: "Marina Barrage – Chinatown", lat: 1.2805, lng: 103.8708, note: "Chùa Răng Phật" },
      ],
      departureDates: ["2026-12-11", "2026-12-23", "2027-01-15", "2027-01-29"],
    },
    TOUR00008: {
      durationDays: 6,
      hotelStar: 5,
      singleRoomSurcharge: 4500000,
      tags: ["NO_SHOP", "NGHI_DUONG"],
      airlineDefault: "Qatar Airways / Air France",
      flightOutDefault: "AF253 · 22:15",
      flightBackDefault: "AF258 · 13:30",
      routeWaypoints: [
        { day: 1, label: "Paris – Champs-Élysées", lat: 48.8698, lng: 2.3078, note: "Du thuyền sông Seine" },
        { day: 2, label: "Tháp Eiffel & Louvre", lat: 48.8584, lng: 2.2945, note: "Đồi Montmartre" },
        { day: 3, label: "Strasbourg – Colmar", lat: 48.0794, lng: 7.3585, note: "Vùng Alsace cổ tích" },
        { day: 4, label: "Lucerne – Đỉnh Titlis", lat: 46.772, lng: 8.4378, note: "Cáp treo quay 360 độ" },
        { day: 5, label: "Zermatt – Milan Duomo", lat: 45.4641, lng: 9.1919, note: "Matterhorn & kinh đô thời trang" },
        { day: 6, label: "Milan Malpensa", lat: 45.6301, lng: 8.7255, note: "Kết thúc hành trình" },
      ],
      departureDates: ["2026-12-20", "2027-01-14", "2027-02-05", "2027-02-19"],
    },
    TOUR00009: {
      durationDays: 3,
      hotelStar: 4,
      singleRoomSurcharge: 950000,
      tags: ["NO_SHOP", "GIA_DINH", "NGHI_DUONG"],
      airlineDefault: "Bamboo Airways",
      flightOutDefault: "QH1322 · 08:40",
      flightBackDefault: "QH1325 · 17:15",
      routeWaypoints: [
        { day: 1, label: "Hồ Xuân Hương – Lâm Viên", lat: 11.9404, lng: 108.4583, note: "Chợ đêm Đà Lạt" },
        { day: 2, label: "Đồi chè Cầu Đất – Datanla", lat: 11.8891, lng: 108.5327, note: "Săn mây & chèo SUP Tuyền Lâm" },
        { day: 3, label: "Thiền viện Trúc Lâm", lat: 11.9035, lng: 108.4357, note: "Vườn hoa thành phố" },
      ],
      departureDates: ["2026-12-10", "2026-12-19", "2027-01-03", "2027-01-20"],
    },
    TOUR00010: {
      durationDays: 5,
      hotelStar: 5,
      singleRoomSurcharge: 4800000,
      tags: ["NO_SHOP", "NGHI_DUONG"],
      airlineDefault: "Swiss International Air Lines",
      flightOutDefault: "LX193 · 21:40",
      flightBackDefault: "LX189 · 14:20",
      routeWaypoints: [
        { day: 1, label: "Zurich – Phố cổ Altstadt", lat: 47.3769, lng: 8.5417, note: "Hồ Zurich" },
        { day: 2, label: "Lauterbrunnen – Interlaken", lat: 46.5935, lng: 7.9091, note: "Thung lũng 72 thác nước" },
        { day: 3, label: "Đỉnh Jungfraujoch 3.454m", lat: 46.5475, lng: 7.9851, note: "Nóc nhà Châu Âu" },
        { day: 4, label: "Làng tuyết Zermatt", lat: 46.0207, lng: 7.7491, note: "Ngắm đỉnh Matterhorn" },
        { day: 5, label: "Hồ Geneva", lat: 46.2044, lng: 6.1432, note: "Đài phun nước Jet d'Eau" },
      ],
      departureDates: ["2026-12-24", "2027-01-18", "2027-02-14", "2027-02-26"],
    },
  };

  for (const t of allToursForOta) {
    const meta = otaMetaByCode[t.code];
    if (!meta || t.deleted) continue;

    await prisma.tour.update({
      where: { id: t.id },
      data: {
        durationDays: meta.durationDays,
        hotelStar: meta.hotelStar,
        singleRoomSurcharge: meta.singleRoomSurcharge,
        tags: meta.tags,
        routeWaypoints: meta.routeWaypoints,
      },
    });

    const tourLocs = Array.isArray(t.locations) && t.locations.length > 0
      ? t.locations.map(String)
      : ["Hà Nội"];

    for (let idx = 0; idx < meta.departureDates.length; idx++) {
      const startIso = meta.departureDates[idx];
      const depDate = new Date(`${startIso}T07:00:00.000Z`);
      const retDate = new Date(depDate.getTime() + (meta.durationDays - 1) * 86400000);
      const depLoc = tourLocs[idx % tourLocs.length] || "Hà Nội";
      const depCode = `${t.code}-${startIso.replace(/-/g, "").slice(4)}`;
      const isPeak = idx === 2;
      const surchargeFactor = isPeak ? 1.05 : 1;
      const stockA = idx === 0 ? 3 : idx === 1 ? 8 : 16 + idx * 2;

      await prisma.tourDeparture.upsert({
        where: { code: depCode },
        update: {
          departureDate: depDate,
          returnDate: retDate,
          departureLocation: depLoc,
          airline: meta.airlineDefault,
          flightOut: meta.flightOutDefault,
          flightBack: meta.flightBackDefault,
          hotelStar: meta.hotelStar,
          singleRoomSurcharge: meta.singleRoomSurcharge,
        },
        create: {
          tourId: t.id,
          code: depCode,
          departureDate: depDate,
          returnDate: retDate,
          departureLocation: depLoc,
          airline: meta.airlineDefault,
          flightOut: meta.flightOutDefault,
          flightBack: meta.flightBackDefault,
          hotelStar: meta.hotelStar,
          priceAdult: Math.round((t.priceAdult * surchargeFactor) / 10000) * 10000,
          priceChild: Math.round((t.priceChild * surchargeFactor) / 10000) * 10000,
          priceBaby: Math.round((t.priceBaby * surchargeFactor) / 10000) * 10000,
          priceNewAdult: Math.round((t.priceNewAdult * surchargeFactor) / 10000) * 10000,
          priceNewChild: Math.round((t.priceNewChild * surchargeFactor) / 10000) * 10000,
          priceNewBaby: Math.round((t.priceNewBaby * surchargeFactor) / 10000) * 10000,
          singleRoomSurcharge: meta.singleRoomSurcharge,
          stockAdult: stockA,
          stockChild: Math.max(2, Math.floor(stockA / 2)),
          stockBaby: Math.max(1, Math.floor(stockA / 3)),
          status: RecordStatus.ACTIVE,
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await syncTourSummaryFromDepartures(tx, t.id);
    });
  }

  // 5. Sample Customer Account (for Customer Auth & Order History)
  const seededUser = await prisma.user.upsert({
    where: { email: "levana@gmail.com" },
    update: {
      password: hashedPassword,
      provider: "CREDENTIALS",
      phone: "0123456789",
    },
    create: {
      fullName: "Lê Văn A",
      email: "levana@gmail.com",
      phone: "0123456789",
      address: "Số 123, đường ABC, Hà Nội",
      avatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=90",
      password: hashedPassword,
      provider: "CREDENTIALS",
      status: RecordStatus.ACTIVE,
    },
  });

  // 6. Sample Orders (for Phase 3 & Customer Order History)
  await prisma.order.upsert({
    where: { code: "OD000001" },
    update: { userId: seededUser.id },
    create: {
      code: "OD000001",
      userId: seededUser.id,
      fullName: "Lê Văn A",
      phone: "0123456789",
      note: "Test...",
      subTotal: 10000000,
      discount: 400000,
      couponCode: "TOURMUAHE2024",
      total: 9600000,
      paymentMethod: PaymentMethod.MOMO,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.INITIAL,
      items: {
        create: [
          {
            tourId: tour1.id,
            name: tour1.name,
            avatar: tour1.avatar,
            departureDate: tour1.departureDate,
            departureLocation: "Hà Nội",
            quantityAdult: 1,
            priceNewAdult: 10000000,
            quantityChild: 0,
            priceNewChild: 7990000,
            quantityBaby: 0,
            priceNewBaby: 3990000,
          },
        ],
      },
    },
  });

  await prisma.order.upsert({
    where: { code: "OD000002" },
    update: { userId: seededUser.id },
    create: {
      code: "OD000002",
      userId: seededUser.id,
      fullName: "Nguyễn Thị B",
      phone: "0912345678",
      note: "Yêu cầu phòng view biển",
      subTotal: 17990000,
      discount: 0,
      total: 17990000,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.APPROVED,
      items: {
        create: [
          {
            tourId: tour1.id,
            name: tour1.name,
            avatar: tour1.avatar,
            departureDate: tour1.departureDate,
            departureLocation: "Hồ Chí Minh",
            quantityAdult: 1,
            priceNewAdult: 10000000,
            quantityChild: 1,
            priceNewChild: 7990000,
            quantityBaby: 0,
            priceNewBaby: 3990000,
          },
        ],
      },
    },
  });

  await prisma.order.upsert({
    where: { code: "OD000003" },
    update: {},
    create: {
      code: "OD000003",
      fullName: "Trần Văn C",
      phone: "0988112233",
      note: "Khách đổi lịch bay",
      subTotal: 10000000,
      discount: 0,
      total: 10000000,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.UNPAID,
      status: OrderStatus.CANCELLED,
      items: {
        create: [
          {
            tourId: tour1.id,
            name: tour1.name,
            avatar: tour1.avatar,
            departureDate: tour1.departureDate,
            departureLocation: "Hà Nội",
            quantityAdult: 1,
            priceNewAdult: 10000000,
            quantityChild: 0,
            priceNewChild: 7990000,
            quantityBaby: 0,
            priceNewBaby: 3990000,
          },
        ],
      },
    },
  });

  // 7. Contacts & WebsiteInfo

  const existingContacts = await prisma.contact.count();
  if (existingContacts === 0) {
    await prisma.contact.create({
      data: { email: "levana@gmail.com" },
    });
  }

  await prisma.websiteInfo.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      websiteName: "VN.TRAVEL",
      phone: "1900 6868",
      email: "contact@vn.travel.com",
      address: "285 Cách Mạng Tháng Tám, Quận 10, TP.HCM",
    },
  });

  // 8. Additional Customer Profiles & Sample Tour Reviews (with AI Review Summaries)
  const reviewerMinhAnh = await prisma.user.upsert({
    where: { email: "minhanh.google@gmail.com" },
    update: {},
    create: {
      fullName: "Nguyễn Minh Anh",
      email: "minhanh.google@gmail.com",
      phone: "0934567890",
      address: "Quận Cầu Giấy, Hà Nội",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
      provider: "GOOGLE",
      status: RecordStatus.ACTIVE,
    },
  });

  const reviewerQuocBao = await prisma.user.upsert({
    where: { email: "quocbao.travel@gmail.com" },
    update: {},
    create: {
      fullName: "Trần Quốc Bảo",
      email: "quocbao.travel@gmail.com",
      phone: "0977654321",
      address: "Quận 3, TP. Hồ Chí Minh",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      provider: "GOOGLE",
      status: RecordStatus.ACTIVE,
    },
  });

  const seededTours = await prisma.tour.findMany({
    where: {
      slug: {
        in: [
          "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d",
          "tour-phu-quoc-thien-duong-dao-ngoc-3n2d",
          "combo-da-nang-hoi-an-ba-na-hill",
          "ha-noi-lao-cai-sapa-4n3d",
        ],
      },
    },
    select: { id: true, slug: true, name: true },
  });
  const tourBySlug = new Map(seededTours.map((t) => [t.slug, t]));

  const seedReviews: Array<{
    id: string;
    slug: string;
    userId: string;
    rating: number;
    comment: string;
    isVerifiedBooking: boolean;
    aiSentiment: string;
    adminReply?: string;
    repliedById?: string;
  }> = [
    {
      id: "seed-review-1",
      slug: "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d",
      userId: seededUser.id,
      rating: 5,
      comment:
        "Lịch trình đi từ Ninh Bình, Hạ Long qua Sapa rất hợp lý. Hướng dẫn viên cực kỳ nhiệt tình, chu đáo hỗ trợ đoàn lớn tuổi suốt chuyến đi, khách sạn sạch sẽ và đồ ăn ngon.",
      isVerifiedBooking: true,
      aiSentiment: "POSITIVE",
      adminReply:
        "VN.TRAVEL cảm ơn anh Lê Văn A đã tin tưởng đồng hành cùng chuyến hành trình Di sản Miền Bắc! Hẹn gặp lại anh trong các tour tiếp theo.",
      repliedById: adminA.id,
    },
    {
      id: "seed-review-2",
      slug: "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d",
      userId: reviewerMinhAnh.id,
      rating: 5,
      comment:
        "Du thuyền Vịnh Hạ Long buổi sáng ngắm bình minh đẹp xuất sắc. Chuyến đi Fansipan có hướng dẫn viên sắp xếp vé cáp treo nhanh gọn nên không phải chờ lâu.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-3",
      slug: "tour-ha-noi-ninh-binh-ha-long-yen-tu-sapa-6n5d",
      userId: reviewerQuocBao.id,
      rating: 4,
      comment:
        "Tổng thể rất đáng tiền, xe di chuyển êm ái. Duy chỉ có ngày leo Yên Tử lịch trình hơi gấp nếu đi cùng trẻ nhỏ, còn lại bữa ăn đặc sản và khách sạn đều hài lòng.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-4",
      slug: "combo-da-nang-hoi-an-ba-na-hill",
      userId: reviewerMinhAnh.id,
      rating: 5,
      comment:
        "Combo Đà Nẵng - Hội An giá quá hợp lý so với chất lượng! Khách sạn gần biển Mỹ Khê đi bộ rất tiện, buổi tối thả đèn hoa đăng ở Hội An siêu lung linh.",
      isVerifiedBooking: true,
      aiSentiment: "POSITIVE",
      adminReply:
        "Cảm ơn Minh Anh đã chia sẻ trải nghiệm tuyệt vời tại Đà Nẵng – Hội An! Chúc bạn luôn có những kỳ nghỉ đáng nhớ cùng VN.TRAVEL.",
      repliedById: adminA.id,
    },
    {
      id: "seed-review-5",
      slug: "combo-da-nang-hoi-an-ba-na-hill",
      userId: reviewerQuocBao.id,
      rating: 5,
      comment:
        "Hướng dẫn viên vui tính, chụp ảnh có tâm cho cả đoàn trên Cầu Vàng Bà Nà Hills. Bữa tối hải sản tươi ngon, tài xế đón tiễn sân bay đúng giờ.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-6",
      slug: "combo-da-nang-hoi-an-ba-na-hill",
      userId: seededUser.id,
      rating: 4,
      comment:
        "Cầu Vàng buổi sáng cuối tuần hơi đông một chút nhưng cảnh đẹp mãn nhãn. Lịch trình lặn ngắm san hô Cù Lao Chàm rất vui và an toàn.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-7",
      slug: "tour-phu-quoc-thien-duong-dao-ngoc-3n2d",
      userId: reviewerQuocBao.id,
      rating: 5,
      comment:
        "Tour 4 đảo Phú Quốc đi cano siêu thích, nước biển trong vắt, san hô đẹp. Sunset Town và show Kiss of The Sea buổi tối thật sự ấn tượng!",
      isVerifiedBooking: true,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-8",
      slug: "tour-phu-quoc-thien-duong-dao-ngoc-3n2d",
      userId: reviewerMinhAnh.id,
      rating: 5,
      comment:
        "Resort view biển đẹp, phòng ốc tiện nghi sạch sẽ. Hướng dẫn viên bản địa am hiểu, giới thiệu quán ăn đặc sản giá hợp lý không bị chặt chém.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
    {
      id: "seed-review-9",
      slug: "ha-noi-lao-cai-sapa-4n3d",
      userId: seededUser.id,
      rating: 5,
      comment:
        "Săn mây đỉnh Fansipan quá đã, xe giường nằm cao cấp sạch sẽ và chạy đúng giờ. Giá ưu đãi rất phù hợp cho nhóm bạn trẻ hoặc sinh viên.",
      isVerifiedBooking: false,
      aiSentiment: "POSITIVE",
    },
  ];

  const touchedTourIds = new Set<string>();
  for (const item of seedReviews) {
    const t = tourBySlug.get(item.slug);
    if (!t) continue;
    touchedTourIds.add(t.id);

    await prisma.review.upsert({
      where: { id: item.id },
      update: {
        rating: item.rating,
        comment: item.comment,
        isVerifiedBooking: item.isVerifiedBooking,
        aiSentiment: item.aiSentiment,
        adminReply: item.adminReply ?? null,
        repliedAt: item.adminReply ? new Date() : null,
        repliedById: item.repliedById ?? null,
        status: RecordStatus.ACTIVE,
        deleted: false,
      },
      create: {
        id: item.id,
        tourId: t.id,
        userId: item.userId,
        rating: item.rating,
        comment: item.comment,
        isVerifiedBooking: item.isVerifiedBooking,
        aiSentiment: item.aiSentiment,
        adminReply: item.adminReply ?? null,
        repliedAt: item.adminReply ? new Date() : null,
        repliedById: item.repliedById ?? null,
        status: RecordStatus.ACTIVE,
      },
    });
  }

  for (const tourId of touchedTourIds) {
    const tourInfo = await prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true, name: true },
    });
    if (!tourInfo) continue;

    const activeReviews = await prisma.review.findMany({
      where: { tourId, deleted: false, status: RecordStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: { rating: true, comment: true, isVerifiedBooking: true },
    });

    const reviewCount = activeReviews.length;
    const ratingAvg =
      reviewCount > 0
        ? Number(
            (
              activeReviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
            ).toFixed(1)
          )
        : 5.0;

    const aiSummary = await buildTourReviewSummary(tourInfo.name, activeReviews);

    await prisma.tour.update({
      where: { id: tourId },
      data: {
        ratingAvg,
        reviewCount,
        aiReviewSummary: aiSummary
          ? (aiSummary as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  }

  // 9. Travel News & Guides (NewsArticle)
  const sampleNews = [
    {
      slug: "top-5-diem-check-in-doc-dao-tai-singapore",
      title: "Top 5 điểm check in độc đáo tại Singapore",
      category: "Điểm đến hot",
      excerpt:
        "Nếu bạn nghĩ du lịch Singapore rất nhàm chán vì chỉ mãi quanh quẩn trong những khối bê tông vô cảm thì bạn “chắc chưa?”. Tuy đảo quốc Sư Tử không phải là một quốc gia rộng lớn nhưng các địa điểm du lịch tại Singapore chưa từng đánh mất sức hút đối với cộng đồng xê dịch quốc tế.",
      avatar:
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=85",
      featured: true,
      views: 1840,
      relatedDestination: "Singapore",
      position: 1,
      publishedAt: new Date("2026-11-15T08:00:00.000Z"),
      content: `Singapore luôn nằm trong nhóm điểm đến được săn đón nhiều nhất Đông Nam Á nhờ sự giao thoa ấn tượng giữa kiến trúc tương lai, mảng xanh sinh thái và văn hóa đa sắc tộc. Dưới đây là 5 tọa độ check-in không thể bỏ lỡ khi đặt chân tới Đảo Quốc Sư Tử.

## 1. Jewel Changi Airport & Thác nước Rain Vortex
Ngay khi vừa hạ cánh tại sân bay Changi, bạn sẽ choáng ngợp trước thác nước trong nhà cao nhất thế giới Rain Vortex (40m) nằm giữa khu rừng nhiệt đới Shiseido Forest Valley.
- Thời điểm đẹp nhất để chụp ảnh: 19h30 – 21h00 khi diễn ra màn trình diễn ánh sáng và nhạc nước miễn phí.
- Mẹo nhỏ: Đừng quên ghé tầng trên Canopy Park để săn góc toàn cảnh từ cầu kính.

## 2. Gardens by the Bay & Cloud Forest
Khu vườn siêu cây Supertree Grove là biểu tượng xanh nổi tiếng bậc nhất của Singapore. Bên trong nhà kính Cloud Forest là thế giới thực vật vùng cao phủ đầy sương mờ mát lạnh quanh năm.

## 3. Khu phố sắc màu Haji Lane & Kampong Glam
Nằm cách trung tâm Marina Bay chỉ 10 phút đi MRT, Haji Lane gây thương nhớ với những bức tường graffiti rực rỡ, tiệm cà phê thủ công và boutique thời trang độc bản.

## 4. Sentosa & Universal Studios Singapore
Nếu đi cùng gia đình hoặc nhóm bạn trẻ, hãy dành trọn 1 ngày vui chơi tại công viên giải trí Universal Studios và dạo hoàng hôn bên bãi biển Siloso.

## 5. Marina Bay Sands SkyPark về đêm
Đứng trên boong quan sát tầng 57 nhìn xuống vịnh Marina rực sáng ánh đèn là cái kết hoàn hảo cho mọi hành trình khám phá Singapore 4N3Đ cùng VN.TRAVEL.`,
    },
    {
      slug: "homestay-co-tich-giua-da-lat-mong-mo",
      title: "Homestay “cổ tích” giữa Đà Lạt mộng mơ",
      category: "Cẩm nang du lịch",
      excerpt:
        "Tổng hợp những căn homestay gỗ ẩn mình dưới rừng thông Đà Lạt, ban công đón mây sớm và view thung lũng bình yên cho kỳ nghỉ 3N2Đ.",
      avatar:
        "https://images.unsplash.com/photo-1643799297057-374040b7db1b?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 1290,
      relatedDestination: "Đà Lạt",
      position: 2,
      publishedAt: new Date("2026-11-12T08:00:00.000Z"),
      content: `Đà Lạt cuối thu đầu đông mang theo tiết trời se lạnh 15–19°C, sương giăng nhẹ mỗi sáng sớm — thời điểm lý tưởng nhất để chọn một căn homestay gỗ nằm tách khỏi nhịp phố ồn ào.

## Khu vực nào đáng ở nhất khi đi Đà Lạt?
Tùy phong cách nghỉ dưỡng, bạn có thể cân nhắc 3 khu vực sau:
- Khu đồi Đa Phú / Trại Mát: Rất tiện săn mây Cầu Đất từ 5h sáng, yên tĩnh tuyệt đối.
- Khu vực Hồ Tuyền Lâm: Bao quanh bởi rừng thông nguyên sinh, thích hợp chèo SUP và nghỉ dưỡng kết hợp trekking.
- Khu dốc Nhà Bò / Đống Đa: Gần trung tâm nhưng vẫn giữ được tầm nhìn thung lũng đèn lồng lung linh về đêm.

## Kinh nghiệm đặt phòng & giữ giá tốt mùa cao điểm
Bạn nên đặt phòng trước ít nhất 2–3 tuần, kiểm tra kỹ hệ thống nước nóng và khoảng cách di chuyển vào trung tâm (tránh các đoạn hẻm quá dốc nếu đi nhóm có trẻ nhỏ hoặc người lớn tuổi).`,
    },
    {
      slug: "dao-phu-quy-binh-thuan-hot-trend-nam-2026",
      title: "Đảo Phú Quý Bình Thuận hot trend năm 2026",
      category: "Điểm đến hot",
      excerpt:
        "Hòn đảo nhỏ giữa biển Đông với nước biển xanh ngọc bích, Gành Hang hùng vĩ và chi phí khám phá cực kỳ dễ chịu trong năm 2026.",
      avatar:
        "https://images.unsplash.com/photo-1692892085515-e5771e7f2948?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 1520,
      relatedDestination: "Phú Quốc",
      position: 3,
      publishedAt: new Date("2026-11-08T08:00:00.000Z"),
      content: `Du lịch biển đảo 2026 chứng kiến sự bùng nổ của những vùng biển giữ nguyên vẻ đẹp mộc mạc, trong đó Đảo Phú Quý và Đảo Ngọc Phú Quốc là hai cái tên dẫn đầu xu hướng.

## Vì sao biển đảo phía Nam hút khách trở lại?
- Biển trong vắt tầm nhìn san hô nông từ tháng 3 đến tháng 9, ít mưa bão.
- Hải sản tươi đánh bắt trong ngày như cua huỳnh đế, cá mú đỏ, mực nháy với mức giá minh bạch.
- Kết hợp trải nghiệm thể thao biển: chèo kayak, lặn ngắm san hô và đón hoàng hôn tại Sunset Town hoặc Mũi Dinh Thầy.

## Chuẩn bị gì trước khi ra đảo?
Luôn kiểm tra dự báo sóng biển trước 3 ngày khởi hành, mang theo kem chống nắng rạn san hô (reef-safe) và thuốc say tàu nếu di chuyển bằng tàu cao tốc.`,
    },
    {
      slug: "dac-san-khong-the-bo-qua-khi-den-voi-da-nang-hoi-an",
      title: "Đặc sản không thể bỏ qua khi đến với Đà Nẵng – Hội An",
      category: "Ẩm thực",
      excerpt:
        "Từ mì Quảng, bánh tráng cuốn thịt heo ở Đà Nẵng đến cao lầu, cơm gà phố Hội — bản đồ ẩm thực chuẩn vị bản địa cho tín đồ xê dịch.",
      avatar:
        "https://images.unsplash.com/photo-1733041449281-9f5c8cd67780?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 1180,
      relatedDestination: "Đà Nẵng",
      position: 4,
      publishedAt: new Date("2026-11-04T08:00:00.000Z"),
      content: `Một chuyến đi Đà Nẵng – Hội An sẽ chỉ trọn vẹn một nửa nếu bạn chưa dành thời gian dạo chợ đêm và thưởng thức tinh hoa ẩm thực miền Trung.

## Danh sách món ngon nhất định phải thử
- Mì Quảng ếch / tôm thịt: Sợi mì dày dai, nước dùng sâm sấp đậm đà ăn kèm bánh tráng nướng giòn rụm.
- Bánh tráng cuốn thịt heo hai đầu da: Điểm nhấn nằm ở chén mắm nêm pha thơm tỏi ớt đặc trưng xứ Quảng.
- Cao lầu Hội An: Sợi mì vàng ươm từ nước tro Cù Lao Chàm kết hợp thịt xá xíu thái mỏng và tóp mỡ giòn tan.
- Nước Mót thảo mộc & chè bắp Cẩm Nam: Thức uống giải nhiệt hoàn hảo khi dạo phố đèn lồng buổi tối.

## Lịch trình kết hợp tham quan – ăn uống hợp lý
Buổi sáng lên Bà Nà Hills check-in Cầu Vàng, chiều về biển Mỹ Khê thưởng thức hải sản và tối sang Hội An thả hoa đăng trên sông Hoài.`,
    },
    {
      slug: "trekking-cam-trai-tai-da-lat-cam-nhan-qua-tung-buoc-chan",
      title: "Trekking cắm trại tại Đà Lạt – Cảm nhận Đà Lạt qua từng bước chân",
      category: "Cẩm nang du lịch",
      excerpt:
        "Trải nghiệm đi bộ xuyên rừng thông nguyên sinh, dựng lều đón bình minh trên đồi cỏ hồng và thưởng thức BBQ giữa sương đêm cao nguyên.",
      avatar:
        "https://images.unsplash.com/photo-1652829792625-055eb9e877a3?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 980,
      relatedDestination: "Đà Lạt",
      position: 5,
      publishedAt: new Date("2026-11-01T08:00:00.000Z"),
      content: `Nếu đã quá quen với chợ đêm hay các quán cà phê đông đúc, trekking cắm trại là cách hoàn toàn khác để lắng nghe nhịp thở bình yên của cao nguyên Lâm Viên.

## 3 cung trekking phù hợp cho người mới bắt đầu
- Cung Đỉnh Pinhatt – Hồ Tuyền Lâm: Quãng đường 6–8km vừa sức, đỉnh núi nhìn toàn cảnh mặt hồ và dãy Langbiang.
- Cung Cầu Đất – Đồi chè săn mây: Khởi hành 4h30 sáng, ngắm biển mây cuồn cuộn dưới ánh bình minh.
- Thác Datanla & suối rừng Tà Nung: Không khí trong lành, nhiều điểm nghỉ chân ngắm suối mát.

## Lưu ý an toàn khi cắm trại qua đêm
Luôn đi cùng hướng dẫn viên địa phương thông thuộc địa hình, mang áo giữ nhiệt chống gió ẩm (vì nhiệt độ ban đêm có thể xuống 13°C) và thu gom sạch rác trước khi rời bãi trại.`,
    },
    {
      slug: "kinh-nghiem-du-lich-nhat-ban-mua-la-do-va-nui-phu-si",
      title: "Kinh nghiệm du lịch Nhật Bản mùa lá đỏ & ngắm núi Phú Sĩ",
      category: "Kinh nghiệm săn tour",
      excerpt:
        "Bí quyết chọn thời điểm ngắm lá phong Momiji đẹp nhất, di chuyển tàu siêu tốc Shinkansen và chuẩn bị hành lý thông minh cho tour 6N5Đ.",
      avatar:
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 2150,
      relatedDestination: "Nhật Bản",
      position: 6,
      publishedAt: new Date("2026-10-28T08:00:00.000Z"),
      content: `Cung đường vàng Tokyo – Núi Phú Sĩ – Kyoto – Osaka luôn là ước mơ của nhiều du khách Việt, đặc biệt từ cuối tháng 10 đến đầu tháng 12 khi sắc đỏ Momiji phủ kín cố đô.

## Chuẩn bị Visa & thủ tục nhập cảnh
- Nên nộp hồ sơ visa trước ngày khởi hành ít nhất 3–4 tuần để kịp lịch săn vé máy bay giá tốt.
- Đặt theo tour trọn gói VN.TRAVEL sẽ được hỗ trợ trọn bộ checklist hồ sơ chứng minh công việc, tài chính nhanh gọn.

## Trải nghiệm không thể bỏ lỡ trên cung đường vàng
- Ngồi tàu siêu tốc Shinkansen vận tốc 300km/h lướt qua vùng đồng bằng dưới chân núi Phú Sĩ.
- Thư giãn tắm suối khoáng nóng Onsen truyền thống tại khu vực Hakone / Kawaguchiko.
- Mặc Kimono dạo bước dưới hàng phong đỏ tại chùa Thanh Thủy (Kiyomizu-dera) ở Kyoto.`,
    },
    {
      slug: "bi-quyet-san-may-fansipan-va-lich-trinh-sapa-4n3d",
      title: "Bí quyết săn mây Fansipan & Lịch trình Sapa 4N3Đ chuẩn nhất",
      category: "Cẩm nang du lịch",
      excerpt:
        "Hướng dẫn khung giờ đi cáp treo Fansipan ít sương mù, trang phục giữ ấm nhiều lớp và những góc chụp ảnh ruộng bậc thang Mường Hoa đẹp xuất sắc.",
      avatar:
        "https://images.unsplash.com/photo-1570366583862-f91883984fde?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 1410,
      relatedDestination: "SaPa",
      position: 7,
      publishedAt: new Date("2026-10-22T08:00:00.000Z"),
      content: `Sapa luôn có sức quyến rũ kỳ lạ với bản làng sương phủ, ruộng bậc thang tầng tầng lớp lớp và nóc nhà Đông Dương Fansipan ở độ cao 3.143m.

## Khung giờ vàng săn mây trên đỉnh Fansipan
- Buổi sáng từ 8h30 – 10h30: Lúc nắng bắt đầu lên cao, biển mây thường tụ thành từng tầng bồng bềnh dưới chân cột cờ Tổ quốc.
- Nên theo dõi thời tiết thị trấn Sapa từ tối hôm trước; nếu hôm trước mưa nhẹ và sáng hôm sau trời hửng nắng, xác suất gặp biển mây lên đến hơn 80%.

## Quy tắc mặc đồ 3 lớp (Layering)
Nhiệt độ trên đỉnh có thể thấp hơn thị trấn Sapa 6–8°C kèm gió mạnh. Hãy mang áo giữ nhiệt bên trong, áo len/nỉ giữa và áo khoác chống gió nhẹ bên ngoài để linh hoạt cởi ra khi xuống núi đi dạo Bản Cát Cát.`,
    },
    {
      slug: "meo-dat-tour-tiet-kiem-va-chon-phong-cach-du-lich-chau-au",
      title: "Mẹo đặt tour tiết kiệm & Checklist chuẩn bị hành trình Châu Âu",
      category: "Kinh nghiệm săn tour",
      excerpt:
        "Cách tận dụng ưu đãi giờ chót, mã giảm giá đặt nhóm và kinh nghiệm chuẩn bị hành lý, sim 4G, thẻ thanh toán cho chuyến đi Pháp - Thụy Sĩ - Ý.",
      avatar:
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=85",
      featured: false,
      views: 870,
      relatedDestination: "Châu Âu",
      position: 8,
      publishedAt: new Date("2026-10-15T08:00:00.000Z"),
      content: `Một chuyến du lịch liên tuyến Châu Âu 6N5Đ hoặc dài ngày đòi hỏi sự chuẩn bị bài bản để vừa tối ưu ngân sách vừa tận hưởng trọn vẹn từng điểm đến.

## 3 bí quyết săn tour giá hời trên VN.TRAVEL
- Theo dõi mục Tour Giờ Chót trên trang chủ để săn mức giảm lên tới 15–38% cho các suất giữ chỗ cuối cùng.
- Đặt nhóm gia đình hoặc bạn bè và áp dụng mã ưu đãi trực tiếp tại trang Giỏ Hàng (` + "`GIAM10`" + ` giảm 10% tối đa 1 triệu hoặc ` + "`TOUR2026`" + ` giảm 400.000đ).
- Đăng ký email nhận bản tin để nhận thông báo sớm các đợt mở bán mùa hoa anh đào, mùa thu và Giáng sinh.

## Checklist trước giờ bay quốc tế
Kiểm tra hộ chiếu còn hạn tối thiểu 6 tháng tính từ ngày về, chuẩn bị eSIM Châu Âu đa quốc gia, ổ cắm chuyển đổi chuẩn Type C/F và mang thêm một đôi giày thể thao êm chân cho những ngày dạo phố cổ Paris hay Venice.`,
    },
  ];

  for (const article of sampleNews) {
    await prisma.newsArticle.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        ...article,
        status: RecordStatus.ACTIVE,
        createdById: adminA.id,
        updatedById: adminA.id,
      },
    });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
