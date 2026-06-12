# 🔍 Tool: lookupOrder

> Tra cứu thông tin chi tiết của một đơn hàng theo `order_id`.

---

## Function Declaration (Gemini Format)

```javascript
const lookupOrderDeclaration = {
  name: "lookupOrder",
  description: "Tra cứu thông tin đơn hàng theo mã đơn. Trả về trạng thái đơn, tên quán, thời gian tạo, thông tin tài xế, trạng thái thanh toán, và mức rủi ro. Gọi tool này khi khách hỏi về trạng thái đơn, thời gian giao, hoặc bất kỳ thông tin nào về đơn hàng.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng, format ORD-xxx. Ví dụ: ORD-001, ORD-004."
      }
    },
    required: ["order_id"]
  }
};
```

---

## Response Schema

```typescript
interface LookupOrderResponse {
  order_id: string;           // "ORD-004"
  customer_name: string;      // "Vũ Hải Dương"
  merchant_name: string;      // "Phở Thìn Bò"
  status: OrderStatus;        // "searching_driver"
  created_at: string;         // ISO 8601
  food_ready_at: string | null;
  payment_state: "paid" | "unpaid" | "mismatch";
  driver_id: string | null;
  active_driver_orders: number;
  risk_level: "Green" | "Yellow" | "Red";
  reason_code: ReasonCode | null;
  is_cancelable: boolean;
}

type OrderStatus = 
  | "confirmed"         // Quán đã xác nhận
  | "preparing"         // Quán đang làm
  | "food_ready"        // Đồ ăn xong, chờ tài xế lấy
  | "searching_driver"  // Đang tìm tài xế
  | "picked_up"         // Tài xế đã lấy hàng
  | "delivering"        // Đang giao
  | "delivered"         // Đã giao
  | "cancelled"         // Đã hủy
  | "support_escalated" // Đang chờ nhân viên

type ReasonCode =
  | "STACK_TOO_DEEP"           // Tài xế ghép quá nhiều đơn
  | "NO_DRIVER_TIMEOUT"        // Chưa có tài xế quá ngưỡng
  | "FOOD_READY_TOO_LONG"      // Đồ ăn chờ quá lâu
  | "MERCHANT_CLOSING"         // Quán sắp đóng cửa
  | "PAYMENT_STATE_MISMATCH"   // Lệch trạng thái thanh toán
  | "HUMAN_SUPPORT_REQUIRED"   // Cần hỗ trợ người thật
```

---

## Implementation (tham chiếu code)

```javascript
// Tương ứng: src/services/dataLoader.js
import { loadData } from "../../src/services/dataLoader.js";

async function lookupOrder({ order_id }) {
  const data = await loadData();
  const order = data.orders.find(o => o.order_id === order_id);
  if (!order) {
    return { error: "ORDER_NOT_FOUND", message: `Không tìm thấy đơn ${order_id}` };
  }
  return order;
}
```

---

## Khi nào gọi

| Trigger | Ví dụ tin nhắn khách |
|---|---|
| Hỏi trạng thái | "Đơn ORD-004 đến đâu rồi?" |
| Hỏi ETA | "Bao giờ giao?" |
| Hỏi chung | "Đơn của tôi thế nào?" |
| Mở chat (auto) | Hệ thống tự gọi khi khách mở chat |
