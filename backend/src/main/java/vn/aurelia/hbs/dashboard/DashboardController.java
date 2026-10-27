package vn.aurelia.hbs.dashboard;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.aurelia.hbs.common.ApiResponse;

/** Khoảng ngày dạng [from, to): to không bao gồm. */
@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard và báo cáo (DASH, RPT)")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('RECEPTIONIST','ADMIN')")
    public ApiResponse<DashboardService.Summary> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
        return ApiResponse.of(service.summary(date));
    }

    @GetMapping("/kpis")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DashboardService.Kpis> kpis(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return ApiResponse.of(service.kpis(from, to));
    }

    @GetMapping("/sales")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<DashboardService.SalesRow>> sales(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return ApiResponse.of(service.sales(from, to));
    }

    @GetMapping("/booking-sources")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<DashboardService.SourceRow>> sources(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return ApiResponse.of(service.sources(from, to));
    }

    @GetMapping("/revenue-breakdown")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<DashboardService.BreakdownRow>> breakdown(
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return ApiResponse.of(service.revenueBreakdown(from, to));
    }
}
