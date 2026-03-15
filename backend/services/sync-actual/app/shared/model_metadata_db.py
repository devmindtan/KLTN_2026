"""
Database operations cho ML Model Metadata
Quản lý thông tin tracking của models (version, metrics, training info)
"""
import logging
import json
from datetime import datetime
from typing import Dict, Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class ModelMetadataDB:
    """Database handler cho ml_model_metadata table"""

    def __init__(self, db_pool):
        """
        Args:
            db_pool: psycopg2 connection pool
        """
        self.pool = db_pool
        self._create_table_if_not_exists()

    def _create_table_if_not_exists(self):
        """Tạo bảng ml_model_metadata nếu chưa tồn tại"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS ml_model_metadata (
            id SERIAL PRIMARY KEY,
            model_type VARCHAR(50) NOT NULL,
            model_version VARCHAR(50) NOT NULL,
            minio_key VARCHAR(255) NOT NULL,
            base_model VARCHAR(100),
            training_samples INTEGER,
            training_duration_hours FLOAT,
            metrics JSONB,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(model_type, model_version)
        );
        
        CREATE INDEX IF NOT EXISTS idx_model_active 
        ON ml_model_metadata(model_type, is_active) 
        WHERE is_active = TRUE;
        """

        conn = self.pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(create_table_sql)
                conn.commit()
                logger.info("✅ Table ml_model_metadata ready")
        except Exception as e:
            logger.error(f"❌ Create table failed: {e}")
            conn.rollback()
        finally:
            self.pool.putconn(conn)

    def save_model_metadata(
        self,
        model_type: str,
        model_version: str,
        minio_key: str,
        base_model: str = None,
        training_samples: int = None,
        training_duration_hours: float = None,
        metrics: dict = None,
        is_active: bool = False
    ) -> Optional[int]:
        """
        Lưu metadata của model vào database
        Args:
            model_type: Loại model (yolo, random_forest_5m, random_forest_10m, ...)
            model_version: Version (v1, v2, 20260227, ...)
            minio_key: Đường dẫn file trên MinIO
            base_model: Model gốc (yolov11m, RandomForestRegressor, ...)
            training_samples: Số lượng samples dùng để train
            training_duration_hours: Thời gian train (giờ)
            metrics: Dict chứa metrics (MAE, RMSE, R2, mAP, precision, ...)
            is_active: Model này có đang active không
        Returns:
            ID của record được insert, hoặc None nếu lỗi
        """
        insert_sql = """
        INSERT INTO ml_model_metadata (
            model_type, model_version, minio_key, base_model,
            training_samples, training_duration_hours, metrics, is_active
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (model_type, model_version) 
        DO UPDATE SET
            minio_key = EXCLUDED.minio_key,
            base_model = EXCLUDED.base_model,
            training_samples = EXCLUDED.training_samples,
            training_duration_hours = EXCLUDED.training_duration_hours,
            metrics = EXCLUDED.metrics,
            is_active = EXCLUDED.is_active
        RETURNING id;
        """

        conn = self.pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(insert_sql, (
                    model_type, model_version, minio_key, base_model,
                    training_samples, training_duration_hours,
                    json.dumps(metrics) if metrics else None,
                    is_active
                ))
                result = cur.fetchone()
                conn.commit()

                record_id = result[0] if result else None
                logger.info(
                    f"✅ Saved metadata: {model_type} v{model_version} (ID: {record_id})")
                return record_id

        except Exception as e:
            logger.error(f"❌ Save metadata failed: {e}")
            conn.rollback()
            return None
        finally:
            self.pool.putconn(conn)

    def get_active_model(self, model_type: str) -> Optional[Dict]:
        """
        Lấy thông tin model đang active cho loại model cụ thể
        Args:
            model_type: Loại model (yolo, random_forest_5m, ...)
        Returns:
            Dict chứa metadata của active model, hoặc None
        """
        query_sql = """
        SELECT id, model_type, model_version, minio_key, base_model,
               training_samples, training_duration_hours, metrics, created_at
        FROM ml_model_metadata
        WHERE model_type = %s AND is_active = TRUE
        LIMIT 1;
        """

        conn = self.pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query_sql, (model_type,))
                result = cur.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"❌ Get active model failed: {e}")
            return None
        finally:
            self.pool.putconn(conn)

    def set_active_model(self, model_type: str, model_version: str) -> bool:
        """
        Đặt 1 model version làm active (deactivate các versions khác)
        Args:
            model_type: Loại model
            model_version: Version cần activate
        Returns:
            True nếu thành công
        """
        update_sql = """
        UPDATE ml_model_metadata
        SET is_active = CASE
            WHEN model_version = %s THEN TRUE
            ELSE FALSE
        END
        WHERE model_type = %s;
        """

        conn = self.pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(update_sql, (model_version, model_type))
                conn.commit()
                logger.info(f"✅ Activated: {model_type} v{model_version}")
                return True
        except Exception as e:
            logger.error(f"❌ Set active failed: {e}")
            conn.rollback()
            return False
        finally:
            self.pool.putconn(conn)

    def get_model_history(self, model_type: str, limit: int = 10) -> List[Dict]:
        """
        Lấy lịch sử các versions của 1 loại model
        Args:
            model_type: Loại model
            limit: Số lượng records tối đa
        Returns:
            List các metadata records (mới nhất đầu tiên)
        """
        query_sql = """
        SELECT id, model_type, model_version, minio_key, base_model,
               training_samples, training_duration_hours, metrics, 
               is_active, created_at
        FROM ml_model_metadata
        WHERE model_type = %s
        ORDER BY created_at DESC
        LIMIT %s;
        """

        conn = self.pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query_sql, (model_type, limit))
                results = cur.fetchall()
                return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"❌ Get model history failed: {e}")
            return []
        finally:
            self.pool.putconn(conn)
