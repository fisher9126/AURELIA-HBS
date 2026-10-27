package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** BK-12: đặt phòng đoàn trong một giao dịch. */
@DisplayName("Đặt phòng đoàn (BK-12)")
class GroupBookingIT extends AbstractIntegrationTest {

    @Test
    @DisplayName("TC-GRP-01 Đoàn 3 phòng: 3 đặt phòng khác phòng, chung khách liên hệ, kênh GROUP")
    void createGroup() {
        LocalDate in = today().plusDays(360);
        Map<String, Object> room = json("roomTypeId", STANDARD, "planCode", "CP", "adults", 2);
        Res r = post("/booking-groups", reception(), json("name", "Đoàn ABC " + UUID.randomUUID(),
                "contact", json("fullName", "Trần Văn Bình", "phone", "0909000111", "email", "binh@abc.vn"),
                "checkIn", in.toString(), "checkOut", in.plusDays(2).toString(), "rooms", List.of(room, room, room)));
        assertThat(r.status()).as(r.toString()).isEqualTo(201);
        JsonNode g = r.data();
        assertThat(g.path("roomCount").asInt()).isEqualTo(3);
        List<String> rooms = new ArrayList<>();
        long sum = 0;
        for (JsonNode b : g.path("bookings")) {
            rooms.add(b.path("room").path("roomNumber").asText());
            assertThat(b.path("channelCode").asText()).isEqualTo("GROUP");
            assertThat(b.path("guest").path("fullName").asText()).isEqualTo("Trần Văn Bình");
            sum += b.path("totalAmount").asLong();
        }
        assertThat(rooms).doesNotHaveDuplicates().hasSize(3);
        assertThat(g.path("totalAmount").asLong()).isEqualTo(sum);
        assertThat(okData(get("/booking-groups/" + g.path("id").asText(), reception())).path("roomCount").asInt())
                .isEqualTo(3);
    }

    @Test
    @DisplayName("TC-GRP-02 Đoàn 11 Luxury Suite (chỉ có 10): lỗi, không tạo đoàn hay đặt phòng nào")
    void allOrNothing() {
        LocalDate in = today().plusDays(364);
        String name = "Đoàn quá tải " + UUID.randomUUID();
        Map<String, Object> room = json("roomTypeId", LUXURY, "planCode", "EP", "adults", 2);
        List<Object> rooms = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            rooms.add(room);
        }
        Res r = post("/booking-groups", reception(), json("name", name, "contactGuestId",
                "00000000-0000-0000-0000-0000000000b2", "checkIn", in.toString(), "checkOut",
                in.plusDays(1).toString(), "rooms", rooms));
        assertThat(r.status()).isEqualTo(409);
        assertThat(r.errorCode()).isEqualTo("ROOM_UNAVAILABLE");
        assertThat(jdbc.queryForObject("select count(*) from booking_groups where name = ?", Integer.class, name))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from bookings where check_in_date = ? and status = 'CONFIRMED'",
                Integer.class, in)).isZero();
    }
}
