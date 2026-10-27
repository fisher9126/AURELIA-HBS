package vn.aurelia.hbs.folio;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import vn.aurelia.hbs.booking.Booking;
import vn.aurelia.hbs.booking.BookingStatus;
import vn.aurelia.hbs.booking.PaymentStatus;

class FolioCalculatorTest {

    @Test
    void balanceIncludesChargesAndPayments() {
        Booking b = booking(BookingStatus.CHECKED_IN, 5_175_000);
        var t = FolioCalculator.totals(b, List.of(pay(PaymentType.DEPOSIT, 2_000_000)),
                List.of(charge(2, 150_000)));
        assertThat(t.grandTotal()).isEqualTo(5_475_000);
        assertThat(t.paid()).isEqualTo(2_000_000);
        assertThat(t.balance()).isEqualTo(3_475_000);
        assertThat(FolioCalculator.statusOf(t)).isEqualTo(PaymentStatus.PARTIAL);
    }

    @Test
    void cancelledBookingOnlyOwesFee() {
        Booking b = booking(BookingStatus.CANCELLED, 5_175_000);
        b.setCancellationFee(1_293_750);
        var t = FolioCalculator.totals(b, List.of(pay(PaymentType.DEPOSIT, 2_000_000)), List.of());
        assertThat(t.balance()).isEqualTo(-706_250); // còn phải hoàn cho khách
        var refunded = FolioCalculator.totals(b, List.of(pay(PaymentType.DEPOSIT, 2_000_000),
                pay(PaymentType.REFUND, 2_000_000)), List.of());
        assertThat(FolioCalculator.statusOf(refunded)).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    void paidInFull() {
        Booking b = booking(BookingStatus.CONFIRMED, 1_000_000);
        var t = FolioCalculator.totals(b, List.of(pay(PaymentType.PAYMENT, 1_000_000)), List.of());
        assertThat(FolioCalculator.statusOf(t)).isEqualTo(PaymentStatus.PAID);
    }

    private static Booking booking(BookingStatus status, long total) {
        Booking b = new Booking();
        b.setId(UUID.randomUUID());
        b.setStatus(status);
        b.setTotalAmount(total);
        return b;
    }

    private static Payment pay(PaymentType type, long amount) {
        Payment p = new Payment();
        p.setType(type);
        p.setMethod(PaymentMethod.CASH);
        p.setAmount(amount);
        p.setStatus(PaymentRecordStatus.COMPLETED);
        return p;
    }

    private static BookingCharge charge(int qty, long unit) {
        BookingCharge c = new BookingCharge();
        c.setType(ChargeType.MINIBAR);
        c.setQuantity(qty);
        c.setUnitPrice(unit);
        return c;
    }
}
