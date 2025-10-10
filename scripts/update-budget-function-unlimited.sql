-- Update budget reservation function to use unlimited budget
-- This removes the hardcoded $100 limit

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
  v_daily_limit DECIMAL;
  v_reservation_id UUID;
  v_config_value TEXT;
BEGIN
  -- Lock cost_tracking table for this day
  LOCK TABLE cost_tracking IN SHARE ROW EXCLUSIVE MODE;

  -- Get daily limit from system_config (budget_limits.daily_hard_cap)
  SELECT value INTO v_config_value
  FROM system_config
  WHERE key = 'budget_limits';

  -- Parse budget_limits JSON and extract daily_hard_cap
  IF v_config_value IS NOT NULL THEN
    v_daily_limit := (v_config_value::jsonb->>'daily_hard_cap')::DECIMAL;
  ELSE
    -- Fallback to unlimited if config not found
    v_daily_limit := 999999;
  END IF;

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
