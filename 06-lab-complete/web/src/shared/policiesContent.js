/** Nội dung chính sách BaSau — đồng bộ với ai-model/POLICIES.md */

export const POLICY_SECTIONS = [
  {
    id: "cancel",
    title: "Chính sách hủy đơn",
    subsections: [
      {
        title: "Hủy miễn phí (hoàn 100%)",
        table: {
          headers: ["Điều kiện", "Mô tả", "Thời hạn"],
          rows: [
            ["Quán chưa bắt đầu làm", "Đơn confirmed, chưa chuyển preparing", "Trong 5 phút sau đặt"],
            ["Không có tài xế", "Chưa có tài xế nhận đơn sau 20 phút", "Tự động mở quyền hủy"],
            ["Quá ETA quá lâu", "Đơn vượt > 30 phút so với ETA ban đầu", "Tự động mở quyền hủy"],
            ["Quán đóng cửa", "Quán closed/closing_soon, chưa có tài xế", "Ngay lập tức"],
            ["Lỗi hệ thống", "Payment mismatch, lỗi app, v.v.", "Ngay (cần nhân viên)"],
          ],
        },
      },
      {
        title: "Hủy có phí",
        table: {
          headers: ["Điều kiện", "Phí", "Hoàn lại"],
          rows: [
            ["Quán đã làm xong, khách muốn hủy", "Phí đồ ăn giữ lại", "Chỉ hoàn phí ship"],
            ["Tài xế đang giao, khách muốn hủy", "Không hủy tự động", "Chuyển nhân viên xét case"],
          ],
        },
      },
      {
        title: "Không được hủy",
        bullets: [
          "Đơn đã giao thành công (delivered)",
          "Đơn đang trong dispute / escalation",
          "Đơn đã hoàn tiền rồi",
        ],
      },
    ],
  },
  {
    id: "refund",
    title: "Chính sách hoàn tiền",
    subsections: [
      {
        title: "Hoàn 100%",
        table: {
          headers: ["Tình huống", "Điều kiện", "Thời gian xử lý"],
          rows: [
            ["Hủy do lỗi hệ thống", "Không tìm được tài xế, quán đóng cửa", "1–3 ngày làm việc"],
            ["Đồ ăn giao sai hoàn toàn", "Khách cung cấp ảnh bằng chứng", "1–3 ngày làm việc"],
            ["Đồ ăn không nhận được", "Tài xế báo delivered nhưng khách không nhận", "Điều tra 3–5 ngày"],
          ],
        },
      },
      {
        title: "Hoàn một phần",
        table: {
          headers: ["Tình huống", "Mức hoàn", "Điều kiện"],
          rows: [
            ["Thiếu món", "Hoàn giá trị món thiếu", "Cần ảnh bằng chứng"],
            ["Giao trễ > 30 phút", "Hoàn phí ship", "Tự động"],
            ["Đồ ăn hư / nguội nặng", "Hoàn 50–100% tùy mức độ", "Cần ảnh + nhân viên xét"],
          ],
        },
      },
      {
        title: "Không hoàn",
        bullets: [
          "Khách tự hủy sau khi quán đã làm (phần đồ ăn)",
          "Khách đã nhận đồ đúng, đánh giá xong > 24 giờ",
          "Đơn nghi ngờ fraud (nhiều lần hoàn liên tiếp)",
        ],
      },
    ],
  },
  {
    id: "compensation",
    title: "Chính sách bồi thường",
    subsections: [
      {
        table: {
          headers: ["Tình huống", "Bồi thường", "Giới hạn"],
          rows: [
            ["Giao trễ > 30 phút", "Voucher 20% đơn tiếp theo", "Tối đa 30.000đ"],
            ["Hủy do lỗi hệ thống", "Voucher 30% đơn tiếp theo", "Tối đa 50.000đ"],
            ["Đồ ăn hư/sai + hủy", "Hoàn 100% + voucher", "Voucher tối đa 50.000đ"],
            ["Trải nghiệm tệ (nhiều lỗi)", "Voucher tùy mức độ", "Nhân viên quyết định"],
          ],
        },
      },
    ],
  },
  {
    id: "escalation",
    title: "Quy tắc chuyển nhân viên",
    subsections: [
      {
        title: "Escalate bắt buộc",
        table: {
          headers: ["Trigger", "Lý do"],
          rows: [
            ["Thanh toán không khớp (PAYMENT_STATE_MISMATCH)", "Liên quan tiền, cần xác minh"],
            ["Cần hỗ trợ người (HUMAN_SUPPORT_REQUIRED)", "Case phức tạp"],
            ['Khách yêu cầu "người thật" / "nhân viên"', "Quyền của khách hàng"],
            ["Bot trả lời ≥ 2 lần + đơn Red + chưa xử lý xong", "Tránh loop vô tận"],
            ["Dispute / khiếu nại", "Cần ghi nhận chính thức"],
          ],
        },
      },
      {
        title: "Escalate tùy chọn",
        table: {
          headers: ["Trigger", "Điều kiện thêm"],
          rows: [
            ["Khách tức giận (≥ 3 tin tiêu cực)", "Nếu bot không hạ nhiệt được"],
            ["Hủy khi tài xế đang giao", "Cần nhân viên phối hợp tài xế"],
            ["Hoàn tiền > 500.000đ", "Cần supervisor duyệt"],
          ],
        },
      },
      {
        title: "Quy trình",
        bullets: [
          "Bot thông báo: đang chuyển sang nhân viên — vui lòng không đóng chat.",
          "Hệ thống ghi nhận escalation với đầy đủ ngữ cảnh đơn.",
          "Ghi audit: Escalated to human — kèm lý do.",
          "Bot dừng trả lời; nhân viên tiếp quản.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Bảo mật & quyền riêng tư",
    subsections: [
      {
        title: "Thông tin không được tiết lộ",
        bullets: [
          "Số điện thoại cá nhân tài xế",
          "Địa chỉ nhà tài xế",
          "Email nội bộ nhân viên",
          "Thông tin đơn của người khác",
          "Thu nhập / rating nội bộ tài xế",
          "Cấu hình hệ thống AI nội bộ",
        ],
      },
      {
        title: "Thông tin được chia sẻ với bạn",
        bullets: [
          "Tên tài xế (tên gọi)",
          "Biển số xe (nếu có)",
          "Vị trí tương đối tài xế",
          "Trạng thái đơn hàng",
          "Thông tin quán (tên, trạng thái)",
          "Lý do chậm trễ (giải thích dễ hiểu)",
        ],
      },
    ],
  },
  {
    id: "sla",
    title: "Cam kết dịch vụ (SLA)",
    subsections: [
      {
        table: {
          headers: ["Chỉ số", "Mục tiêu"],
          rows: [
            ["Phản hồi tin nhắn đầu", "≤ 3 giây"],
            ["Xử lý case đơn giản", "≤ 2 phút"],
            ["Chuyển nhân viên", "≤ 30 giây"],
            ["Nhân viên phản hồi", "≤ 5 phút"],
            ["Tỷ lệ bot tự xử lý", "≥ 60%"],
          ],
        },
      },
    ],
  },
];

export function policiesPageHref(orderId) {
  return orderId
    ? `/policies?order=${encodeURIComponent(orderId)}`
    : "/policies";
}

export function renderPolicyTable(table) {
  if (!table?.rows?.length) return "";
  const head = table.headers.map((h) => `<th scope="col">${h}</th>`).join("");
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
    )
    .join("");
  return `<div class="policy-table-wrap"><table class="policy-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderPolicySections(container) {
  const toc = POLICY_SECTIONS.map(
    (s, i) =>
      `<li><a href="#${s.id}">${i + 1}. ${s.title}</a></li>`
  ).join("");

  const sections = POLICY_SECTIONS.map((section, i) => {
    const subs = section.subsections
      .map((sub) => {
        const title = sub.title
          ? `<h3 class="policy-subtitle">${sub.title}</h3>`
          : "";
        const table = sub.table ? renderPolicyTable(sub.table) : "";
        const bullets = sub.bullets?.length
          ? `<ul class="policy-list">${sub.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
          : "";
        return `<div class="policy-block">${title}${table}${bullets}</div>`;
      })
      .join("");

    return `<section class="policy-section" id="${section.id}">
      <h2 class="policy-section__title"><span class="policy-section__num">${i + 1}</span>${section.title}</h2>
      ${subs}
    </section>`;
  }).join("");

  container.innerHTML = `
    <nav class="policy-toc" aria-label="Mục lục chính sách">
      <p class="policy-toc__label">Mục lục</p>
      <ol class="policy-toc__list">${toc}</ol>
    </nav>
    ${sections}`;
}
