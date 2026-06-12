"""
Mock LLM — fallback when GEMINI_API_KEY is not set.
"""
import random
import time

MOCK_RESPONSES = {
    "default": [
        "Đây là câu trả lời từ AI agent (mock). Set GEMINI_API_KEY để dùng BaSau agent thật.",
        "Agent đang hoạt động tốt! (mock response) Hỏi thêm câu hỏi đi nhé.",
        "Tôi là AI agent được deploy lên cloud. Câu hỏi của bạn đã được nhận.",
    ],
    "docker": ["Container là cách đóng gói app để chạy ở mọi nơi. Build once, run anywhere!"],
    "deploy": ["Deployment là quá trình đưa code từ máy bạn lên server để người khác dùng được."],
    "health": ["Agent đang hoạt động bình thường. All systems operational."],
    "đơn": ["Để tra cứu đơn BaSau, gửi order_id (vd. ORD-001) cùng câu hỏi của bạn."],
}


def ask(question: str, delay: float = 0.1) -> str:
    time.sleep(delay + random.uniform(0, 0.05))
    question_lower = question.lower()
    for keyword, responses in MOCK_RESPONSES.items():
        if keyword in question_lower:
            return random.choice(responses)
    return random.choice(MOCK_RESPONSES["default"])
