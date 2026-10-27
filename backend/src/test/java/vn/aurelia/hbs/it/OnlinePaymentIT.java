package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import vn.aurelia.hbs.common.Hmac;
import vn.aurelia.hbs.folio.Payment;
import vn.aurelia.hbs.folio.PaymentMethod;
import vn.aurelia.hbs.folio.PaymentRecordStatus;
import vn.aurelia.hbs.folio.PaymentRepository;
import vn.aurelia.hbs.folio.PaymentType;
import vn.aurelia.hbs.payment.VnpayGateway;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/**
 * PAY-06: VNPay và MoMo sandbox. Test đóng vai cổng thanh toán: ký tham số IPN bằng hash secret cấu hình trong
 * application-test.yml, gọi IPN/return như cổng thật, kiểm tra trạng thái folio và các mã phản hồi lỗi.
 */
@DisplayName("Thanh toán online VNPay, MoMo (PAY-06)")
class OnlinePaymentIT extends AbstractIntegrationTest {
    private static final String VNP_SECRET = "TESTHASHSECRETTESTHASHSECRET1234";
    private static final String MOMO_SECRET = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

    @Autowired
    PaymentRepository payments;

    private JsonNode guestBooking(String token, int offset) {
        LocalDate in = today().plusDays(offset);
        return okData(post("/bookings", token, json("roomTypeId", DELUXE, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 2)));
    }

    private static Map<String, String> query(String url) {
        Map<String, String> m = new HashMap<>();
        for (String kv : URI.create(url).getRawQuery().split("&")) {
            String[] p = kv.split("=", 2);
            m.put(URLDecoder.decode(p[0], StandardCharsets.US_ASCII), URLDecoder.decode(p[1], StandardCharsets.US_ASCII));
        }
        return m;
    }

    /** Tham số IPN như VNPay gửi về, đã ký. */
    private static Map<String, String> vnpIpn(Map<String, String> payParams, String responseCode, String amountX100) {
        Map<String, String> p = new TreeMap<>();
        p.put("vnp_TmnCode", payParams.get("vnp_TmnCode"));
        p.put("vnp_Amount", amountX100);
        p.put("vnp_BankCode", "NCB");
        p.put("vnp_OrderInfo", payParams.get("vnp_OrderInfo"));
        p.put("vnp_PayDate", "20261120103000");
        p.put("vnp_ResponseCode", responseCode);
        p.put("vnp_TransactionNo", "14512345");
        p.put("vnp_TransactionStatus", responseCode);
        p.put("vnp_TxnRef", payParams.get("vnp_TxnRef"));
        Map<String, String> signed = new HashMap<>(p);
        signed.put("vnp_SecureHash", Hmac.sha512Hex(VNP_SECRET, VnpayGateway.join(p)));
        signed.put("vnp_SecureHashType", "HmacSHA512");
        return signed;
    }

    private Res ipn(Map<String, String> params) {
        StringBuilder q = new StringBuilder();
        params.forEach((k, v) -> q.append(q.isEmpty() ? "?" : "&").append(k).append('=')
                .append(java.net.URLEncoder.encode(v, StandardCharsets.UTF_8)));
        return get("/payments/vnpay/ipn" + q, null);
    }

    @Test
    @DisplayName("TC-PAY-01 Khách tạo link VNPay, IPN thành công → folio PAID; IPN lặp lại trả 02")
    void vnpaySuccess() {
        String guest = newGuest();
        JsonNode b = guestBooking(guest, 330);
        long total = b.path("totalAmount").asLong();
        Res link = post("/bookings/" + b.path("id").asText() + "/online-payments", guest, json("gateway", "VNPAY"));
        assertThat(link.status()).as(link.toString()).isEqualTo(201);
        assertThat(link.data().path("amount").asLong()).isEqualTo(total);
        Map<String, String> pay = query(link.data().path("payUrl").asText());
        assertThat(pay.get("vnp_Amount")).isEqualTo(String.valueOf(total * 100));
        assertThat(pay.get("vnp_ReturnUrl")).endsWith("/api/v1/payments/vnpay/return");

        Res r = ipn(vnpIpn(pay, "00", String.valueOf(total * 100)));
        assertThat(r.body().path("RspCode").asText()).isEqualTo("00");
        Res status = get("/payments/" + link.data().path("paymentId").asText(), guest);
        assertThat(status.data().path("status").asText()).isEqualTo("COMPLETED");
        assertThat(status.data().path("gatewayTxnNo").asText()).isEqualTo("14512345");
        assertThat(get("/bookings/" + b.path("id").asText(), guest).data().path("paymentStatus").asText())
                .isEqualTo("PAID");

        assertThat(ipn(vnpIpn(pay, "00", String.valueOf(total * 100))).body().path("RspCode").asText())
                .as("IPN lặp lại").isEqualTo("02");
        Res nothingLeft = post("/bookings/" + b.path("id").asText() + "/online-payments", guest,
                json("gateway", "VNPAY"));
        assertThat(nothingLeft.errorCode()).isEqualTo("PAYMENT_EXCEEDS_BALANCE");
    }

