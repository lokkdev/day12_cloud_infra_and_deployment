# 📝 Tool: logAuditEvent

> Ghi lại mọi hành động quan trọng vào audit log để truy vết, dispute, và cải tiến hệ thống.

---

## Function Declaration

```javascript
const logAuditEventDeclaration = {
  name: "logAuditEvent",
  description: "Ghi một sự kiện vào audit log. Gọi sau mỗi action quan trọng: hủy đơn, hoàn tiền, escalate nhân viên, thay đổi risk level. Audit log dùng cho truy vết, dispute resolution, và cải tiến hệ thống.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan."
      },
      event_type: {
        type: "string",
        description: "Loại sự kiện.",
        enum: [
          "ORDER_CANCELLED",
          "REFUND_REQUESTED",
          "REFUND_APPROVED",
          "ESCALATED_TO_HUMAN",
          "RISK_LEVEL_CHANGED",
          "CANCEL_UNLOCKED",
          "CUSTOMER_FEEDBACK",
          "BOT_CANNOT_RESOLVE",
          "PAYMENT_MISMATCH_DETECTED"
        ]
      },
      details: {
        type: "string",
        description: "Mô tả chi tiết sự kiện. Ví dụ: 'Khách yêu cầu hủy sau 35 phút chờ, refund 100% approved.'"
      },
      actor: {
        type: "string",
        description: "Ai thực hiện action.",
        enum: ["bot", "customer", "admin", "system"]
      }
    },
    required: ["order_id", "event_type", "details", "actor"]
  }
};
```

---

## Response Schema

```typescript
interface LogAuditEventResponse {
  success: boolean;
  log_id: string;             // "LOG-20260604-09-35-001"
  timestamp: string;          // ISO 8601
  message: string;            // "Audit event logged successfully"
}
```

---

## Khi nào PHẢI gọi (bắt buộc)

| Sau action | event_type | actor |
|---|---|---|
| Hủy đơn thành công | `ORDER_CANCELLED` | `bot` |
| Yêu cầu hoàn tiền | `REFUND_REQUESTED` | `bot` |
| Chuyển nhân viên | `ESCALATED_TO_HUMAN` | `bot` |
| Phát hiện payment mismatch | `PAYMENT_MISMATCH_DETECTED` | `system` |
| Risk thay đổi Yellow → Red | `RISK_LEVEL_CHANGED` | `system` |
| Mở quyền hủy đơn | `CANCEL_UNLOCKED` | `system` |
