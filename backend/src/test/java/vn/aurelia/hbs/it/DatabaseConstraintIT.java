package vn.aurelia.hbs.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import vn.aurelia.hbs.support.AbstractIntegrationTest;

/**
 * Kiểm thử tầng CSDL: ràng buộc bảo vệ dữ liệu kể cả khi có lỗi ở tầng ứng dụng (ghi thẳng SQL).
 * Phòng 501–503 (Luxury Suite), ngày +500.
 */
@DisplayName("Ràng buộc cơ sở dữ liệu")
class DatabaseConstraintIT extends AbstractIntegrationTest {
    private static final String PROPERTY = "00000000-0000-0000-0000-000000000001";
    private static final String SANJAY = "00000000-0000-0000-0000-0000000000b2";

    private void insert(String room, LocalDate in, LocalDate out, String status) {
        UUID plan = jdbc.queryForObject("select id from room_plans where room_type_id = ?::uuid and plan_code = 'EP'",
                UUID.class, LUXURY);
        jdbc.update("""
                insert into bookings (booking_ref, property_id, guest_id, room_id, room_plan_id, channel_code,
                  check_in_date, check_out_date, room_amount, service_fee, tax_amount, total_amount, status)
                values (?, ?::uuid, ?::uuid, ?, ?, 'DIRECT', ?, ?, 1, 0, 0, 1, ?)""",
                "BK-DB-" + UUID.randomUUID().toString().substring(0, 8), PROPERTY, SANJAY, roomId(room), plan, in,
                out, status);
    }

    @Test
    @DisplayName("TC-DB-01 EXCLUDE chặn hai đặt phòng hiệu lực chồng ngày trên cùng phòng")
    void excludeOverlap() {
        LocalDate in = today().plusDays(500);
        insert("501", in, in.plusDays(3), "CONFIRMED");
        assertThatThrownBy(() -> insert("501", in.plusDays(1), in.plusDays(2), "CHECKED_IN"))
                .isInstanceOf(DataIntegrityViolationException.class).hasMessageContaining("ex_bookings_no_overlap");
    }

    @Test
    @DisplayName("TC-DB-02 Trả và nhận cùng ngày không trùng; đặt phòng đã hủy hoặc chờ không giữ phòng")
    void halfOpenRangeAndStatuses() {
        LocalDate in = today().plusDays(510);
        insert("502", in, in.plusDays(2), "CONFIRMED");
        assertThatCode(() -> insert("502", in.plusDays(2), in.plusDays(4), "CONFIRMED")).doesNotThrowAnyException();
        assertThatCode(() -> insert("502", in, in.plusDays(2), "CANCELLED")).doesNotThrowAnyException();
        assertThatCode(() -> insert("502", in, in.plusDays(2), "PENDING")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("TC-DB-03 CHECK: trả phòng sau nhận phòng, tối đa 30 đêm, trạng thái hợp lệ")
    void checks() {
        LocalDate in = today().plusDays(520);
        assertThatThrownBy(() -> insert("503", in, in, "PENDING")).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insert("503", in, in.plusDays(31), "PENDING"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insert("503", in, in.plusDays(1), "UNKNOWN"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("TC-DB-04 total_nights là cột sinh tự động; số phòng là duy nhất")
    void generatedAndUnique() {
        LocalDate in = today().plusDays(530);
        insert("503", in, in.plusDays(4), "PENDING");
        Integer nights = jdbc.queryForObject(
                "select total_nights from bookings where room_id = ? and check_in_date = ?", Integer.class,
                roomId("503"), in);
        assertThat(nights).isEqualTo(4);
        assertThatThrownBy(() -> jdbc.update("insert into rooms (property_id, room_number, floor, room_type_id) "
                + "values (?::uuid, '501', 5, ?::uuid)", PROPERTY, LUXURY))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("TC-DB-05 Flyway đã chạy đủ 4 migration, mật khẩu mẫu băm bcrypt")
    void migrations() {
        Integer applied = jdbc.queryForObject("select count(*) from flyway_schema_history where success", Integer.class);
        assertThat(applied).isGreaterThanOrEqualTo(4);
        String hash = jdbc.queryForObject("select password_hash from users where email = ?", String.class, ADMIN);
        assertThat(hash).startsWith("$2");
    }
}
