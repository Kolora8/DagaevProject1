-- ============================================================
--  ЗдравМонитор — система мониторинга здравоохранения регионов РФ
--  Схема базы данных PostgreSQL
-- ============================================================
--  Запуск:  psql -U postgres -f schema.sql
-- ============================================================

DROP DATABASE IF EXISTS zdravmonitor;
CREATE DATABASE zdravmonitor;
\connect zdravmonitor

SET client_encoding = 'UTF8';

-- ------------------------------------------------------------
--  Регионы (субъекты Российской Федерации)
-- ------------------------------------------------------------
CREATE TABLE regions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(8)  NOT NULL UNIQUE,   -- краткий код (напр. MOW, SPE)
    name        VARCHAR(128) NOT NULL,         -- название субъекта
    federal_okrug VARCHAR(64),                 -- федеральный округ
    population  INTEGER,                       -- население, чел.
    grid_x      INTEGER NOT NULL,              -- позиция плитки на карте (столбец)
    grid_y      INTEGER NOT NULL               -- позиция плитки на карте (строка)
);

-- ------------------------------------------------------------
--  Текущие показатели здравоохранения по региону
-- ------------------------------------------------------------
CREATE TABLE health_indicators (
    id              SERIAL PRIMARY KEY,
    region_id       INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    period          VARCHAR(16) NOT NULL,          -- период, напр. '2026-Q1'
    hospitals       INTEGER,                       -- число больниц
    doctors_per_10k NUMERIC(6,1),                  -- врачей на 10 000 населения
    beds_per_10k    NUMERIC(6,1),                  -- коек на 10 000 населения
    life_expectancy NUMERIC(5,1),                  -- ожидаемая продолжительность жизни
    incidence_rate  NUMERIC(8,1),                  -- заболеваемость на 100 000
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (region_id, period)
);

-- ------------------------------------------------------------
--  Прогнозы (редактируемые) по региону
-- ------------------------------------------------------------
CREATE TABLE forecasts (
    id            SERIAL PRIMARY KEY,
    region_id     INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    horizon_year  INTEGER NOT NULL,                -- год прогноза
    metric        VARCHAR(64) NOT NULL,            -- название показателя
    value         NUMERIC(12,2) NOT NULL,          -- прогнозное значение
    unit          VARCHAR(32),                     -- единица измерения
    note          TEXT,                            -- комментарий аналитика
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
--  Медицинское оборудование / устройства (можно добавлять)
-- ------------------------------------------------------------
CREATE TABLE devices (
    id            SERIAL PRIMARY KEY,
    region_id     INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    name          VARCHAR(128) NOT NULL,           -- наименование устройства
    category      VARCHAR(64),                     -- категория (МРТ, КТ, ИВЛ, УЗИ ...)
    quantity      INTEGER NOT NULL DEFAULT 1,      -- количество
    status        VARCHAR(32) NOT NULL DEFAULT 'в эксплуатации',
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_indicators_region ON health_indicators(region_id);
CREATE INDEX idx_forecasts_region  ON forecasts(region_id);
CREATE INDEX idx_devices_region    ON devices(region_id);

-- ============================================================
--  ДЕМО-ДАННЫЕ
-- ============================================================

INSERT INTO regions (code, name, federal_okrug, population, grid_x, grid_y) VALUES
 ('MOW', 'Москва',                 'Центральный',   13100000, 5, 3),
 ('MOS', 'Московская область',     'Центральный',    8500000, 5, 2),
 ('SPE', 'Санкт-Петербург',        'Северо-Западный',5600000, 4, 1),
 ('LEN', 'Ленинградская область',  'Северо-Западный',2000000, 4, 0),
 ('KDA', 'Краснодарский край',     'Южный',          5800000, 4, 5),
 ('ROS', 'Ростовская область',     'Южный',          4200000, 5, 5),
 ('TAT', 'Республика Татарстан',   'Приволжский',    3900000, 7, 3),
 ('NIZ', 'Нижегородская область',  'Приволжский',    3200000, 6, 3),
 ('SAM', 'Самарская область',      'Приволжский',    3200000, 7, 4),
 ('SVE', 'Свердловская область',   'Уральский',      4300000, 9, 2),
 ('CHE', 'Челябинская область',    'Уральский',      3400000, 9, 3),
 ('NVS', 'Новосибирская область',  'Сибирский',      2800000,11, 3),
 ('KYA', 'Красноярский край',      'Сибирский',      2900000,10, 2),
 ('IRK', 'Иркутская область',      'Сибирский',      2400000,12, 3),
 ('PRI', 'Приморский край',        'Дальневосточный',1900000,14, 4),
 ('KHA', 'Хабаровский край',       'Дальневосточный',1300000,14, 3),
 ('VOR', 'Воронежская область',    'Центральный',    2300000, 5, 4),
 ('BAS', 'Республика Башкортостан','Приволжский',    4000000, 8, 3);

-- Текущие показатели (2026-Q1) — генерируем для каждого региона
INSERT INTO health_indicators
    (region_id, period, hospitals, doctors_per_10k, beds_per_10k, life_expectancy, incidence_rate)
SELECT
    r.id,
    '2026-Q1',
    (40 + (r.population / 200000))::int,
    round((38 + random()*20)::numeric, 1),
    round((70 + random()*40)::numeric, 1),
    round((70 + random()*6)::numeric, 1),
    round((600 + random()*400)::numeric, 1)
FROM regions r;

-- Прогнозы — по два показателя на регион
INSERT INTO forecasts (region_id, horizon_year, metric, value, unit, note)
SELECT r.id, 2027, 'Ожидаемая продолжительность жизни',
       round((72 + random()*5)::numeric,2), 'лет',
       'Базовый сценарий'
FROM regions r;

INSERT INTO forecasts (region_id, horizon_year, metric, value, unit, note)
SELECT r.id, 2027, 'Обеспеченность врачами',
       round((42 + random()*18)::numeric,2), 'на 10 тыс.',
       'Целевой показатель нацпроекта'
FROM regions r;

-- Несколько устройств для примера
INSERT INTO devices (region_id, name, category, quantity, status)
SELECT r.id, 'Магнитно-резонансный томограф', 'МРТ',
       (1 + floor(random()*5))::int, 'в эксплуатации'
FROM regions r WHERE r.code IN ('MOW','SPE','TAT','SVE','NVS');

INSERT INTO devices (region_id, name, category, quantity, status)
SELECT r.id, 'Аппарат ИВЛ', 'ИВЛ',
       (5 + floor(random()*20))::int, 'в эксплуатации'
FROM regions r;
