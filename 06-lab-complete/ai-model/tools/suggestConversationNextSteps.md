# 💡 Tool: suggestConversationNextSteps

> Sinh suggested questions, suggested answers, quick replies và draft phản hồi tiếp theo cho UI chat. Dùng được cho **User**, **Tài xế**, và **Ops Agent**.

---

## Function Declaration

```javascript
const suggestConversationNextStepsDeclaration = {
  name: "suggestConversationNextSteps",
  description: "Sinh gợi ý câu hỏi, câu trả lời nhanh và action chips cho lượt hội thoại tiếp theo. Tool này KHÔNG thực hiện hành động nghiệp vụ; chỉ trả về đề xuất để UI/LLM hiển thị. Dùng sau khi đã có session context, intent, risk level hoặc kết quả tool liên quan.",
  parameters: {
    type: "object",
    properties: {
      audience: {
        type: "string",
        description: "Đối tượng đang chat.",
        enum: ["customer", "driver", "ops_agent"]
      },
      order_id: {
        type: "string",
        description: "Mã đơn hàng liên quan, nếu có."
      },
      driver_id: {
        type: "string",
        description: "Mã tài xế liên quan, nếu audience là driver hoặc đơn có tài xế."
      },
      latest_user_message: {
        type: "string",
        description: "Tin nhắn gần nhất của User/Tài xế/Agent."
      },
      detected_intent: {
        type: "string",
        description: "Intent đã phân loại. Ví dụ CHECK_STATUS, CANCEL_ORDER, DRIVER_PICKUP_DELAY."
      },
      risk_level: {
        type: "string",
        description: "Mức rủi ro đơn nếu có.",
        enum: ["Green", "Yellow", "Red", "Unknown"]
      },
      reason_code: {
        type: "string",
        description: "Reason code nghiệp vụ nếu có. Ví dụ NO_DRIVER_TIMEOUT, PAYMENT_STATE_MISMATCH, CUSTOMER_UNREACHABLE."
      },
      order_status: {
        type: "string",
        description: "Trạng thái đơn hiện tại nếu có."
      },
      available_actions: {
        type: "array",
        description: "Danh sách action UI/backend đang cho phép.",
        items: {
          type: "string"
        }
      },
      session_summary: {
        type: "string",
        description: "Tóm tắt ngắn gọn ngữ cảnh phiên chat và action đã làm."
      },
      max_suggestions: {
        type: "number",
        description: "Số gợi ý tối đa cần trả về. Nên dùng 2-4."
      }
    },
    required: ["audience", "latest_user_message", "detected_intent"]
  }
};
```

---

## Response Schema

```typescript
interface SuggestConversationNextStepsResponse {
  suggested_questions: SuggestedQuestion[];
  suggested_answers: SuggestedAnswer[];
  agent_draft: string | null;
  should_escalate: boolean;
  escalation_reason: string | null;
  safety_notes: string[];
}

interface SuggestedQuestion {
  label: string;                 // Text ngắn trên chip
  send_text: string;             // Nội dung gửi vào chat khi bấm
  audience: "customer" | "driver" | "ops_agent";
  priority: "low" | "medium" | "high";
}

interface SuggestedAnswer {
  label: string;                 // Text ngắn trên action chip
  send_text: string;             // Nội dung gửi vào chat khi bấm
  next_action:
    | "wait"
    | "lookup_order"
    | "cancel_order"
    | "request_refund"
    | "upload_evidence"
    | "report_driver_issue"
    | "escalate"
    | "close_chat";
  requires_confirmation: boolean;
  priority: "low" | "medium" | "high";
}
```

---

## Khi nào gọi

| Trigger | Ví dụ |
|---|---|
| Sau khi bot trả lời trạng thái đơn | Gợi ý "Tài xế đang ở đâu?", "Hủy được không?" |
| Sau khi risk = Yellow/Red | Gợi ý "Tiếp tục chờ", "Hủy đơn", "Gặp nhân viên" |
| Khi tài xế báo sự cố | Gợi ý "Báo quán chậm", "Khách không nghe máy", "Yêu cầu ops" |
| Khi UI cần quick reply | Render 2-4 nút gợi ý thay vì để người dùng gõ |
| Khi agent tiếp quản | Trả `agent_draft` để nhân viên phản hồi nhanh |

---

## Guardrails

- Tool này không được tự gọi `cancelOrder`, `requestRefund`, `reportDriverIssue`, hoặc `escalateToHuman`.
- Nếu suggestion dẫn tới hủy/hoàn/report/escalate, phải đặt `requires_confirmation=true`.
- Không trả suggestion yêu cầu số điện thoại, GPS chính xác, dữ liệu thanh toán nhạy cảm, hoặc thông tin nội bộ.
- Payment mismatch, COD mismatch, dispute, tai nạn, đe dọa -> `should_escalate=true`.

---

## Ví dụ

### Customer — Yellow no driver

```json
{
  "suggested_questions": [
    {
      "label": "Sao chưa có tài xế?",
      "send_text": "Vì sao đơn của mình chưa có tài xế nhận?",
      "audience": "customer",
      "priority": "high"
    }
  ],
  "suggested_answers": [
    {
      "label": "Tiếp tục chờ",
      "send_text": "Mình sẽ tiếp tục chờ thêm.",
      "next_action": "wait",
      "requires_confirmation": false,
      "priority": "medium"
    },
    {
      "label": "Hủy đơn miễn phí",
      "send_text": "Mình muốn hủy đơn miễn phí và nhận hoàn tiền theo chính sách.",
      "next_action": "cancel_order",
      "requires_confirmation": true,
      "priority": "high"
    }
  ],
  "agent_draft": null,
  "should_escalate": false,
  "escalation_reason": null,
  "safety_notes": []
}
```

### Driver — Merchant delay

```json
{
  "suggested_questions": [
    {
      "label": "Đợi quán bao lâu?",
      "send_text": "Mình nên chờ quán thêm bao lâu?",
      "audience": "driver",
      "priority": "medium"
    }
  ],
  "suggested_answers": [
    {
      "label": "Báo quán chậm",
      "send_text": "Mình đã tới quán nhưng món chưa sẵn sàng. Nhờ BaSau ghi nhận quán chậm.",
      "next_action": "report_driver_issue",
      "requires_confirmation": true,
      "priority": "high"
    }
  ],
  "agent_draft": "Tài xế đã tới quán nhưng món chưa sẵn sàng. Cần ops kiểm tra ETA của quán và xem có reassign không.",
  "should_escalate": false,
  "escalation_reason": null,
  "safety_notes": []
}
```
