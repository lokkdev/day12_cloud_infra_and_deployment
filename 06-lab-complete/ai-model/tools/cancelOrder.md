# ❌ Tool: cancelOrder

> Thực hiện yêu cầu hủy đơn hàng. Tool sẽ kiểm tra điều kiện hủy trước khi thực hiện.

---

## Function Declaration

```javascript
const cancelOrderDeclaration = {
  name: "cancelOrder",
  description: "Yêu cầu hủy đơn hàng. Tool sẽ kiểm tra đơn có đủ điều kiện hủy không (theo chính sách BaSau) trước khi thực hiện. Trả về kết quả hủy hoặc lý do không thể hủy. CHỈ gọi khi khách đã xác nhận muốn hủy VÀ đơn có is_cancelable = true.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng cần hủy."
      },
      reason: {
        type: "string",
        description: "Lý do hủy đơn do khách cung cấp.",
        enum: [
          "NO_DRIVER_TOO_LONG",
          "FOOD_QUALITY_CONCERN",
          "CHANGED_MIND",
          "WRONG_ORDER",
          "MERCHANT_ISSUE",
          "OTHER"
        ]
      },
      customer_confirmed: {
        type: "boolean",
        description: "Khách đã xác nhận muốn hủy (bot phải hỏi trước). Phải là true mới xử lý."
      }
    },
    required: ["order_id", "reason", "customer_confirmed"]
  }
};
```

---

## Response Schema

```typescript
interface CancelOrderResponse {
  success: boolean;
  order_id: string;
  cancel_status: "cancelled" | "rejected" | "pending_review";
  refund_eligible: boolean;
  refund_amount: number | null;       // VNĐ
  refund_type: "full" | "partial_shipping" | "none";
  refund_timeline: string | null;     // "1-3 ngày làm việc"
  voucher_issued: boolean;
  voucher_detail: string | null;      // "Giảm 30%, tối đa 50.000đ"
  rejection_reason: string | null;    // Nếu không hủy được
  message: string;                    // Thông điệp cho khách
}
```

---

## Preconditions (kiểm tra TRƯỚC khi gọi)

| Điều kiện | Giá trị | Action |
|---|---|---|
| `is_cancelable` | `true` | ✅ Cho phép gọi |
| `is_cancelable` | `false` | ❌ Không gọi — giải thích cho khách |
| `customer_confirmed` | `true` | ✅ Cho phép xử lý |
| `customer_confirmed` | `false` | ❌ Bot phải hỏi xác nhận trước |
| `status` | `delivered` | ❌ Không hủy được đơn đã giao |
| `status` | `delivering` | ❌ Chuyển nhân viên |

---

## Guardrails

- ⚠️ **BẮT BUỘC** hỏi xác nhận khách trước khi gọi tool này.
- ⚠️ **BẮT BUỘC** gọi `logAuditEvent` sau khi hủy thành công.
- ⚠️ **KHÔNG** hủy đơn đang giao — chuyển nhân viên.
- ⚠️ **KHÔNG** hủy nếu `payment_state = mismatch` — chuyển nhân viên.
