package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import vn.aurelia.hbs.storage.StorageService;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** ROOM-01–07, RT-01, RT-02, RT-04, RT-05, SET-01–05: quản trị danh mục và cấu hình. */
@DisplayName("Quản trị phòng, loại phòng, cấu hình")
class CatalogAdminIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-RT-01 Tạo loại phòng nháp, thêm gói, ảnh, tiện nghi; khách không thấy bản nháp; lưu trữ")
    void roomTypeLifecycle() throws Exception {
        String name = "Garden Villa " + UUID.randomUUID().toString().substring(0, 4);
        Res created = post("/room-types", admin(), json("name", name, "description", "Villa sân vườn", "areaM2", 60,
                "bedType", "1 King", "viewType", "Vườn", "maxAdults", 2, "maxChildren", 0, "basePrice", 2_000_000,
                "status", "DRAFT"));
        assertThat(created.status()).as(created.toString()).isEqualTo(201);
        String id = created.data().path("id").asText();
        String slug = created.data().path("slug").asText();
        assertThat(slug).startsWith("garden-villa-");

        assertThat(get("/room-types/" + slug, null).status()).as("khách không thấy bản nháp").isEqualTo(404);
        assertThat(get("/room-types", null).data().toString()).doesNotContain(id);
        assertThat(get("/room-types?all=true", admin()).data().toString()).contains(id);

        Res plan = post("/room-types/" + id + "/plans", admin(), json("planCode", "CP", "planName", "Bed & Breakfast",
                "surchargePerNight", 350_000, "recommended", true));
        assertThat(plan.status()).isEqualTo(201);
        assertThat(post("/room-types/" + id + "/plans", admin(), json("planCode", "CP")).status())
                .as("trùng mã gói").isEqualTo(400);
        assertThat(put("/room-plans/" + plan.data().path("id").asText(), admin(), json("surchargePerNight", -1))
                .status()).isEqualTo(400);

        List<String> amenityIds = jdbc.queryForList("select id::text from amenities limit 3", String.class);
        assertThat(put("/room-types/" + id + "/amenities", admin(), json("amenityIds", amenityIds)).data().size())
                .isEqualTo(3);

        when(storage.uploadImage(any(), anyString())).thenReturn(
                new StorageService.Stored("room-types/" + id + "/a.jpg", "http://cdn/a.jpg"),
                new StorageService.Stored("room-types/" + id + "/b.jpg", "http://cdn/b.jpg"));
        for (int i = 0; i < 2; i++) {
            mvc.perform(MockMvcRequestBuilders.multipart("/api/v1/room-types/" + id + "/images")
                    .file(new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[] {1, 2, 3}))
                    .header("Authorization", "Bearer " + admin())).andReturn();
        }
        JsonNode detail = okData(get("/room-types/" + id, admin()));
        assertThat(detail.path("images").size()).isEqualTo(2);
        assertThat(detail.path("images").get(0).path("cover").asBoolean()).as("ảnh đầu là ảnh bìa").isTrue();
        String second = detail.path("images").get(1).path("id").asText();
        JsonNode reordered = okData(patch("/room-types/" + id + "/images/order", admin(),
                json("order", List.of(second, detail.path("images").get(0).path("id").asText()), "coverId", second)));
        assertThat(reordered.get(0).path("id").asText()).isEqualTo(second);
        assertThat(reordered.get(0).path("cover").asBoolean()).isTrue();

        assertThat(delete("/room-types/" + id, admin()).status()).isEqualTo(204);
        assertThat(okData(get("/room-types/" + id, admin())).path("status").asText()).isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("TC-ROOM-01 Thêm, sửa, xóa mềm phòng; không xóa phòng còn đặt phòng sắp tới")
    void roomCrud() {
        String number = "9" + (10 + (int) (Math.random() * 89));
        Res r = post("/rooms", admin(), json("roomNumber", number, "floor", 9, "roomTypeId", STANDARD));
        assertThat(r.status()).as(r.toString()).isEqualTo(201);
        String id = r.data().path("id").asText();
        assertThat(post("/rooms", admin(), json("roomNumber", number, "floor", 9, "roomTypeId", STANDARD)).status())
                .as("trùng số phòng").isEqualTo(400);
        assertThat(put("/rooms/" + id, admin(), json("description", "Gần thang máy")).data().path("description")
                .asText()).isEqualTo("Gần thang máy");

        LocalDate in = today().plusDays(370);
        okData(staffBooking(number, in, in.plusDays(1)));
        assertThat(delete("/rooms/" + id, admin()).errorCode()).isEqualTo("IN_USE");

        Res other = post("/rooms", admin(), json("roomNumber", number + "A", "floor", 9, "roomTypeId", STANDARD));
        assertThat(delete("/rooms/" + other.data().path("id").asText(), admin()).status()).isEqualTo(204);
        assertThat(get("/rooms?q=" + number + "A", reception()).data().size()).isZero();
    }

    @Test
    @DisplayName("TC-SET-01 Thuế phí ngoài 0–100% bị từ chối; mốc phí hủy phải liền nhau, phủ từ 0 giờ")
    void settingsAndTiers() {
        JsonNode before = okData(get("/settings", null));
        assertThat(before.path("vatRate").asInt()).isEqualTo(10);
        assertThat(put("/settings", admin(), json("vatRate", 120)).status()).isEqualTo(400);

        Res gap = put("/cancellation-tiers", admin(), List.of(json("hoursFrom", 48, "hoursTo", null,
                "penaltyPercent", 0), json("hoursFrom", 0, "hoursTo", 24, "penaltyPercent", 100)));
        assertThat(gap.status()).as("thiếu khoảng 24–48 giờ").isEqualTo(400);
        Res ok = put("/cancellation-tiers", admin(), List.of(
                json("hoursFrom", 72, "hoursTo", null, "penaltyPercent", 0, "description", "Miễn phí, hoàn 100%"),
                json("hoursFrom", 48, "hoursTo", 72, "penaltyPercent", 25, "description", "Phí 25% tổng tiền"),
                json("hoursFrom", 24, "hoursTo", 48, "penaltyPercent", 50, "description", "Phí 50% tổng tiền"),
                json("hoursFrom", 0, "hoursTo", 24, "penaltyPercent", 100, "description", "Phí 100%, gồm không đến")));
        assertThat(ok.status()).as(ok.toString()).isEqualTo(200);
        assertThat(get("/cancellation-tiers", null).data().size()).isEqualTo(4);

        Res hotline = put("/settings", admin(), json("hotline", "1900 6868"));
        assertThat(hotline.data().path("hotline").asText()).isEqualTo("1900 6868");
    }

    @Test
    @DisplayName("TC-RT-02 Hoa hồng kênh và màu hợp lệ")
    void channels() {
        assertThat(put("/channels/AGENT", admin(), json("commissionRate", 12)).data().path("commissionRate").asInt())
                .isEqualTo(12);
        assertThat(put("/channels/AGENT", admin(), json("color", "vàng")).status()).isEqualTo(400);
        assertThat(put("/channels/AGENT", admin(), json("commissionRate", 10)).status()).isEqualTo(200);
    }

    @Test
    @DisplayName("TC-GUEST-01 Hồ sơ khách: tạo tại quầy, ghi chú, VIP, lịch sử lưu trú")
    void guests() {
        Res g = post("/guests", reception(), json("fullName", "Hoàng Thị Mai", "phone", "0977123456",
                "idType", "PASSPORT", "idNumber", "C1234567", "nationality", "vn"));
        assertThat(g.status()).as(g.toString()).isEqualTo(201);
        String id = g.data().path("id").asText();
        assertThat(g.data().path("nationality").asText()).isEqualTo("VN");
        assertThat(post("/guests", reception(), json("fullName", "X", "phone", "1", "idType", "BANG_LAI")).status())
                .isEqualTo(400);

        JsonNode updated = okData(put("/guests/" + id, reception(), json("notes", "Thích phòng tầng cao")));
        assertThat(updated.path("notes").asText()).isEqualTo("Thích phòng tầng cao");
        assertThat(updated.path("notesUpdatedAt").asText()).isNotBlank();
        assertThat(okData(patch("/guests/" + id + "/vip", reception(), json("vip", true))).path("vip").asBoolean())
                .isTrue();
        assertThat(get("/guests?vip=true&q=Hoàng Thị Mai", reception()).data().size()).isEqualTo(1);

        LocalDate in = today().plusDays(374);
        okData(post("/bookings", reception(), json("roomTypeId", STANDARD, "planCode", "EP", "checkIn", in.toString(),
                "checkOut", in.plusDays(1).toString(), "adults", 1, "guestId", id)));
        assertThat(get("/guests/" + id + "/bookings", reception()).data().size()).isEqualTo(1);
        assertThat(get("/guests/" + UUID.randomUUID(), reception()).errorCode()).isEqualTo("GUEST_NOT_FOUND");
    }
}