    @Test
    @DisplayName("TC-PAY-02 IPN sai chữ ký 97, sai số tiền 04, không có đơn 01, thất bại → FAILED")
    void vnpayErrors() {
        String guest = newGuest();
        JsonNode b = guestBooking(guest, 332);
        long total = b.path("totalAmount").asLong();
        Res link = post("/bookings/" + b.path("id").asText() + "/online-payments", guest,
                json("gateway", "VNPAY", "amount", 100_000));
        Map<String, String> pay = query(link.data().path("payUrl").asText());

        Map<String, String> tampered = vnpIpn(pay, "00", "10000000");
        tampered.put("vnp_Amount", "1");
        assertThat(ipn(tampered).body().path("RspCode").asText()).isEqualTo("97");
        assertThat(ipn(vnpIpn(pay, "00", "999")).body().path("RspCode").asText()).isEqualTo("04");
        Map<String, String> unknown = new HashMap<>(pay);
        unknown.put("vnp_TxnRef", "KHONGCO");
        assertThat(ipn(vnpIpn(unknown, "00", "10000000")).body().path("RspCode").asText()).isEqualTo("01");

        assertThat(ipn(vnpIpn(pay, "24", "10000000")).body().path("RspCode").asText()).isEqualTo("00");
        assertThat(get("/payments/" + link.data().path("paymentId").asText(), guest).data().path("status").asText())
                .isEqualTo("FAILED");
        assertThat(get("/bookings/" + b.path("id").asText() + "/folio", reception()).data().path("balance").asLong())
                .isEqualTo(total);
    }

    @Test
    @DisplayName("TC-PAY-03 Return URL đã ký chuyển khách về trang kết quả trên frontend")
    void vnpayReturnRedirect() {
        String guest = newGuest();
        JsonNode b = guestBooking(guest, 334);
        long total = b.path("totalAmount").asLong();
        Map<String, String> pay = query(okData(post("/bookings/" + b.path("id").asText() + "/online-payments", guest,
                json("gateway", "VNPAY"))).path("payUrl").asText());
        StringBuilder q = new StringBuilder();
        vnpIpn(pay, "00", String.valueOf(total * 100)).forEach((k, v) -> q.append(q.isEmpty() ? "?" : "&")
                .append(k).append('=').append(java.net.URLEncoder.encode(v, StandardCharsets.UTF_8)));
        Res r = get("/payments/vnpay/return" + q, null);
        assertThat(r.status()).isEqualTo(302);
        assertThat(r.raw().getResponse().getHeader("Location"))
                .startsWith("http://localhost:5173/payment-result?status=success&ref=" + b.path("bookingRef").asText());
    }

    @Test
    @DisplayName("TC-PAY-04 IPN MoMo đã ký → COMPLETED; chữ ký sai → 400")
    void momoIpn() throws Exception {
        JsonNode b = okData(staffBooking("302", today().plusDays(336), today().plusDays(337)));
        Payment p = new Payment();
        p.setBookingId(UUID.fromString(b.path("id").asText()));
        p.setType(PaymentType.DEPOSIT);
        p.setMethod(PaymentMethod.MOMO);
        p.setAmount(500_000);
        p.setStatus(PaymentRecordStatus.PENDING);
        p.setTransactionRef("AURMOMO" + System.nanoTime());
        p.setExpiresAt(OffsetDateTime.now().plusMinutes(15));
        payments.saveAndFlush(p);

        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("partnerCode", "MOMOTEST");
        body.put("orderId", p.getTransactionRef());
        body.put("requestId", p.getTransactionRef());
        body.put("amount", 500000);
        body.put("orderInfo", "Thanh toan");
        body.put("orderType", "momo_wallet");
        body.put("transId", 4088878653L);
        body.put("resultCode", 0);
        body.put("message", "Successful.");
        body.put("payType", "qr");
        body.put("responseTime", 1721720663942L);
        body.put("extraData", "");
        String raw = "accessKey=F8BBA842ECF85&amount=500000&extraData=&message=Successful.&orderId="
                + p.getTransactionRef() + "&orderInfo=Thanh toan&orderType=momo_wallet&partnerCode=MOMOTEST"
                + "&payType=qr&requestId=" + p.getTransactionRef()
                + "&responseTime=1721720663942&resultCode=0&transId=4088878653";
        body.put("signature", "00" + Hmac.sha256Hex(MOMO_SECRET, raw).substring(2));
        assertThat(post("/payments/momo/ipn", null, body).status()).as("chữ ký sai").isEqualTo(400);

        body.put("signature", Hmac.sha256Hex(MOMO_SECRET, raw));
        assertThat(post("/payments/momo/ipn", null, body).status()).isEqualTo(204);
        assertThat(payments.findById(p.getId()).orElseThrow().getStatus()).isEqualTo(PaymentRecordStatus.COMPLETED);
        assertThat(get("/bookings/" + b.path("id").asText() + "/folio", reception()).data().path("paid").asLong())
                .isEqualTo(500_000);
    }

    @Test
    @DisplayName("TC-PAY-05 Khách không tạo được link thanh toán cho đặt phòng của người khác")
    void notOwner() {
        JsonNode b = guestBooking(newGuest(), 338);
        Res r = post("/bookings/" + b.path("id").asText() + "/online-payments", newGuest(), json("gateway", "MOMO"));
        assertThat(r.status()).isEqualTo(404);
    }
}
