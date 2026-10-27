package vn.aurelia.hbs;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import jakarta.persistence.Entity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;

/** Kiểm thử kiến trúc: giữ ranh giới lớp controller → service → repository và module dùng chung độc lập. */
@AnalyzeClasses(packages = "vn.aurelia.hbs", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    private static final String[] FEATURES = {"..auth..", "..booking..", "..room..", "..guest..", "..folio..",
            "..pricing..", "..promotion..", "..payment..", "..dashboard..", "..document..", "..housekeeping..",
            "..staff..", "..search..", "..property..", "..storage..", "..notification.."};

    @ArchTest
    static final ArchRule controllersDoNotTouchRepositories = noClasses().that().areAnnotatedWith(RestController.class)
            .should().dependOnClassesThat().haveSimpleNameEndingWith("Repository")
            .because("controller chỉ gọi service; truy cập dữ liệu nằm ở tầng service");

    @ArchTest
    static final ArchRule servicesDoNotDependOnControllers = noClasses().that().areAnnotatedWith(Service.class)
            .should().dependOnClassesThat().areAnnotatedWith(RestController.class);

    @ArchTest
    static final ArchRule controllersNamedAndPlaced = classes().that().areAnnotatedWith(RestController.class)
            .should().haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule entitiesArePlainData = noClasses().that().areAnnotatedWith(Entity.class)
            .should().dependOnClassesThat().areAnnotatedWith(Service.class)
            .orShould().dependOnClassesThat().areAnnotatedWith(RestController.class);

    @ArchTest
    static final ArchRule commonIsIndependent = noClasses().that().resideInAnyPackage("..hbs.common..",
                    "..hbs.config..", "..hbs.security..")
            .should().dependOnClassesThat().resideInAnyPackage(FEATURES)
            .because("module dùng chung không được phụ thuộc module nghiệp vụ");

    @ArchTest
    static final ArchRule noFieldInjection = fields().should().notBeAnnotatedWith(Autowired.class)
            .because("dùng constructor injection để dễ test và bất biến");

    @ArchTest
    static final ArchRule noTransactionalControllers = methods().that().areDeclaredInClassesThat()
            .areAnnotatedWith(RestController.class).should().notBeAnnotatedWith(Transactional.class);

    @ArchTest
    static final ArchRule noSystemOut = noClasses().should().accessField(System.class, "out")
            .orShould().accessField(System.class, "err").because("dùng SLF4J để log");
}
