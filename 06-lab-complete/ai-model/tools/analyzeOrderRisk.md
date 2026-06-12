# ⚠️ Tool: analyzeOrderRisk

> Phân tích mức rủi ro đơn hàng, tính risk score, gán reason code, và đề xuất hành động.

---

## Function Declaration

```javascript
const analyzeOrderRiskDeclaration = {
  name: "analyzeOrderRisk",
  description: "Phân tích mức độ rủi ro của đơn hàng. Tính risk score (0-100), xác định risk level (Green/Yellow/Red), gán reason code, và đề xuất hành động recovery. Gọi khi cần đánh giá tình trạng đơn để giải thích cho khách hoặc đề xuất giải pháp.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Mã đơn hàng cần phân tích risk."
      }
    },
    required: ["order_id"]
  }
};
```

---

## Response Schema

```typescript
interface AnalyzeOrderRiskResponse {
  order_id: string;
  risk_level: "Green" | "Yellow" | "Red";
  risk_score: number;                    // 0-100
  reason_code: ReasonCode;
  reason_label: string;                  // Human-readable
  recommended_actions: string[];         // Danh sách hành động đề xuất
  customer_message: string;              // Thông điệp cho khách
  wait_time_minutes: number;             // Thời gian khách đã chờ
  food_wait_minutes: number | null;      // Thời gian đồ ăn đã chờ sau ready
}
```

---

## Risk Scoring Rules

```
Risk Score = base_score + modifiers

Base scores:
  - Có tài xế, đang giao bình thường   → 10
  - Có tài xế nhưng ghép nhiều đơn     → 40
  - Chưa có tài xế < 20 phút          → 20
  - Chưa có tài xế 20-30 phút         → 55 (Yellow)
  - Chưa có tài xế > 30 phút          → 80 (Red)

Modifiers:
  + 10 nếu food_ready > 20 phút mà chưa pickup
  + 15 nếu driver_active_orders >= 3
  + 20 nếu merchant_status = closing_soon
  + 25 nếu payment_state = mismatch
  + 10 nếu customer đã hỏi > 2 lần
```

---

## Implementation (tham chiếu code)

```javascript
// Tương ứng: src/services/riskEngine.js + src/services/aiExplain.js
import { recommendedActions, reasonLabel } from "../../src/services/riskEngine.js";
import { buildCustomerMessage, getCustomerViewType } from "../../src/services/aiExplain.js";

async function analyzeOrderRisk({ order_id }) {
  const data = await loadData();
  const order = data.orders.find(o => o.order_id === order_id);
  if (!order) return { error: "ORDER_NOT_FOUND" };

  return {
    order_id: order.order_id,
    risk_level: order.risk_level,
    risk_score: calculateRiskScore(order),
    reason_code: order.reason_code,
    reason_label: reasonLabel(order.reason_code),
    recommended_actions: recommendedActions(order),
    customer_message: buildCustomerMessage(order),
    wait_time_minutes: calculateWaitTime(order.created_at),
    food_wait_minutes: order.food_ready_at 
      ? calculateWaitTime(order.food_ready_at) 
      : null,
  };
}
```
