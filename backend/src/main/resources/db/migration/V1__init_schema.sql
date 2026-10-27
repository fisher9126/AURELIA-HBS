-- Aurelia HBS · SRS v2.0 · Mục 8: 20 bảng
-- Tiền lưu BIGINT (đồng). Enum dùng VARCHAR + CHECK để Hibernate map EnumType.STRING.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ===================== Tổ chức và tài khoản =====================
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    address         VARCHAR(255) NOT NULL,
    tax_code        VARCHAR(20),
    hotline         VARCHAR(20),
    email           VARCHAR(255),
    logo_url        VARCHAR(500),
    vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 10,
    service_rate    NUMERIC(5,2) NOT NULL DEFAULT 5,
    check_in_time   TIME NOT NULL DEFAULT '14:00',
    check_out_time  TIME NOT NULL DEFAULT '12:00',
    terms_text      TEXT,
    currency        CHAR(3) NOT NULL DEFAULT 'VND',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id           UUID REFERENCES properties(id),
    full_name             VARCHAR(100) NOT NULL,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    password_hash         VARCHAR(255),
    phone                 VARCHAR(20),
    role                  VARCHAR(20) NOT NULL DEFAULT 'GUEST' CHECK (role IN ('GUEST','RECEPTIONIST','ADMIN')),
    oauth_provider        VARCHAR(20) CHECK (oauth_provider IN ('GOOGLE','APPLE')),
    must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_count    INT NOT NULL DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('REFRESH','PASSWORD_RESET')),
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    user_agent  VARCHAR(255),
    ip          VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, type);

CREATE TABLE audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID REFERENCES users(id),
    action       VARCHAR(50) NOT NULL,
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    UUID NOT NULL,
    old_values   JSONB,
    new_values   JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== Phòng và giá =====================
CREATE TABLE room_types (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id   UUID NOT NULL REFERENCES properties(id),
    name          VARCHAR(50) NOT NULL,
    slug          VARCHAR(60) NOT NULL UNIQUE,
    description   TEXT,
    area_m2       NUMERIC(5,1),
    bed_type      VARCHAR(50),
    view_type     VARCHAR(50),
    max_adults    INT NOT NULL CHECK (max_adults >= 1),
    max_children  INT NOT NULL DEFAULT 0 CHECK (max_children >= 0),
    base_price    BIGINT NOT NULL CHECK (base_price > 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, name)
);

CREATE TABLE room_images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id  UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    url           VARCHAR(500) NOT NULL,
    object_key    VARCHAR(300) NOT NULL,
    caption       VARCHAR(100),
    sort_order    INT NOT NULL DEFAULT 0,
    is_cover      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX uq_room_images_cover ON room_images(room_type_id) WHERE is_cover;

CREATE TABLE amenities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(80) NOT NULL UNIQUE,
    category       VARCHAR(20) NOT NULL CHECK (category IN ('BATHROOM','TECH','REFRESHMENT','VIEW','GENERAL')),
    icon           VARCHAR(40),
    is_filterable  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE room_type_amenities (
    room_type_id  UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    amenity_id    UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (room_type_id, amenity_id)
);

CREATE TABLE rooms (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id   UUID NOT NULL REFERENCES properties(id),
    room_number   VARCHAR(10) NOT NULL,
    floor         INT NOT NULL,
    room_type_id  UUID NOT NULL REFERENCES room_types(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','DIRTY','OUT_OF_ORDER')),
    is_dnd        BOOLEAN NOT NULL DEFAULT FALSE,
    description   TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, room_number)
);

CREATE TABLE room_plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id         UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    plan_code            VARCHAR(5) NOT NULL CHECK (plan_code IN ('EP','CP','MAP','AP')),
    plan_name            VARCHAR(100) NOT NULL,
    meals_included       VARCHAR(150),
    surcharge_per_night  BIGINT NOT NULL DEFAULT 0 CHECK (surcharge_per_night >= 0),
    is_recommended       BOOLEAN NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (room_type_id, plan_code)
);

