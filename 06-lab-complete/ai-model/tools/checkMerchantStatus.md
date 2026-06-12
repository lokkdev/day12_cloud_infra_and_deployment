# 🏪 Tool: checkMerchantStatus

> Kiểm tra trạng thái hoạt động của quán ăn.

---

## Function Declaration

```javascript
const checkMerchantStatusDeclaration = {
  name: "checkMerchantStatus",
  description: "Kiểm tra trạng thái hoạt động của quán ăn liên quan đến đơn hàng. Trả về quán đang mở, sắp đóng, hay đã đóng cửa. Gọi khi cần xác nhận quán còn hoạt động trước khi điều phối tài xế hoặc khi đơn tạo vào giờ muộn.",
  parameters: {
    type: "object",
    properties: {
      merchant_name: {
        type: "string",
        description: "Tên quán ăn. Ví dụ: 'Phở Thìn Bò', 'Café Highlands'."
      },
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan (optional, để cross-reference)."
      }
    },
    required: ["merchant_name"]
  }
};
```

---

## Response Schema

```typescript
interface CheckMerchantStatusResponse {
  merchant_name: string;
  status: "open" | "closing_soon" | "closed" | "temporarily_closed";
  closing_time: string | null;           // "23:00"
  minutes_until_close: number | null;    // 18
  is_accepting_orders: boolean;
  message: string;
}
```

---

## Business Logic

| Status | Điều kiện | AI Action |
|---|---|---|
| `open` | Quán đang mở, > 1 giờ trước khi đóng | Bình thường |
| `closing_soon` | < 30 phút trước khi đóng cửa | Gán `MERCHANT_CLOSING` nếu chưa có tài xế |
| `closed` | Quán đã đóng | Mở platform-mediated cancel |
| `temporarily_closed` | Quán tạm đóng (hết nguyên liệu, v.v.) | Thông báo khách, đề xuất hủy |
