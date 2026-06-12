# 🚗 Tool: lookupDriver

> Tra cứu thông tin tài xế đang giao đơn hàng.

---

## Function Declaration

```javascript
const lookupDriverDeclaration = {
  name: "lookupDriver",
  description: "Tra cứu thông tin tài xế theo driver_id hoặc order_id. Trả về tên tài xế, trạng thái, số đơn đang giao, và vị trí tương đối. CHÚ Ý: KHÔNG tiết lộ số điện thoại hoặc địa chỉ cá nhân tài xế cho khách.",
  parameters: {
    type: "object",
    properties: {
      driver_id: {
        type: "string",
        description: "Mã tài xế (DRV-xxx). Có thể lấy từ kết quả lookupOrder."
      }
    },
    required: ["driver_id"]
  }
};
```

---

## Response Schema

```typescript
interface LookupDriverResponse {
  driver_id: string;
  name: string;                    // "Nguyễn Văn A" (chỉ share first name cho khách)
  status: "available" | "busy" | "delivering" | "offline";
  active_orders_count: number;
  approximate_area: string;        // "Khu vực Hoàn Kiếm" (KHÔNG share tọa độ chính xác)
}
```

---

## Privacy Filter (QUAN TRỌNG)

Khi trả lời khách, **CHỈ** chia sẻ:
- ✅ Tên tài xế (first name): "Tài xế Văn A"
- ✅ Trạng thái: "đang giao hàng"
- ✅ Số đơn đang giao: "đang có 2 đơn khác"
- ✅ Khu vực tương đối: "đang ở khu vực gần bạn"

**KHÔNG BAO GIỜ** chia sẻ:
- ❌ Số điện thoại tài xế
- ❌ Tọa độ GPS chính xác
- ❌ Địa chỉ nhà tài xế
- ❌ Rating nội bộ
- ❌ Thu nhập tài xế
