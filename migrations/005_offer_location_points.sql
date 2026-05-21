-- Метки места на карте (опционально при создании задачи)
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS location_points jsonb DEFAULT NULL;

COMMENT ON COLUMN offers.location_points IS
  'Массив объектов {lng, lat, label?}; задаётся только при создании';
