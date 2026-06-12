# 💰 Tool: requestRefund

> Yêu cầu hoàn tiền cho đơn hàng theo chính sách BaSau Food.

---

## Function Declaration

```javascript
const requestRefundDeclaration = {
  name: "requestRefund",
  description: "Yêu cầu hoàn tiền cho đơn hàng. Kiểm tra điều kiện hoàn tiền theo chính sách BaSau Food, tính số tiền hoàn, và tạo yêu cầu hoàn. CHỈ gọi khi đã xác nhận đơn đủ điều kiện hoàn tiền và khách đã đồng ý.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng cần hoàn tiền."
      },
      refund_reason: {
        type: "string",
        description: "Lý do hoàn tiền.",
        enum: [
          "SYSTEM_CANCEL",
          "NO_DRIVER",
          "MERCHANT_CLOSED",
          "WRONG_FOOD",
          "MISSING_ITEMS",
          "FOOD_DAMAGED",
          "LATE_DELIVERY",
          "OTHER"
        ]
      },
      evidence_provided: {
        type: "boolean",
        description: "Khách có cung cấp bằng chứng (ảnh) không. Bắt buộc cho case sai/thiếu món."
      }
    },
    required: ["order_id", "refund_reason"]
  }
};
```

---

## Response Schema

```typescript
interface RequestRefundResponse {
  success: boolean;
  order_id: string;
  refund_status: "approved" | "pending_review" | "rejected";
  refund_amount: number;          // VNĐ
  refund_type: "full" | "partial" | "shipping_only";
  refund_method: string;          // "Hoàn về ví MoMo" / "Hoàn về thẻ"
  refund_timeline: string;        // "1-3 ngày làm việc"
  rejection_reason: string | null;
  message: string;
}
```

---

## Refund Decision Matrix

| Lý do | Cần ảnh? | Mức hoàn | Auto/Manual |
|---|---|---|---|
| `SYSTEM_CANCEL` | Không | 100% | Auto |
| `NO_DRIVER` | Không | 100% | Auto |
| `MERCHANT_CLOSED` | Không | 100% | Auto |
| `WRONG_FOOD` | **Có** | 100% | Manual review |
| `MISSING_ITEMS` | **Có** | Giá món thiếu | Manual review |
| `FOOD_DAMAGED` | **Có** | 50-100% | Manual review |
| `LATE_DELIVERY` | Không | Phí ship | Auto |
| `OTHER` | Tùy case | Tùy case | Manual review |

---

## Guardrails

- ⚠️ **KHÔNG** tự hoàn nếu `payment_state = mismatch` → escalate.
- ⚠️ **KHÔNG** hoàn nếu đơn đã hoàn rồi (tránh duplicate refund).
- ⚠️ **BẮT BUỘC** yêu cầu ảnh bằng chứng cho case sai/thiếu món.
- ⚠️ **BẮT BUỘC** gọi `logAuditEvent` sau mỗi refund.
- ⚠️ Case hoàn > 500.000đ → chuyển nhân viên approve.
