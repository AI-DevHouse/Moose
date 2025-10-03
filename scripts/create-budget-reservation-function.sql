-- Budget reservation function with row-level locking
-- Prevents race conditions on daily spend calculations

CREATE OR REPLACE FUNCTION check_and_reserve_budget(
  p_estimated_cost DECIMAL,
  p_service_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE(
  can_proceed BOOLEAN,
  current_total DECIMAL,
  reservation_id UUID
) AS $$
DECLARE
  v_current_total DECIMAL;
  v_daily_limit DECIMAL := 100.0;
  v_reservation_id UUID;
BEGIN
  -- Lock cost_tracking table for this day
  LOCK TABLE cost_tracking IN SHARE ROW EXCLUSIVE MODE;

  -- Calculate current daily spend
  SELECT COALESCE(SUM(cost), 0) INTO v_current_total
  FROM cost_tracking
  WHERE DATE(created_at) = CURRENT_DATE;

  -- Check if reservation would exceed limit
  IF v_current_total + p_estimated_cost > v_daily_limit THEN
    RETURN QUERY SELECT FALSE, v_current_total, NULL::UUID;
  ELSE
    -- Create reservation record
    v_reservation_id := gen_random_uuid();

    INSERT INTO cost_tracking (id, cost, service_name, metadata, created_at)
    VALUES (
      v_reservation_id,
      p_estimated_cost,
      p_service_name,
      jsonb_build_object(
        'type', 'reservation',
        'original_metadata', p_metadata
      ),
      NOW()
    );

    RETURN QUERY SELECT TRUE, v_current_total, v_reservation_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
