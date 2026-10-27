package vn.aurelia.hbs.housekeeping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.aurelia.hbs.common.ApiException;
import vn.aurelia.hbs.common.AuditService;
import vn.aurelia.hbs.common.ErrorCode;
import vn.aurelia.hbs.common.JsonCache;
import vn.aurelia.hbs.property.Property;
import vn.aurelia.hbs.property.PropertyService;
import vn.aurelia.hbs.room.Room;
import vn.aurelia.hbs.room.RoomRepository;
import vn.aurelia.hbs.room.RoomStatus;
import vn.aurelia.hbs.room.RoomType;
import vn.aurelia.hbs.support.SecurityTestUtil;
import vn.aurelia.hbs.user.Role;

/** Bảng chuyển trạng thái phòng SRS 12.2, kiểm thử theo bảng quyết định. */
@ExtendWith(MockitoExtension.class)
@DisplayName("HousekeepingService – chuyển trạng thái phòng")
class HousekeepingServiceTest {
    @Mock HousekeepingTaskRepository tasks;
    @Mock RoomRepository rooms;
    @Mock PropertyService propertyService;
    @Mock AuditService audit;
    @Mock JsonCache cache;

    HousekeepingService service;
    Room room;

    @BeforeEach
    void setUp() {
        SecurityTestUtil.loginAs(Role.RECEPTIONIST);
        service = new HousekeepingService(tasks, rooms, propertyService, audit, cache, Clock.systemUTC());
        Property p = new Property();
        p.setId(SecurityTestUtil.PROPERTY);
        lenient().when(propertyService.current()).thenReturn(p);
        RoomType t = new RoomType();
        t.setName("Deluxe Ocean");
        room = new Room();
        room.setId(UUID.randomUUID());
        room.setPropertyId(SecurityTestUtil.PROPERTY);
        room.setRoomNumber("301");
        room.setRoomType(t);
        lenient().when(rooms.findById(room.getId())).thenReturn(Optional.of(room));
        lenient().when(tasks.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(tasks.findByRoomIdAndTypeAndStatusIn(any(), any(), anyCollection())).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        SecurityTestUtil.clear();
    }

    @ParameterizedTest(name = "{0} → {1}: {2}")
    @CsvSource({
            "AVAILABLE, DIRTY, true",
            "AVAILABLE, OUT_OF_ORDER, true",
            "DIRTY, AVAILABLE, true",
            "DIRTY, OUT_OF_ORDER, true",
            "OUT_OF_ORDER, DIRTY, true",
            "OUT_OF_ORDER, AVAILABLE, false",
            "OCCUPIED, OUT_OF_ORDER, false",
            "OCCUPIED, DIRTY, false",
            "OCCUPIED, AVAILABLE, false",
            "AVAILABLE, AVAILABLE, false"
    })
    void transitions(RoomStatus from, RoomStatus to, boolean allowed) {
        room.setStatus(from);
        var req = new HousekeepingService.StatusChange(to, "Lý do kiểm thử", null);
        if (allowed) {
            service.changeStatus(room.getId(), req);
            assertThat(room.getStatus()).isEqualTo(to);
        } else {
            assertThatThrownBy(() -> service.changeStatus(room.getId(), req)).isInstanceOf(ApiException.class)
                    .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.INVALID_STATUS_TRANSITION);
            assertThat(room.getStatus()).isEqualTo(from);
        }
    }

    @Test
    @DisplayName("Không đặt tay sang OCCUPIED")
    void occupiedOnlyViaCheckIn() {
        room.setStatus(RoomStatus.AVAILABLE);
        assertThatThrownBy(() -> service.changeStatus(room.getId(),
                new HousekeepingService.StatusChange(RoomStatus.OCCUPIED, null, null)))
                .hasMessageContaining("check-in");
    }

    @Test
    @DisplayName("Báo hỏng tạo việc MAINTENANCE và làm mới cache phòng trống")
    void outOfOrderCreatesMaintenanceTask() {
        room.setStatus(RoomStatus.AVAILABLE);
        service.changeStatus(room.getId(), new HousekeepingService.StatusChange(RoomStatus.OUT_OF_ORDER, "Hỏng", null));
        ArgumentCaptor<HousekeepingTask> saved = ArgumentCaptor.forClass(HousekeepingTask.class);
        verify(tasks).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(TaskType.MAINTENANCE);
        assertThat(saved.getValue().getFromStatus()).isEqualTo(RoomStatus.AVAILABLE);
        verify(cache).evictPrefix(eq(JsonCache.AVAILABILITY));
    }

    @Test
    @DisplayName("Báo hỏng phải có lý do")
    void outOfOrderNeedsReason() {
        room.setStatus(RoomStatus.AVAILABLE);
        assertThatThrownBy(() -> service.changeStatus(room.getId(),
                new HousekeepingService.StatusChange(RoomStatus.OUT_OF_ORDER, " ", null)))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
    }

    @Test
    @DisplayName("Check-in chỉ khi phòng AVAILABLE (BR-11); check-out chuyển DIRTY và mở việc dọn")
    void checkInOut() {
        room.setStatus(RoomStatus.DIRTY);
        assertThatThrownBy(() -> service.onCheckIn(room)).extracting(e -> ((ApiException) e).getCode())
                .isEqualTo(ErrorCode.ROOM_UNAVAILABLE);
        room.setStatus(RoomStatus.AVAILABLE);
        service.onCheckIn(room);
        assertThat(room.getStatus()).isEqualTo(RoomStatus.OCCUPIED);
        service.onCheckOut(room);
        assertThat(room.getStatus()).isEqualTo(RoomStatus.DIRTY);
        ArgumentCaptor<HousekeepingTask> saved = ArgumentCaptor.forClass(HousekeepingTask.class);
        verify(tasks).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(TaskType.CLEANING);
    }

    @Test
    @DisplayName("Phòng của chi nhánh khác coi như không tồn tại")
    void otherProperty() {
        room.setPropertyId(UUID.randomUUID());
        assertThatThrownBy(() -> service.changeStatus(room.getId(),
                new HousekeepingService.StatusChange(RoomStatus.DIRTY, null, null)))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.ROOM_NOT_FOUND);
    }
}
