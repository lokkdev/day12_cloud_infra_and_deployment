# 🧯 Tool: reportDriverIssue

> Ghi nhận sự cố do Tài xế báo trong quá trình nhận/giao đơn và trả về bước xử lý tiếp theo.

---

## Function Declaration

```javascript
const reportDriverIssueDeclaration = {
  name: "reportDriverIssue",
  description: "Ghi nhận sự cố từ tài xế: quán chậm, quán đóng cửa, khách không nghe máy, sai địa chỉ, sự cố xe, tai nạn, COD/payment mismatch, hoặc cần chuyển đơn. Tool trả về trạng thái ghi nhận, action tiếp theo và có cần escalate ops không.",
  parameters: {
    type: "object",
    properties: {
      task_id: {
        type: "string",
        description: "Mã nhiệm vụ giao hàng nếu có."
      },
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan."
      },
      driver_id: {
        type: "string",
        description: "Mã tài xế báo sự cố."
      },
      issue_type: {
        type: "string",
        description: "Loại sự cố.",
        enum: [
          "MERCHANT_DELAY",
          "MERCHANT_CLOSED",
          "MERCHANT_REFUSED_ORDER",
          "CUSTOMER_UNREACHABLE",
          "ADDRESS_NOT_FOUND",
          "CUSTOMER_CHANGED_ADDRESS",
          "COD_MISMATCH",
          "PAYMENT_MISMATCH",
          "VEHICLE_ISSUE",
          "SAFETY_INCIDENT",
          "FOOD_DAMAGED_IN_TRANSIT",
          "REQUEST_REASSIGN",
          "APP_ERROR",
          "OTHER"
        ]
      },
      description: {
        type: "string",
        description: "Mô tả ngắn của tài xế."
      },
      evidence_provided: {
        type: "boolean",
        description: "Tài xế có gửi ảnh/bằng chứng không."
      },
      driver_confirmed: {
        type: "boolean",
        description: "Tài xế xác nhận muốn gửi báo cáo sự cố."
      }
    },
    required: ["driver_id", "issue_type", "description", "driver_confirmed"]
  }
};
```

---

## Response Schema

```typescript
interface ReportDriverIssueResponse {
  success: boolean;
  issue_id: string;
  task_id: string | null;
  order_id: string | null;
  issue_status: "recorded" | "pending_ops_review" | "rejected" | "escalated";
  next_steps: string[];
  should_escalate_ops: boolean;
  priority: "normal" | "high" | "urgent";
  requires_evidence: boolean;
  message_to_driver: string;
}
```

---

## Issue Matrix

| Issue Type | Priority | Evidence | Next Step |
|---|---|---|---|
| `MERCHANT_DELAY` | normal/high | Không bắt buộc | Ghi nhận, chờ SLA, ops nếu quá lâu |
| `MERCHANT_CLOSED` | high | Nên có ảnh | Ops xác minh, có thể cancel/reassign |
| `MERCHANT_REFUSED_ORDER` | high | Nên có ảnh | Ops liên hệ quán |
| `CUSTOMER_UNREACHABLE` | normal/high | Không bắt buộc | Gọi qua app, chờ SLA, ops nếu thất bại |
| `ADDRESS_NOT_FOUND` | normal | Không bắt buộc | Hỏi thêm chỉ dẫn hoặc ops hỗ trợ |
| `CUSTOMER_CHANGED_ADDRESS` | high | Không bắt buộc | Ops duyệt đổi điểm giao |
| `COD_MISMATCH` | urgent | Nên có ảnh màn hình | Escalate ops ngay |
| `PAYMENT_MISMATCH` | urgent | Nên có ảnh màn hình | Escalate ops ngay |
| `VEHICLE_ISSUE` | high | Không bắt buộc | Reassign nếu cần |
| `SAFETY_INCIDENT` | urgent | Nếu an toàn thì gửi sau | Dừng ở nơi an toàn, ops ngay |
| `FOOD_DAMAGED_IN_TRANSIT` | high | Có ảnh | Ops quyết định remake/refund |
| `APP_ERROR` | normal/high | Ảnh màn hình | Hướng dẫn retry, ops nếu chặn giao |

---

## Preconditions

- `driver_confirmed` phải là `true` trước khi ghi nhận issue.
- Với `SAFETY_INCIDENT`, bot được phép hướng dẫn an toàn ngay trước khi tool hoàn tất.
- Với `COD_MISMATCH` hoặc `PAYMENT_MISMATCH`, luôn đặt `should_escalate_ops=true`.

---

## Guardrails

- Không khuyên tài xế tự thương lượng tiền ngoài app.
- Không khuyên tài xế tiếp tục giao nếu đang có rủi ro an toàn.
- Không tự hủy đơn; chỉ ghi nhận issue và để ops/tool nghiệp vụ xử lý.
- Bắt buộc gọi `logAuditEvent` sau issue quan trọng hoặc escalation.
