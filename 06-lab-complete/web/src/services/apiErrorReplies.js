/** Chỉ hiển thị khi call API AI thất bại — không dùng làm câu trả lời chat bình thường. */
export const API_ERROR_REPLIES = [
  "Hệ thống hơi chậm một chút — mình vẫn theo dõi đơn cho bạn. Bạn có thể bấm gợi ý bên dưới để hỏi nhanh.",
  "Mình đang kiểm tra lại thông tin đơn của bạn. Bạn chờ thêm vài giây hoặc hỏi «Đơn của tôi đến đâu rồi?» nhé.",
];

export function pickApiErrorReply(seed = 0) {
  const i = Math.abs(Number(seed) || 0) % API_ERROR_REPLIES.length;
  return API_ERROR_REPLIES[i];
}
