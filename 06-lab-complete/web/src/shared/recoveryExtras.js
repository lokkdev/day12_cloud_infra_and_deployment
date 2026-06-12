import { canEditOrder, getMerchantContact } from "../services/orderPolicy.js";
import { buildDeliveryJourney } from "../services/deliveryJourney.js";
import { getOrderStatusTier } from "../services/orderStatus.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMerchantAndJourney(order) {
  const contact = getMerchantContact(order);
  const journey = buildDeliveryJourney(order);
  const tier = getOrderStatusTier(order);
  const editable = canEditOrder(order);

  const stepsHtml = journey.steps
    .map(
      (s) => `
      <li class="journey-step journey-step--${s.state}" title="${escapeHtml(s.label)}">
        <span class="journey-step__dot" aria-hidden="true"></span>
        <span class="journey-step__label">${escapeHtml(s.short)}</span>
      </li>`
    )
    .join("");

  return `
    <section class="delivery-journey delivery-journey--${tier} animate-in" style="--i: 2.5" aria-label="Tiến độ đơn hàng">
      <div class="delivery-journey__bar" style="--progress: ${journey.percent}%">
        <div class="delivery-journey__fill"></div>
      </div>
      <ol class="delivery-journey__steps">${stepsHtml}</ol>
      <p class="delivery-journey__hint">${escapeHtml(journey.mapHint)}</p>
    </section>
    <section class="merchant-contact animate-in" style="--i: 2.6">
      <h3 class="merchant-contact__title">Liên hệ quán</h3>
      <p class="merchant-contact__name">${escapeHtml(contact.name)}</p>
      <a class="merchant-contact__link" href="tel:${contact.phone.replace(/\s/g, "")}">📞 ${escapeHtml(contact.phone)}</a>
      <p class="merchant-contact__addr">📍 ${escapeHtml(contact.address)}</p>
    </section>
    ${
      editable
        ? `<div class="order-edit-block animate-in" style="--i: 2.7">
            <button type="button" class="btn btn--ghost btn-press" id="btn-edit-order">Chỉnh sửa đơn</button>
            <p class="order-edit-block__hint">Quán chưa xác nhận — bạn có thể đổi món hoặc ghi chú.</p>
          </div>`
        : `<p class="order-edit-block order-edit-block--locked animate-in" style="--i: 2.7">
            Quán đã xác nhận — không thể chỉnh sửa đơn trên app. Liên hệ quán hoặc chat Trợ lý BaSau nếu cần hỗ trợ.
          </p>`
    }`;
}

export function bindOrderEditButton(order, onEdit) {
  const btn = document.getElementById("btn-edit-order");
  if (!btn || !canEditOrder(order)) return;
  btn.addEventListener("click", () => {
    const note = window.prompt(
      "Chỉnh sửa đơn (demo): nhập ghi chú mới cho quán",
      "Ít hành, thêm tương ớt"
    );
    if (note != null && onEdit) onEdit(note);
  });
}
