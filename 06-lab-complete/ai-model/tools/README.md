# 🔧 Tools — Function Calling Declarations

> Tổng quan tất cả tools (function calling) cho Gemini API. Mỗi file trong folder này mô tả 1 tool theo chuẩn Gemini Function Calling.

---

## Danh sách Tools

| # | Tool | File | Mô tả | Khi nào gọi |
|---|---|---|---|---|
| 1 | `lookupOrder` | [lookupOrder.md](./lookupOrder.md) | Tra cứu thông tin đơn hàng | Khách hỏi trạng thái, ETA |
| 2 | `analyzeOrderRisk` | [analyzeOrderRisk.md](./analyzeOrderRisk.md) | Phân tích risk score & reason | Cần đánh giá mức rủi ro |
| 3 | `cancelOrder` | [cancelOrder.md](./cancelOrder.md) | Yêu cầu hủy đơn | Khách muốn hủy + đủ điều kiện |
| 4 | `requestRefund` | [requestRefund.md](./requestRefund.md) | Yêu cầu hoàn tiền | Khách muốn hoàn + đủ điều kiện |
| 5 | `escalateToHuman` | [escalateToHuman.md](./escalateToHuman.md) | Chuyển nhân viên hỗ trợ | Case phức tạp / khách yêu cầu |
| 6 | `lookupDriver` | [lookupDriver.md](./lookupDriver.md) | Tra cứu thông tin tài xế | Khách hỏi về tài xế |
| 7 | `checkMerchantStatus` | [checkMerchantStatus.md](./checkMerchantStatus.md) | Kiểm tra trạng thái quán | Cần biết quán còn mở không |
| 8 | `logAuditEvent` | [logAuditEvent.md](./logAuditEvent.md) | Ghi audit log | Sau mỗi action quan trọng |

---

## Cách đăng ký Tools với Gemini API

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const tools = [
  {
    functionDeclarations: [
      lookupOrderDeclaration,
      analyzeOrderRiskDeclaration,
      cancelOrderDeclaration,
      requestRefundDeclaration,
      escalateToHumanDeclaration,
      lookupDriverDeclaration,
      checkMerchantStatusDeclaration,
      logAuditEventDeclaration,
    ],
  },
];

const chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    systemInstruction: systemPrompt,
    tools: tools,
  },
});
```

---

## Flow xử lý Function Call

```
1. LLM nhận tin nhắn khách
2. LLM quyết định gọi tool nào (hoặc không gọi)
3. LLM trả về functionCall: { name, args }
4. Backend thực thi function thật với args
5. Backend trả kết quả về LLM qua functionResponse
6. LLM tổng hợp kết quả → trả lời khách bằng ngôn ngữ tự nhiên
```

### Ví dụ request/response:

```javascript
// LLM trả về:
{
  functionCall: {
    name: "lookupOrder",
    args: { order_id: "ORD-004" }
  }
}

// Backend xử lý → trả về:
{
  functionResponse: {
    name: "lookupOrder",
    response: {
      order_id: "ORD-004",
      merchant_name: "Phở Thìn Bò",
      status: "searching_driver",
      risk_level: "Red",
      reason_code: "NO_DRIVER_TIMEOUT",
      is_cancelable: true
    }
  }
}

// LLM tổng hợp → trả lời khách:
// "Đơn ORD-004 từ Phở Thìn Bò đang tìm tài xế. Rất tiếc, đơn đang chờ 
//  khá lâu do chưa có tài xế nhận. Bạn có thể hủy đơn và nhận hoàn tiền."
```
