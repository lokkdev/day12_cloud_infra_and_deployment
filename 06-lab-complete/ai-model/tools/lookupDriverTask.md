# 📦 Tool: lookupDriverTask

> Tra cứu nhiệm vụ giao hàng hiện tại của Tài xế theo `task_id`, `order_id`, hoặc `driver_id`. Tool này dành cho **driver-facing chat**.

---

## Function Declaration

```javascript
const lookupDriverTaskDeclaration = {
  name: "lookupDriverTask",
  description: "Tra cứu nhiệm vụ giao hàng của tài xế: điểm lấy món, điểm giao, trạng thái pickup/delivery, SLA chờ quán/khách, COD, và các action được phép. Tool này chỉ trả dữ liệu cần thiết cho tài xế, không trả thông tin riêng tư vượt phạm vi giao hàng.",
  parameters: {
    type: "object",
    properties: {
      task_id: {
        type: "string",
        description: "Mã nhiệm vụ giao hàng nếu có. Ví dụ TASK-001."
      },
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan. Ví dụ ORD-004."
      },
      driver_id: {
        type: "string",
        description: "Mã tài xế. Ví dụ DRV-102."
      }
    },
    required: []
  }
};
```

---

## Response Schema

```typescript
interface LookupDriverTaskResponse {
  task_id: string;
  order_id: string;
  driver_id: string;
  task_status:
    | "assigned"
    | "going_to_merchant"
    | "arrived_at_merchant"
    | "waiting_food"
    | "picked_up"
    | "going_to_customer"
    | "arrived_at_customer"
    | "completed"
    | "cancelled"
    | "support_escalated";
  merchant_name: string;
  merchant_area: string;
  customer_display_name: string;       // Tên hiển thị hoặc tên đã mask
  delivery_area: string;               // Khu vực tương đối, không lộ thông tin thừa
  pickup_eta_minutes: number | null;
  delivery_eta_minutes: number | null;
  wait_time_minutes: number;
  cod_amount: number | null;
  payment_state: "paid" | "cod" | "mismatch" | "unknown";
  allowed_actions: DriverAllowedAction[];
  safety_flags: string[];
  message: string;
}

type DriverAllowedAction =
  | "report_merchant_delay"
  | "report_merchant_closed"
  | "report_customer_unreachable"
  | "report_address_issue"
  | "request_reassign"
  | "escalate_ops"
  | "mark_picked_up"
  | "mark_arrived"
  | "mark_delivered";
```

---

## Privacy Filter

Khi trả cho tài xế, chỉ cung cấp dữ liệu cần thiết để hoàn thành giao hàng:

- ✅ Tên quán, khu vực quán, điểm lấy món theo task.
- ✅ Tên hiển thị của khách và khu vực giao theo task.
- ✅ COD amount nếu task là COD.
- ✅ SLA chờ quán/khách và action được phép.
- ❌ Không trả thông tin thanh toán ngân hàng của khách.
- ❌ Không trả lịch sử đặt hàng, rating, hoặc ghi chú nội bộ không liên quan.
- ❌ Không trả số điện thoại thật nếu hệ thống dùng relay call/chat trong app.

---

## Khi nào gọi

| Trigger | Ví dụ tin nhắn tài xế |
|---|---|
| Hỏi nhiệm vụ hiện tại | "Đơn này lấy ở đâu?", "Mã task của tôi là gì?" |
| Hỏi điểm giao/ETA | "Giao khu nào?", "Còn bao lâu tới khách?" |
| Báo quán chậm | Cần biết đã chờ bao lâu và action được phép |
| Báo khách không nghe máy | Cần xác nhận task đang ở bước giao |
| COD/payment issue | Cần biết `payment_state` và COD amount |

---

## Guardrails

- Nếu không có ít nhất một trong `task_id`, `order_id`, `driver_id`, bot phải hỏi lại mã task/đơn trước.
- Nếu `payment_state = mismatch` hoặc COD lệch -> escalate ops, không tự kết luận.
- Nếu task có `safety_flags` -> ưu tiên hướng dẫn an toàn và escalate.
