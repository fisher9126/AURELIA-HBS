package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/** HK-01–05, ROOM-06, SRS 12.2 chuyển trạng thái phòng, BR-06 không bán phòng hỏng. Phòng 401–405. */
@DisplayName("Buồng phòng (HK)")
class HousekeepingIT extends AbstractIntegrationTest {

    private String openTask(String roomNumber, String type) {
        for (JsonNode t : get("/housekeeping/tasks", reception()).data()) {
            if (t.path("roomNumber").asText().equals(roomNumber) && t.path("type").asText().equals(type)) {
                return t.path("id").asText();
            }
        }
        return null;
    }

    @Test
    @DisplayName("TC-HK-01 Báo hỏng → không bán → sửa xong chuyển Dirty → dọn xong mở bán")
    void outOfOrderCycle() {
        String room = "401";
        String url = "/rooms/" + roomId(room) + "/status";
        Res noReason = patch(url, reception(), json("status", "OUT_OF_ORDER"));
        assertThat(noReason.status()).isEqualTo(400);

        Res ooo = patch(url, reception(), json("status", "OUT_OF_ORDER", "reason", "Điều hòa chảy nước"));
        assertThat(ooo.status()).as(ooo.toString()).isEqualTo(200);
        assertThat(roomStatus(room)).isEqualTo("OUT_OF_ORDER");
        String maintenance = openTask(room, "MAINTENANCE");
        assertThat(maintenance).isNotNull();

        LocalDate in = today().plusDays(340);
        Res avail = get("/rooms/available?checkIn=" + in + "&checkOut=" + in.plusDays(1) + "&adults=2", reception());
        assertThat(avail.data().toString()).doesNotContain(roomId(room).toString());
        Res book = staffBooking(room, in, in.plusDays(1));
        assertThat(book.errorCode()).isEqualTo("ROOM_UNAVAILABLE");

        Res direct = patch(url, reception(), json("status", "AVAILABLE"));
        assertThat(direct.errorCode()).as("phòng sửa xong phải qua Dirty").isEqualTo("INVALID_STATUS_TRANSITION");

        okData(patch("/housekeeping/tasks/" + maintenance + "/complete", reception(), null));
        assertThat(roomStatus(room)).isEqualTo("DIRTY");
        String cleaning = openTask(room, "CLEANING");
        assertThat(cleaning).isNotNull();

        okData(patch("/housekeeping/tasks/" + cleaning, reception(), json("assignedTo", "Chị Lan", "status",
                "IN_PROGRESS")));
        okData(patch("/housekeeping/tasks/" + cleaning + "/complete", reception(), null));
        assertThat(roomStatus(room)).isEqualTo("AVAILABLE");
        assertThat(staffBooking(room, in, in.plusDays(1)).status()).isEqualTo(201);
    }

    @Test
    @DisplayName("TC-HK-02 Không đặt tay sang Occupied; không báo hỏng phòng đang có khách")
    void forbiddenTransitions() {
        String room = "402";
        String url = "/rooms/" + roomId(room) + "/status";
        assertThat(patch(url, reception(), json("status", "OCCUPIED")).errorCode()).isEqualTo("INVALID_STATUS_TRANSITION");
        assertThat(patch(url, reception(), json("status", "AVAILABLE")).errorCode())
                .as("đã Available").isEqualTo("INVALID_STATUS_TRANSITION");

        LocalDate in = today().plusDays(344);
        String id = okData(staffBooking(room, in, in.plusDays(1))).path("id").asText();
        clock.setTo(in.atTime(15, 0));
        okData(patch("/bookings/" + id + "/check-in", reception(), json("idVerified", true)));
        Res ooo = patch(url, reception(), json("status", "OUT_OF_ORDER", "reason", "Hỏng khóa"));
        assertThat(ooo.errorCode()).isEqualTo("INVALID_STATUS_TRANSITION");
        assertThat(ooo.body().path("error").path("message").asText()).contains("đổi phòng");
    }

    @Test
    @DisplayName("TC-HK-03 Đổi phòng cho khách đang ở: phòng cũ Dirty, phòng mới Occupied")
    void roomMoveInHouse() {
        LocalDate in = today().plusDays(348);
        String id = okData(staffBooking("403", in, in.plusDays(2))).path("id").asText();
        clock.setTo(in.atTime(15, 0));
        okData(patch("/bookings/" + id + "/check-in", reception(), json("idVerified", true)));
        Res moved = put("/bookings/" + id, reception(), json("roomId", roomId("404").toString()));
        assertThat(moved.status()).as(moved.toString()).isEqualTo(200);
        assertThat(moved.data().path("room").path("roomNumber").asText()).isEqualTo("404");
        assertThat(roomStatus("403")).isEqualTo("DIRTY");
        assertThat(roomStatus("404")).isEqualTo("OCCUPIED");
        Res planChange = put("/bookings/" + id, reception(), json("planCode", "CP"));
        assertThat(planChange.errorCode()).as("đang ở chỉ đổi phòng, ngày trả").isEqualTo("INVALID_STATUS_TRANSITION");
    }

    @Test
    @DisplayName("TC-HK-04 Bật tắt Không làm phiền hiển thị trên bảng buồng phòng")
    void dnd() {
        String id = roomId("405").toString();
        Res on = patch("/rooms/" + id + "/dnd", reception(), json("dnd", true));
        assertThat(on.data().path("dnd").asBoolean()).isTrue();
        assertThat(get("/rooms/" + id, reception()).data().path("dnd").asBoolean()).isTrue();
        assertThat(patch("/rooms/" + id + "/dnd", reception(), json("dnd", false)).data().path("dnd").asBoolean())
                .isFalse();
    }

    @Test
    @DisplayName("TC-HK-05 Báo hỏng qua việc buồng phòng (MAINTENANCE) và lọc việc theo tầng")
    void createTaskAndFilter() {
        Res t = post("/housekeeping/tasks", reception(), json("roomId", roomId("406").toString(), "type",
                "MAINTENANCE", "reason", "Rò nước bồn rửa"));
        assertThat(t.status()).isEqualTo(201);
        assertThat(roomStatus("406")).isEqualTo("OUT_OF_ORDER");
        Res floor4 = get("/housekeeping/tasks?floor=4", reception());
        assertThat(floor4.data().toString()).contains("406");
        Res floor1 = get("/housekeeping/tasks?floor=1&type=MAINTENANCE", reception());
        assertThat(floor1.data().toString()).doesNotContain("406");
        okData(patch("/housekeeping/tasks/" + t.data().path("id").asText() + "/complete", reception(), null));
        okData(patch("/housekeeping/tasks/" + openTask("406", "CLEANING") + "/complete", reception(), null));
        assertThat(roomStatus("406")).isEqualTo("AVAILABLE");
    }
}
