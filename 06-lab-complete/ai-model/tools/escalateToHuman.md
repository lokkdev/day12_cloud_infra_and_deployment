# 👤 Tool: escalateToHuman

> Chuyển phiên chat cho nhân viên hỗ trợ thật. Tool quan trọng nhất cho safety.

---

## Function Declaration

```javascript
const escalateToHumanDeclaration = {
  name: "escalateToHuman",
  description: "Chuyển phiên chat sang nhân viên hỗ trợ thật. Gọi khi: (1) khách yêu cầu gặp người thật, (2) case liên quan thanh toán/tranh chấp, (3) bot đã trả lời ≥2 lần mà chưa giải quyết + đơn Red, (4) case vượt quá khả năng xử lý tự động. Sau khi gọi, bot DỪNG trả lời và chờ nhân viên tiếp quản.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan."
      },
      escalation_reason: {
        type: "string",
        description: "Lý do escalate.",
        enum: [
          "CUSTOMER_REQUESTED",
          "PAYMENT_ISSUE",
          "BOT_CANNOT_RESOLVE",
          "HIGH_RISK_ORDER",
          "DISPUTE",
          "ANGRY_CUSTOMER",
          "COMPLEX_REFUND"
        ]
      },
      context_summary: {
        type: "string",
        description: "Tóm tắt ngắn gọn vấn đề và những gì bot đã làm, để nhân viên nắm nhanh."
      },
      priority: {
        type: "string",
        description: "Mức ưu tiên.",
        enum: ["normal", "high", "urgent"]
      }
    },
    required: ["order_id", "escalation_reason", "context_summary", "priority"]
  }
};
```

---

## Response Schema

```typescript
interface EscalateToHumanResponse {
  success: boolean;
  ticket_id: string;              // "TKT-20260604-001"
  assigned_agent: string | null;   // Tên nhân viên (nếu đã assign)
  estimated_wait: string;          // "Trong vòng 5 phút"
  message: string;                 // Thông điệp cho khách
}
```

---

## Priority Matrix

| Reason | Default Priority | Có thể override? |
|---|---|---|
| `CUSTOMER_REQUESTED` | `normal` | Không |
| `PAYMENT_ISSUE` | `urgent` | Không — luôn urgent |
| `BOT_CANNOT_RESOLVE` | `high` | Có |
| `HIGH_RISK_ORDER` | `high` | Có |
| `DISPUTE` | `urgent` | Không — luôn urgent |
| `ANGRY_CUSTOMER` | `high` | Có |
| `COMPLEX_REFUND` | `normal` | Có |

---

## Sau khi escalate

```
1. Bot gửi: "Mình đang chuyển bạn sang nhân viên hỗ trợ. 
   Vui lòng không đóng cửa sổ chat."
2. Bot DỪNG trả lời — mọi tin nhắn tiếp theo chuyển cho nhân viên.
3. Nếu nhân viên chưa vào trong 5 phút → gửi: 
   "Nhân viên đang kết nối, bạn vui lòng chờ thêm giây lát."
4. Log audit: "Escalated — reason: [lý do] — priority: [mức]"
```

---

## Guardrails

- ⚠️ **LUÔN** escalate khi khách nói "người thật" / "nhân viên" — không thuyết phục ở lại.
- ⚠️ **LUÔN** truyền `context_summary` đầy đủ để nhân viên không hỏi lại từ đầu.
- ⚠️ **KHÔNG** escalate rồi tiếp tục trả lời — phải DỪNG hẳn.
