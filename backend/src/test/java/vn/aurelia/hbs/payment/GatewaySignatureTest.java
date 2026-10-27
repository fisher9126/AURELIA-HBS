package vn.aurelia.hbs.payment;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import vn.aurelia.hbs.common.Hmac;
import vn.aurelia.hbs.config.AppProperties;

class GatewaySignatureTest {
    private final AppProperties props = new AppProperties("Asia/Ho_Chi_Minh", "http://localhost:5173",
            "http://localhost:8080", "*", "a@b.c", null, null, null, null,
            new AppProperties.Vnpay("DEMO1234", "SECRETKEYSECRETKEYSECRETKEY12345",
                    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", 15),
            new AppProperties.Momo("MOMO", "F8BBA842ECF85", "K951B6PE1waDMi640xX08PD3vg6EkVlz",
                    "https://test-payment.momo.vn/v2/gateway/api/create", 15),
            null);

    @Test
    void vnpayUrlSignatureRoundTrips() {
        VnpayGateway vnpay = new VnpayGateway(props);
        String url = vnpay.payUrl("AUR2610221200001234", 1_500_000, "Thanh toan dat phong BK-20261120-1234",
                "203.0.113.5");
        Map<String, String> params = query(url);
        assertThat(params.get("vnp_Amount")).isEqualTo("150000000");
        assertThat(vnpay.verify(params)).isTrue();
        params.put("vnp_Amount", "100");
        assertThat(vnpay.verify(params)).isFalse();
    }

    @Test
    void momoIpnSignature() {
        MomoGateway momo = new MomoGateway(props, RestClient.builder());
        Map<String, String> p = new HashMap<>(Map.of("partnerCode", "MOMO", "orderId", "AUR1", "requestId", "AUR1",
                "amount", "500000", "orderInfo", "Thanh toan", "orderType", "momo_wallet", "transId", "4088878653",
                "resultCode", "0", "message", "Successful.", "payType", "qr"));
        p.put("responseTime", "1721720663942");
        p.put("extraData", "");
        String raw = "accessKey=F8BBA842ECF85&amount=500000&extraData=&message=Successful.&orderId=AUR1"
                + "&orderInfo=Thanh toan&orderType=momo_wallet&partnerCode=MOMO&payType=qr&requestId=AUR1"
                + "&responseTime=1721720663942&resultCode=0&transId=4088878653";
        p.put("signature", Hmac.sha256Hex("K951B6PE1waDMi640xX08PD3vg6EkVlz", raw));
        assertThat(momo.verify(p)).isTrue();
        p.put("amount", "1");
        assertThat(momo.verify(p)).isFalse();
    }

    static Map<String, String> query(String url) {
        Map<String, String> m = new HashMap<>();
        for (String kv : URI.create(url).getRawQuery().split("&")) {
            String[] parts = kv.split("=", 2);
            m.put(URLDecoder.decode(parts[0], StandardCharsets.US_ASCII),
                    URLDecoder.decode(parts[1], StandardCharsets.US_ASCII));
        }
        return m;
    }
}
