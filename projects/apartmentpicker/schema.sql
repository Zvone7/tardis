-- ============================================================
-- ApartmentPicker Database Schema
-- SQL Server, GUID primary keys, CHECK constraints for enums
-- ============================================================

-- ============================================================
-- 1) RankingCase
-- Top-level container: "Renting Oslo 2026", "Buying cabin", etc.
-- ============================================================
CREATE TABLE RankingCase (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Name            NVARCHAR(200)    NOT NULL,
    Description     NVARCHAR(2000)   NULL,
    Currency        NVARCHAR(10)     NULL,          -- e.g. NOK, EUR, USD
    CreatedAt       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RankingCase PRIMARY KEY (Id)
);

-- ============================================================
-- 2) Criterion
-- A scoring dimension within a ranking case.
-- dataType determines which scoring sub-table applies.
-- missingValueHandling controls what happens when an apartment
--   has no value for this criterion.
-- ============================================================
CREATE TABLE Criterion (
    Id                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    RankingCaseId           UNIQUEIDENTIFIER NOT NULL,
    Name                    NVARCHAR(200)    NOT NULL,
    Description             NVARCHAR(2000)   NULL,
    IncludeInRanking        BIT              NOT NULL DEFAULT 1,
    DataType                VARCHAR(20)      NOT NULL,     -- Number | Boolean | Enum | Text
    Unit                    NVARCHAR(50)     NULL,          -- e.g. "min", "NOK", "sqm"
    Weight                  INT              NOT NULL DEFAULT 3,
    MissingValueHandling    VARCHAR(20)      NOT NULL DEFAULT 'Ignore',  -- Ignore | TreatAsZero | Penalize
    SortOrder               INT              NOT NULL DEFAULT 0,
    CreatedAt               DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt               DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Criterion PRIMARY KEY (Id),
    CONSTRAINT FK_Criterion_RankingCase FOREIGN KEY (RankingCaseId)
        REFERENCES RankingCase (Id) ON DELETE CASCADE,
    CONSTRAINT CK_Criterion_DataType
        CHECK (DataType IN ('Number', 'Boolean', 'Enum', 'Text')),
    CONSTRAINT CK_Criterion_Weight
        CHECK (Weight BETWEEN 1 AND 5),
    CONSTRAINT CK_Criterion_MissingValueHandling
        CHECK (MissingValueHandling IN ('Ignore', 'TreatAsZero', 'Penalize'))
);

CREATE INDEX IX_Criterion_RankingCaseId ON Criterion (RankingCaseId);

-- ============================================================
-- 3) CriterionNumericInterval
-- Scoring intervals for Number-type criteria.
-- NULL IntervalStart = -infinity, NULL IntervalEnd = +infinity.
-- When both are non-null, start must be < end.
-- ============================================================
CREATE TABLE CriterionNumericInterval (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CriterionId     UNIQUEIDENTIFIER NOT NULL,
    IntervalStart   DECIMAL(18,4)    NULL,      -- NULL = -infinity
    IntervalEnd     DECIMAL(18,4)    NULL,      -- NULL = +infinity
    Score           INT              NOT NULL,
    SortOrder       INT              NOT NULL DEFAULT 0,

    CONSTRAINT PK_CriterionNumericInterval PRIMARY KEY (Id),
    CONSTRAINT FK_CriterionNumericInterval_Criterion FOREIGN KEY (CriterionId)
        REFERENCES Criterion (Id) ON DELETE CASCADE,
    -- When both bounds are present, start must be less than end
    CONSTRAINT CK_CriterionNumericInterval_Validity
        CHECK (IntervalStart IS NULL OR IntervalEnd IS NULL OR IntervalStart < IntervalEnd)
);

CREATE INDEX IX_CriterionNumericInterval_CriterionId ON CriterionNumericInterval (CriterionId);

-- ============================================================
-- 4) CriterionBooleanRule
-- Scoring for Boolean-type criteria. One row per criterion.
-- Uses CriterionId as PK (1:1 with Criterion).
-- ============================================================
CREATE TABLE CriterionBooleanRule (
    CriterionId     UNIQUEIDENTIFIER NOT NULL,
    ScoreWhenTrue   INT              NOT NULL DEFAULT 0,
    ScoreWhenFalse  INT              NOT NULL DEFAULT 0,

    CONSTRAINT PK_CriterionBooleanRule PRIMARY KEY (CriterionId),
    CONSTRAINT FK_CriterionBooleanRule_Criterion FOREIGN KEY (CriterionId)
        REFERENCES Criterion (Id) ON DELETE CASCADE
);