CREATE TABLE seasonal_rules (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id    UUID NOT NULL REFERENCES properties(id),
    name           VARCHAR(100) NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    multiplier     NUMERIC(4,2) NOT NULL CHECK (multiplier BETWEEN 0.5 AND 3.0),
    priority       INT NOT NULL DEFAULT 0,
    room_type_ids  UUID[],
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

CREATE TABLE booking_channels (
    code             VARCHAR(20) PRIMARY KEY,
    name             VARCHAR(80) NOT NULL,
    commission_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,
    color            CHAR(7) NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE promotions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(30) NOT NULL UNIQUE,
    discount_type     VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT')),
    discount_value    BIGINT NOT NULL CHECK (discount_value > 0),
    min_nights        INT NOT NULL DEFAULT 1,
    book_before_days  INT,
    stay_from         DATE,
    stay_to           DATE,
    valid_from        DATE NOT NULL,
    valid_to          DATE NOT NULL,
    max_uses          INT,
    used_count        INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ===================== Khách và đặt phòng =====================
CREATE TABLE guests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID UNIQUE REFERENCES users(id),
    full_name         VARCHAR(150) NOT NULL,
    email             VARCHAR(255),
    phone             VARCHAR(20) NOT NULL,
    id_type           VARCHAR(10) CHECK (id_type IN ('CCCD','PASSPORT')),
    id_number         VARCHAR(30),
    nationality       CHAR(2) NOT NULL DEFAULT 'VN',
    date_of_birth     DATE,
    is_vip            BOOLEAN NOT NULL DEFAULT FALSE,
    notes             TEXT,
    notes_updated_by  UUID REFERENCES users(id),
    notes_updated_at  TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_guests_phone ON guests(phone);
CREATE INDEX idx_guests_name ON guests(lower(full_name));

CREATE TABLE booking_groups (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(150) NOT NULL,
    contact_guest_id  UUID REFERENCES guests(id),
    channel_code      VARCHAR(20) REFERENCES booking_channels(code),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref        VARCHAR(20) NOT NULL UNIQUE,
    property_id        UUID NOT NULL REFERENCES properties(id),
    guest_id           UUID NOT NULL REFERENCES guests(id),
    room_id            UUID NOT NULL REFERENCES rooms(id),
    room_plan_id       UUID NOT NULL REFERENCES room_plans(id),
    group_id           UUID REFERENCES booking_groups(id),
    promotion_id       UUID REFERENCES promotions(id),
    channel_code       VARCHAR(20) NOT NULL REFERENCES booking_channels(code),
    check_in_date      DATE NOT NULL,
    check_out_date     DATE NOT NULL,
    total_nights       INT GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    adults             INT NOT NULL DEFAULT 1 CHECK (adults >= 1),
    children           INT NOT NULL DEFAULT 0 CHECK (children >= 0),
    estimated_arrival  VARCHAR(20),
    bed_preference     VARCHAR(10) CHECK (bed_preference IN ('KING','TWIN')),
    special_requests   TEXT,
    room_amount        BIGINT NOT NULL,
    discount_amount    BIGINT NOT NULL DEFAULT 0,
    service_fee        BIGINT NOT NULL,
    tax_amount         BIGINT NOT NULL,
    total_amount       BIGINT NOT NULL,
    commission_amount  BIGINT NOT NULL DEFAULT 0,
    payment_status     VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID','PARTIAL','PAID','REFUNDED')),
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')),
    id_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at      TIMESTAMPTZ,
    checked_out_at     TIMESTAMPTZ,
    cancelled_at       TIMESTAMPTZ,
    cancel_reason      VARCHAR(30) CHECK (cancel_reason IN ('CHANGE_OF_PLANS','EMERGENCY','CHEAPER_RATE','HEALTH','OTHER')),
    cancel_note        TEXT,
    cancellation_fee   BIGINT NOT NULL DEFAULT 0,
    refund_amount      BIGINT NOT NULL DEFAULT 0,
    created_by         UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (check_out_date > check_in_date),
    CHECK (check_out_date - check_in_date <= 30)
);
CREATE INDEX idx_bookings_room_dates ON bookings(room_id, check_in_date, check_out_date);
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- BR-05 / CD-01: CSDL tự chặn hai đặt phòng đang hiệu lực chồng ngày trên cùng phòng
ALTER TABLE bookings ADD CONSTRAINT ex_bookings_no_overlap
    EXCLUDE USING gist (room_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&)
    WHERE (status IN ('CONFIRMED','CHECKED_IN'));

CREATE TABLE cancellation_tiers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id      UUID NOT NULL REFERENCES properties(id),
    hours_from       INT NOT NULL CHECK (hours_from >= 0),
    hours_to         INT,
    penalty_percent  NUMERIC(5,2) NOT NULL CHECK (penalty_percent BETWEEN 0 AND 100),
    description      VARCHAR(100)
);

-- ===================== Tài chính =====================
CREATE TABLE booking_charges (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('MINIBAR','FOOD_BEVERAGE','SPA','LAUNDRY','LATE_CHECKOUT','EXTRA_BED','OTHER')),
    description  VARCHAR(200),
    quantity     INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    unit_price   BIGINT NOT NULL CHECK (unit_price >= 0),
    amount       BIGINT GENERATED ALWAYS AS (quantity * unit_price) STORED,
    charged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID REFERENCES users(id)
);

CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    type             VARCHAR(10) NOT NULL CHECK (type IN ('DEPOSIT','PAYMENT','REFUND')),
    method           VARCHAR(20) NOT NULL CHECK (method IN ('CASH','CARD','BANK_TRANSFER','MOMO','VNPAY','OTA_COLLECT')),
    amount           BIGINT NOT NULL CHECK (amount > 0),
    status           VARCHAR(10) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED')),
    transaction_ref  VARCHAR(100),
    paid_at          TIMESTAMPTZ,
    note             VARCHAR(255),
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ===================== Vận hành =====================
CREATE TABLE housekeeping_tasks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           UUID NOT NULL REFERENCES rooms(id),
    type              VARCHAR(20) NOT NULL CHECK (type IN ('CLEANING','INSPECTION','MAINTENANCE')),
    status            VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
    from_status       VARCHAR(20),
    to_status         VARCHAR(20),
    reason            VARCHAR(255),
    assigned_to       VARCHAR(100),
    expected_done_at  TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hk_room_status ON housekeeping_tasks(room_id, status);
