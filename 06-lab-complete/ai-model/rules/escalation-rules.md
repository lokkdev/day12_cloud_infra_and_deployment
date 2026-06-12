# 🚨 Escalation Rules

> Quy tắc xác định khi nào Bot phải dừng xử lý và chuyển cuộc hội thoại cho nhân viên hỗ trợ (Human Agent).

---

## 1. Hard Triggers (Chuyển ngay lập tức)

Bất cứ khi nào các điều kiện sau xảy ra, Bot **PHẢI** gọi tool `escalateToHuman` và dừng trả lời:

1. **Khách hàng yêu cầu minh thị:**
   - Keywords: "cho gặp nhân viên", "nói chuyện với người thật", "gọi tổng đài", "không chat với bot", "human".
2. **Lỗi liên quan đến tiền bạc / thanh toán phức tạp:**
   - Reason code: `PAYMENT_STATE_MISMATCH` (Khách báo đã trừ tiền nhưng app báo chưa thanh toán).
   - Yêu cầu hoàn tiền thủ công với số tiền > 500,000 VNĐ.
3. **Loop vô tận / Bot bó tay:**
   - Khách lặp lại câu hỏi > 3 lần và Bot không thể cung cấp giải pháp mới (dựa trên count `bot_reply_count`).
   - Đơn hàng thuộc nhóm RED nhưng không đủ điều kiện tự động hủy/hoàn, và khách không chấp nhận giải thích.
4. **Dispute / Khiếu nại tính toàn vẹn của thức ăn:**
   - Ngộ độc thực phẩm, dị ứng, có dị vật trong thức ăn (cần người ghi nhận report sự cố y tế).

## 2. Soft Triggers (Chuyển khi có rủi ro)

Bot có thể thử giải quyết 1 lần, nếu thất bại thì chuyển:

1. **Khách hàng giận dữ (Negative Sentiment):**
   - Khách dùng từ ngữ tục tĩu, chửi thề (Phát hiện qua kỹ năng Sentiment Detection).
   - Bot trả lời: "Mình hiểu bạn đang rất bực mình. Để giải quyết triệt để, mình sẽ chuyển bạn sang bộ phận chăm sóc khách hàng ngay nhé."
2. **Tài xế có hành vi không chuẩn mực:**
   - Khách báo tài xế thái độ lồi lõm, không chịu giao lên lầu (dù đã ghi chú), vòi vĩnh thêm tiền ship.

## 3. Hành động khi Escalate

1. Gọi tool `escalateToHuman` với tham số `reason` và `summary`.
2. Trả lời khách: "Mình đã ghi nhận vấn đề và đang kết nối bạn với chuyên viên hỗ trợ. Vui lòng giữ cửa sổ chat mở trong ít phút nhé."
3. **Dừng sinh nội dung (Exit flow)** cho đến khi phiên chat được bàn giao lại cho Bot.