-- ============================================================
-- 5) CriterionEnumOption
-- Scoring options for Enum-type criteria.
-- Each option has a label (Value) and a score.
-- (CriterionId, Value) must be unique.
-- ============================================================
CREATE TABLE CriterionEnumOption (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    CriterionId     UNIQUEIDENTIFIER NOT NULL,
    Value           NVARCHAR(200)    NOT NULL,
    Score           INT              NOT NULL DEFAULT 0,
    SortOrder       INT              NOT NULL DEFAULT 0,

    CONSTRAINT PK_CriterionEnumOption PRIMARY KEY (Id),
    CONSTRAINT FK_CriterionEnumOption_Criterion FOREIGN KEY (CriterionId)
        REFERENCES Criterion (Id) ON DELETE CASCADE,
    CONSTRAINT UQ_CriterionEnumOption_Value UNIQUE (CriterionId, Value)
);

CREATE INDEX IX_CriterionEnumOption_CriterionId ON CriterionEnumOption (CriterionId);

-- ============================================================
-- 6) Apartment
-- An apartment/property being evaluated within a ranking case.
-- status tracks the lifecycle of the application/interest.
-- ============================================================
CREATE TABLE Apartment (
    Id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    RankingCaseId       UNIQUEIDENTIFIER NOT NULL,
    Name                NVARCHAR(300)    NOT NULL,
    SillyName           NVARCHAR(300)    NULL,          -- Fun nickname for the apartment
    Link                NVARCHAR(2000)   NULL,          -- URL to listing (e.g. Finn.no)
    Comment             NVARCHAR(4000)   NULL,
    HiddenFromRanking   BIT              NOT NULL DEFAULT 0,
    Status              VARCHAR(20)      NOT NULL DEFAULT 'Considering',
    CreatedAt           DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Apartment PRIMARY KEY (Id),
    CONSTRAINT FK_Apartment_RankingCase FOREIGN KEY (RankingCaseId)
        REFERENCES RankingCase (Id) ON DELETE CASCADE,
    CONSTRAINT CK_Apartment_Status
        CHECK (Status IN ('Considering', 'Applied', 'Rejected', 'Won', 'Lost'))
);

CREATE INDEX IX_Apartment_RankingCaseId ON Apartment (RankingCaseId);

-- ============================================================
-- 7) ApartmentCriterionValue
-- The actual value an apartment has for a given criterion.
-- Exactly ONE of (NumberValue, BoolValue, EnumOptionId, TextValue)
-- must be non-null, matching the criterion's DataType.
-- Unique per (ApartmentId, CriterionId) - one value per criterion per apartment.
-- ============================================================
CREATE TABLE ApartmentCriterionValue (
    Id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    ApartmentId     UNIQUEIDENTIFIER NOT NULL,
    CriterionId     UNIQUEIDENTIFIER NOT NULL,
    NumberValue     DECIMAL(18,4)    NULL,
    BoolValue       BIT              NULL,
    EnumOptionId    UNIQUEIDENTIFIER NULL,      -- FK to CriterionEnumOption
    TextValue       NVARCHAR(4000)   NULL,

    CONSTRAINT PK_ApartmentCriterionValue PRIMARY KEY (Id),
    CONSTRAINT FK_ApartmentCriterionValue_Apartment FOREIGN KEY (ApartmentId)
        REFERENCES Apartment (Id) ON DELETE CASCADE,
    -- CriterionId cannot cascade because Criterion also cascades from RankingCase,
    -- and Apartment cascades from RankingCase too, creating multiple cascade paths.
    -- We use NO ACTION here; deleting a criterion requires cleaning up values first
    -- (or handle via application logic / trigger).
    CONSTRAINT FK_ApartmentCriterionValue_Criterion FOREIGN KEY (CriterionId)
        REFERENCES Criterion (Id) ON DELETE NO ACTION,
    CONSTRAINT FK_ApartmentCriterionValue_EnumOption FOREIGN KEY (EnumOptionId)
        REFERENCES CriterionEnumOption (Id) ON DELETE NO ACTION,
    -- Exactly one value field must be non-null
    CONSTRAINT CK_ApartmentCriterionValue_ExactlyOneValue CHECK (
        (CASE WHEN NumberValue  IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN BoolValue    IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN EnumOptionId IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN TextValue    IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),
    -- One value per apartment per criterion
    CONSTRAINT UQ_ApartmentCriterionValue_ApartmentCriterion UNIQUE (ApartmentId, CriterionId)
);

CREATE INDEX IX_ApartmentCriterionValue_ApartmentId ON ApartmentCriterionValue (ApartmentId);
CREATE INDEX IX_ApartmentCriterionValue_CriterionId ON ApartmentCriterionValue (CriterionId);

-- ============================================================
-- 8) app_user
-- Application users authenticated via Google OAuth.
-- Admin approves new users before they can access the app.
-- ============================================================
CREATE TABLE app_user (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    email           NVARCHAR(255)   NOT NULL UNIQUE,
    name            NVARCHAR(255)   NULL,
    role            NVARCHAR(50)    NOT NULL DEFAULT 'user',
    created_at_utc  DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    approved_at_utc DATETIME2       NULL,
    is_approved     BIT             NOT NULL DEFAULT 0
);
