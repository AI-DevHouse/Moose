-- Link Todo App work orders to project
UPDATE work_orders
SET project_id = '47ad6c1d-96dc-4fe2-a009-4c4e25d2a6a6'
WHERE title LIKE '%Todo%' OR title LIKE '%localStorage%' OR description LIKE '%Todo%';

-- Verify update
SELECT id, title, project_id
FROM work_orders
WHERE project_id = '47ad6c1d-96dc-4fe2-a009-4c4e25d2a6a6';
