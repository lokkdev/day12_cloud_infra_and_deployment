# 🛑 Rules & Guardrails — BaSau Food AI

> Các quy tắc bắt buộc LLM phải tuân thủ để đảm bảo an toàn, bảo mật dữ liệu, và định dạng câu trả lời chuẩn mực.

> **Team rules 2026-06:** [`../TEAM_RULES_2026.md`](../TEAM_RULES_2026.md)

---

## Danh sách Quy tắc (Rules)

| # | Rule File | Mục đích | Mức độ nghiêm trọng |
|---|---|---|---|
| 1 | [safety-guardrails.md](./safety-guardrails.md) | Chống prompt injection, từ chối câu hỏi off-topic, ngăn chặn nói xấu đối thủ | 🔴 Critical |
| 2 | [escalation-rules.md](./escalation-rules.md) | Quy định trường hợp bắt buộc phải chuyển nhân viên thật (Human Fallback) | 🔴 Critical |
| 3 | [data-privacy-rules.md](./data-privacy-rules.md) | Bảo vệ thông tin tài xế (SĐT, GPS) và thông tin doanh thu của quán | 🔴 Critical |
| 4 | [response-format-rules.md](./response-format-rules.md) | Quy chuẩn giọng điệu, định dạng tin nhắn ngắn gọn, dễ hiểu | 🟡 High |

---

## Tích hợp vào System Prompt

Tất cả các rules này được tổng hợp và đưa vào phần `GUARDRAILS` trong file [`SYSTEM_PROMPT.md`](../SYSTEM_PROMPT.md). Khi lập trình tích hợp, không được lược bỏ bất kỳ rule nào thuộc nhóm Critical.
