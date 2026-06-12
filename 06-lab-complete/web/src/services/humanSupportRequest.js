/** Phân biệt «muốn gặp nhân viên» vs hỏi hotline/thông tin. */

export function isHumanSessionEndNotice(msg) {
  const text = String(msg?.text || "");
  return (
    msg?.sender === "bot" &&
    /phiên chat với nhân viên đã kết thúc/i.test(text)
  );
}

export function isExplicitHumanEscalationRequest(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;

  if (/hotline/.test(t)) {
    if (
      /là gì|là bao nhiêu|bao nhiêu|số nào|số điện thoại|điện thoại|email|tra cứu|gọi số/.test(
        t
      )
    ) {
      return false;
    }
    if (/^(hotline)(\s+basau)?[\?\.!\s]*$/.test(t)) return false;
    if (/^hotline\s+(của\s+)?basau[\?\.!\s]*$/.test(t)) return false;
    if (/^hotline\s+basau\s+là/.test(t)) return false;
  }

  if (
    /gặp nhân viên|liên hệ nhân viên|chuyển nhân viên|chuyển sang nhân viên|kết nối nhân viên|nói chuyện với nhân viên/.test(
      t
    )
  ) {
    return true;
  }

  if (/người thật|gặp người thật|chuyển người thật|liên hệ người thật/.test(t)) {
    return true;
  }

  if (/^nhân viên[\?\.!\s]*$/.test(t)) return true;

  if (/liên hệ.*nhân viên.*hỗ trợ|hỗ trợ.*nhân viên hỗ trợ/.test(t)) {
    return true;
  }

  return false;
}
