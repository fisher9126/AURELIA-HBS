package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** BK-09, BK-11, PAY-04, RPT-07: file PDF, CSV, Excel tạo đúng định dạng. */
@DisplayName("Tài liệu và xuất file")
class DocumentExportIT extends AbstractIntegrationTest {

    private MvcResult download(String path, String token) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.get("/api/v1" + path).header("Authorization", "Bearer " + token))
                .andReturn();
    }

    @Test
    @DisplayName("TC-DOC-01 Voucher PDF có QR: khách chủ đặt phòng tải được, khách khác thì không")
    void voucher() throws Exception {
        String guest = newGuest();
        LocalDate in = today().plusDays(350);
        String id = okData(post("/bookings", guest, json("roomTypeId", STANDARD, "planCode", "CP", "checkIn",
                in.toString(), "checkOut", in.plusDays(2).toString(), "adults", 2))).path("id").asText();
        MvcResult r = download("/bookings/" + id + "/voucher.pdf", guest);
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentType()).isEqualTo("application/pdf");
        byte[] pdf = r.getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(pdf.length).isGreaterThan(5_000);
        assertThat(r.getResponse().getHeader("Content-Disposition")).contains("inline").contains("voucher-BK-");
        assertThat(download("/bookings/" + id + "/voucher.pdf", newGuest()).getResponse().getStatus()).isEqualTo(404);
    }

    @Test
    @DisplayName("TC-DOC-02 Folio PDF chỉ nhân viên in được")
    void folio() throws Exception {
        LocalDate in = today().plusDays(352);
        String id = okData(staffBooking("105", in, in.plusDays(1))).path("id").asText();
        okData(post("/bookings/" + id + "/charges", reception(), json("type", "LAUNDRY", "unitPrice", 80000)));
        MvcResult r = download("/bookings/" + id + "/folio.pdf?download=true", reception());
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getHeader("Content-Disposition")).contains("attachment");
        assertThat(new String(r.getResponse().getContentAsByteArray(), 0, 5, StandardCharsets.US_ASCII))
                .isEqualTo("%PDF-");
        assertThat(download("/bookings/" + id + "/folio.pdf", seededGuest()).getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    @DisplayName("TC-DOC-03 Xuất CSV có BOM UTF-8, đúng tiêu đề cột, chặn CSV injection")
    void csv() throws Exception {
        LocalDate in = today().plusDays(354);
        okData(post("/bookings", reception(), json("roomId", roomId("106").toString(), "planCode", "EP",
                "checkIn", in.toString(), "checkOut", in.plusDays(1).toString(), "adults", 1,
                "guest", json("fullName", "=HYPERLINK(\"http://evil\")", "phone", "0900111222"))));
        MvcResult r = download("/bookings/export?format=csv&from=" + in + "&to=" + in.plusDays(1), reception());
        assertThat(r.getResponse().getStatus()).isEqualTo(200);
        assertThat(r.getResponse().getContentType()).startsWith("text/csv");
        String csv = new String(r.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
        assertThat(csv).startsWith("﻿Mã,Khách,Điện thoại");
        assertThat(csv).contains("\"'=HYPERLINK(").doesNotContain(",\"=HYPERLINK");
    }

    @ParameterizedTest(name = "báo cáo {0}")
    @ValueSource(strings = {"kpis", "sales", "sources", "breakdown", "occupancy", "adr-revpar", "cancellations"})
    @DisplayName("TC-DOC-04 Xuất mọi loại báo cáo ra PDF và Excel")
    void reports(String type) throws Exception {
        MvcResult pdf = download("/reports/export?type=" + type + "&format=pdf", admin());
        assertThat(pdf.getResponse().getStatus()).as(pdf.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(new String(pdf.getResponse().getContentAsByteArray(), 0, 5, StandardCharsets.US_ASCII))
                .isEqualTo("%PDF-");
        MvcResult xlsx = download("/reports/export?type=" + type + "&format=xlsx", admin());
        byte[] b = xlsx.getResponse().getContentAsByteArray();
        assertThat(new String(b, 0, 2, StandardCharsets.US_ASCII)).as("file zip OOXML").isEqualTo("PK");
    }

    @Test
    @DisplayName("TC-DOC-05 Danh sách đặt phòng PDF và loại báo cáo lạ")
    void bookingsPdfAndUnknownReport() throws Exception {
        MvcResult pdf = download("/bookings/export?format=pdf", reception());
        assertThat(new String(pdf.getResponse().getContentAsByteArray(), 0, 5, StandardCharsets.US_ASCII))
                .isEqualTo("%PDF-");
        assertThat(download("/reports/export?type=abc", admin()).getResponse().getStatus()).isEqualTo(400);
    }
}
