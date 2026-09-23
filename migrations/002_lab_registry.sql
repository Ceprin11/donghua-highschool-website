-- Preserve historical experiment metadata so content upgrades remain reversible.
CREATE TABLE experiment_meta_next (
  record_id TEXT PRIMARY KEY REFERENCES content_records(id) ON DELETE CASCADE,
  engine_key TEXT NOT NULL UNIQUE CHECK(engine_key IN ('neural','vision','temperature','maze','gesture','cv','cnn','lenet','lenet-training','teachable','transformer')),
  runtime_status TEXT NOT NULL DEFAULT 'maintenance' CHECK(runtime_status IN ('ready','maintenance'))
);
INSERT INTO experiment_meta_next SELECT record_id, engine_key, runtime_status FROM experiment_meta;
DROP TABLE experiment_meta;
ALTER TABLE experiment_meta_next RENAME TO experiment_meta;
